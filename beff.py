import random
import cv2
import mediapipe as mp
import numpy as np
import time

# ----------- INIT ----------- #
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

pose = mp_pose.Pose(
    model_complexity=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6
)

# ----------- PRIMARY ANGLE CONFIG ----------- #
# Each exercise defines the three landmarks that form the PRIMARY angle
# and the threshold angles that mark the top (up) and bottom (down) of each rep.
EXERCISES = {
    # Knee angle — hip → knee → ankle
    # Standing ≈ 165°, thighs parallel ≈ 85°
    "squat": {
        "points": ["hip", "knee", "ankle"],
        "up_angle": 165,
        "down_angle": 85
    },

    # Elbow angle — shoulder → elbow → wrist
    # Arms extended ≈ 160°, chest near floor ≈ 70°
    "pushup": {
        "points": ["shoulder", "elbow", "wrist"],
        "up_angle": 160,
        "down_angle": 70
    },

    # Elbow angle — shoulder → elbow → wrist
    # Arm hanging ≈ 155°, fully curled ≈ 45°
    "bicep_curl": {
        "points": ["shoulder", "elbow", "wrist"],
        "up_angle": 155,
        "down_angle": 45
    },

    # Shoulder angle — hip → shoulder → elbow
    # Arms overhead ≈ 155°, elbows at shoulder height ≈ 75°
    "shoulder_press": {
        "points": ["hip", "shoulder", "elbow"],
        "up_angle": 155,
        "down_angle": 75
    },

    # Knee angle — hip → knee → ankle
    # Standing ≈ 165°, knee at 90° ≈ 95°
    "lunge": {
        "points": ["hip", "knee", "ankle"],
        "up_angle": 165,
        "down_angle": 95
    },

    # Hip angle — shoulder → hip → knee
    # Standing tall ≈ 165°, bar at knee ≈ 90°
    "deadlift": {
        "points": ["shoulder", "hip", "knee"],
        "up_angle": 165,
        "down_angle": 90
    }
}

# ----------- FORM CHECKS CONFIG ----------- #
# Per-exercise additional biomechanical checks.
# Each check has:
#   "name"        → unique key used in state["form_metrics"]
#   "label"       → short string shown in the HUD
#   "threshold"   → max acceptable value (degrees unless noted)
#   "direction"   → "below" means value must stay BELOW threshold (default)
#   "messages"    → dict with "pass" / "fail" feedback strings
#   "active"      → True means check every frame; or a list of stages ["up","down"]
#
# Add new exercises here — process_frame picks them up automatically.
FORM_CHECKS = {
    "bicep_curl": [
        {
            # Measures how far the upper arm swings away from the torso.
            # Upper-arm vector (shoulder→elbow) vs torso-down vector (shoulder→hip).
            # When the elbow is tucked against the body this angle ≈ 0°.
            # Anything above ~15° means the elbow is winging out.
            "name": "elbow_flare",
            "label": "Elbow flare",
            "threshold": 15,          # degrees
            "direction": "below",
            "messages": {
                "pass": "Elbow tucked ✓",
                "fail": "Elbow flaring — tuck it to your side!"
            },
            "active": True
        },
        {
            # Measures how much the torso leans back (or forward) during the curl.
            # Torso vector (shoulder→hip) vs the image vertical (downward y-axis).
            # A perfectly upright stance gives ≈ 0°.
            # Athletes often lean back to swing the weight — this catches that cheat.
            "name": "torso_sway",
            "label": "Torso sway",
            "threshold": 10,          # degrees from vertical
            "direction": "below",
            "messages": {
                "pass": "Torso upright ✓",
                "fail": "Don't lean back — brace your core!"
            },
            "active": True
        }
    ]
    # Future entries follow the same pattern, e.g.:
    # "squat": [ { "name": "knee_cave", ... }, { "name": "forward_lean", ... } ]
}

# ----------- FEEDBACK MESSAGES ----------- #
feedback_messages = {
    "squat": {
        "too_shallow": [
            "Drive those hips lower, get below parallel!",
            "Not deep enough! Push your knees out and sink lower."
        ],
        "perfect": [
            "Great depth! Keep that rhythm going!",
            "Perfect squat! Really feel those glutes working!"
        ],
        "too_deep": [
            "Ease up a bit, you're losing tension at the bottom.",
            "Too deep! Control the movement, stop at parallel."
        ],
        "middle": [
            "Almost there! Push deeper, you've got this!",
            "Getting close, fix your form and go lower!"
        ]
    },
    "pushup": {
        "too_shallow": [
            "Get that chest to the floor!",
            "Half reps don't count, go all the way down!"
        ],
        "perfect": [
            "Perfect pushup, chest to floor!",
            "Great form, keep it up!"
        ],
        "too_deep": [
            "Control it, don't collapse at the bottom!",
            "Maintain tension, don't sink into the floor!"
        ],
        "middle": [
            "Almost there! Lock those elbows and go lower!",
            "Getting close, keep pushing that chest down!"
        ]
    },
    "bicep_curl": {
        "too_shallow": [
            "Curl all the way up — squeeze that bicep at the top!",
            "Don't stop halfway! Full range of motion for max gains."
        ],
        "perfect": [
            "Beautiful curl! Full contraction at the top!",
            "That's it — squeeze and control the way down!"
        ],
        "too_deep": [
            "You don't need to go past 90° — keep the tension on the bicep!",
            "Control it! You're swinging the weight past the peak."
        ],
        "middle": [
            "Almost peaked! Squeeze harder at the top!",
            "Keep the elbow locked at your side and curl higher!"
        ]
    },
    "shoulder_press": {
        "too_shallow": [
            "Lock out those arms at the top — full extension!",
            "Press all the way up, don't cut the range short!"
        ],
        "perfect": [
            "Full lockout! Great shoulder press!",
            "Excellent! Arms fully extended — feel those delts!"
        ],
        "too_deep": [
            "Don't drop the elbows too low — stop at shoulder height!",
            "Control the descent, elbows at 90° at the bottom is plenty."
        ],
        "middle": [
            "Push those arms all the way up — you've got more!",
            "Drive through the top — full extension!"
        ]
    },
    "lunge": {
        "too_shallow": [
            "Sink lower! Your back knee should almost touch the floor!",
            "Deeper lunge — drive that front knee forward over the toe!"
        ],
        "perfect": [
            "Perfect lunge depth! Great balance and control!",
            "That's the depth — feel the stretch in that hip flexor!"
        ],
        "too_deep": [
            "Watch the knee — don't let it cave past your toes!",
            "Ease up slightly — you're losing stability at the bottom."
        ],
        "middle": [
            "Go a little deeper — back knee towards the floor!",
            "Almost! Step out wider and drop that back knee lower."
        ]
    },
    "deadlift": {
        "too_shallow": [
            "Hinge deeper — push those hips back further!",
            "More hip hinge! The bar should reach knee level."
        ],
        "perfect": [
            "Great hinge depth! Drive those hips through at the top!",
            "Perfect pull! Engaged lats and a strong lockout!"
        ],
        "too_deep": [
            "Don't round that lower back — hinge less, brace more!",
            "Keep the spine neutral — you're going past safe range."
        ],
        "middle": [
            "Push the hips back further and feel the hamstring stretch!",
            "Almost! Drive those hips back, not just down."
        ]
    }
}

# ----------- REP STATE ----------- #
state = {
    "current_exercise": "squat",
    "counter": 0,
    "stage": None,
    "feedback": "",
    "ai_feedback": "",
    "last_rep_time": 0,
    "last_stage_change_time": time.time(),
    "cooldown": 0.8,
    "min_angle_this_rep": 180,
    "angle_history": [],
    "rep_start_time": time.time(),
    # Form check state — populated every frame
    "form_metrics": {},       # {"elbow_flare": 12.3, "torso_sway": 4.1, ...}
    "form_violations": [],    # list of violation dicts for the current frame
    "form_violation_history": {}  # {"check_name": violation_count_this_rep}
}

# ----------- SESSION STATE ----------- #
session = {
    "active": False,
    "exercise": "squat",
    "target_reps": 10,
    "target_sets": 3,
    "current_set": 1,
    "completed_sets": [],
    "current_set_depths": [],
    "current_set_rep_times": [],
    "current_set_form_scores": [],  # 0–100 per rep, based on violation count
    "rep_start_time": None,
    "is_resting": False,
    "rest_start_time": None,
    "rest_duration": 60,
    "set_feedback": "",
    "session_summary": "",
    "session_complete": False,
    "target_depth": 85
}

SMOOTHING_WINDOW = 5

# ----------- HELPER FUNCTIONS ----------- #

def calculate_angle(a, b, c):
    """Return the interior angle (degrees) at vertex b."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = (np.arctan2(c[1] - b[1], c[0] - b[0]) -
               np.arctan2(a[1] - b[1], a[0] - b[0]))
    angle = np.abs(np.degrees(radians))
    return 360 - angle if angle > 180 else angle


def get_landmark(landmarks, name):
    """Return the more-visible side's [x, y] and its visibility score."""
    mapping_left = {
        "hip":      mp_pose.PoseLandmark.LEFT_HIP,
        "knee":     mp_pose.PoseLandmark.LEFT_KNEE,
        "ankle":    mp_pose.PoseLandmark.LEFT_ANKLE,
        "shoulder": mp_pose.PoseLandmark.LEFT_SHOULDER,
        "elbow":    mp_pose.PoseLandmark.LEFT_ELBOW,
        "wrist":    mp_pose.PoseLandmark.LEFT_WRIST
    }
    mapping_right = {
        "hip":      mp_pose.PoseLandmark.RIGHT_HIP,
        "knee":     mp_pose.PoseLandmark.RIGHT_KNEE,
        "ankle":    mp_pose.PoseLandmark.RIGHT_ANKLE,
        "shoulder": mp_pose.PoseLandmark.RIGHT_SHOULDER,
        "elbow":    mp_pose.PoseLandmark.RIGHT_ELBOW,
        "wrist":    mp_pose.PoseLandmark.RIGHT_WRIST
    }
    lp = landmarks[mapping_left[name].value]
    rp = landmarks[mapping_right[name].value]
    pt = lp if lp.visibility > rp.visibility else rp
    return [pt.x, pt.y], pt.visibility


def vec_angle_deg(v1: np.ndarray, v2: np.ndarray) -> float:
    """Unsigned angle (0–180°) between two 2-D vectors."""
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom < 1e-6:
        return 0.0
    cos_a = np.clip(np.dot(v1, v2) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_a)))


# ----------- PER-EXERCISE FORM METRIC COMPUTERS ----------- #
# Each function receives the full landmarks list and returns:
#   metrics   dict  {check_name: float_value}
# New exercises: add an "elif exercise == ..." block here and a matching
# entry in FORM_CHECKS above.

def _compute_form_metrics_bicep_curl(landmarks):
    """
    Bicep curl form metrics:
      1. elbow_flare  — angle between upper-arm vector and torso-down vector.
                        Ideal < 15°. Detects elbow winging away from the body.
      2. torso_sway   — angle of shoulder→hip line vs image vertical.
                        Ideal < 10°. Detects leaning back to cheat the weight up.
    """
    lsh = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
    rsh = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]

    # Choose the more-visible side
    if lsh.visibility > rsh.visibility:
        sh = np.array([lsh.x, lsh.y])
        el = np.array([landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
                       landmarks[mp_pose.PoseLandmark.LEFT_ELBOW.value].y])
        hp = np.array([landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].x,
                       landmarks[mp_pose.PoseLandmark.LEFT_HIP.value].y])
    else:
        sh = np.array([rsh.x, rsh.y])
        el = np.array([landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].x,
                       landmarks[mp_pose.PoseLandmark.RIGHT_ELBOW.value].y])
        hp = np.array([landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].x,
                       landmarks[mp_pose.PoseLandmark.RIGHT_HIP.value].y])

    upper_arm = el - sh      # shoulder → elbow
    torso_down = hp - sh     # shoulder → hip  (≈ downward in image space)

    # 1. Elbow flare: angle between upper arm and the torso-down axis
    elbow_flare = vec_angle_deg(upper_arm, torso_down)

    # 2. Torso sway: angle of torso-down vector vs image vertical [0, 1]
    #    In OpenCV image coords y increases downward, so "straight down" = (0, 1).
    vertical = np.array([0.0, 1.0])
    torso_sway = vec_angle_deg(torso_down, vertical)

    return {
        "elbow_flare": round(elbow_flare, 1),
        "torso_sway":  round(torso_sway, 1)
    }


# ----------- DISPATCHER ----------- #

def compute_form_metrics(exercise: str, landmarks) -> dict:
    """
    Central dispatcher — returns a metrics dict for the given exercise.
    Returns an empty dict if no form checks are defined for the exercise.
    """
    if exercise == "bicep_curl":
        return _compute_form_metrics_bicep_curl(landmarks)
    # Future:
    # elif exercise == "squat":
    #     return _compute_form_metrics_squat(landmarks)
    return {}


def evaluate_form_violations(exercise: str, metrics: dict) -> list:
    """
    Compare computed metrics against FORM_CHECKS thresholds.
    Returns a list of violation dicts:
      {"check": name, "value": float, "message": str}
    """
    checks = FORM_CHECKS.get(exercise, [])
    violations = []
    for chk in checks:
        name = chk["name"]
        value = metrics.get(name)
        if value is None:
            continue
        direction = chk.get("direction", "below")
        breached = (value > chk["threshold"]) if direction == "below" else (value < chk["threshold"])
        if breached:
            violations.append({
                "check": name,
                "value": value,
                "message": chk["messages"]["fail"]
            })
    return violations


# ----------- DEPTH FEEDBACK ----------- #

def get_ai_feedback(min_angle, exercise, config):
    messages = feedback_messages[exercise]
    target = config["down_angle"]

    if min_angle > target + 20:
        category = "too_shallow"
    elif min_angle > target + 5:
        category = "middle"
    elif min_angle < target - 15:
        category = "too_deep"
    else:
        category = "perfect"
    return random.choice(messages[category])


# ----------- FORM SCORE (per rep) ----------- #

def compute_rep_form_score(exercise: str, violation_history: dict) -> int:
    """
    Return a 0–100 form score for the completed rep.
    Deducts points per FORM_CHECKS violation count, capped at 0.
    Each check that fired more than 20% of frames costs 20 pts.
    """
    checks = FORM_CHECKS.get(exercise, [])
    if not checks:
        return 100

    score = 100
    total_frames = violation_history.get("_total_frames", 1)
    for chk in checks:
        name = chk["name"]
        count = violation_history.get(name, 0)
        ratio = count / max(total_frames, 1)
        if ratio > 0.2:
            score -= 20
    return max(score, 0)


# ----------- STATE RESET ----------- #

def reset_state(exercise=None):
    state["counter"] = 0
    state["stage"] = None
    state["feedback"] = ""
    state["ai_feedback"] = ""
    state["last_rep_time"] = 0
    state["last_stage_change_time"] = time.time()
    state["min_angle_this_rep"] = 180
    state["angle_history"] = []
    state["rep_start_time"] = time.time()
    state["form_metrics"] = {}
    state["form_violations"] = []
    state["form_violation_history"] = {}
    if exercise:
        state["current_exercise"] = exercise


def _reset_rep_form_tracking():
    """Clear per-rep violation counters at the start of each new rep."""
    state["form_violation_history"] = {"_total_frames": 0}
    for chk in FORM_CHECKS.get(state["current_exercise"], []):
        state["form_violation_history"][chk["name"]] = 0


# ----------- SESSION CONTROL ----------- #

def start_session(exercise, target_reps, target_sets):
    session["active"] = True
    session["exercise"] = exercise
    session["target_reps"] = target_reps
    session["target_sets"] = target_sets
    session["current_set"] = 1
    session["completed_sets"] = []
    session["current_set_depths"] = []
    session["current_set_rep_times"] = []
    session["current_set_form_scores"] = []
    session["rep_start_time"] = time.time()
    session["is_resting"] = False
    session["rest_start_time"] = None
    session["set_feedback"] = ""
    session["session_summary"] = ""
    session["session_complete"] = False
    session["target_depth"] = EXERCISES[exercise]["down_angle"]
    reset_state(exercise)


def complete_set():
    session["completed_sets"].append({
        "set_number": session["current_set"],
        "depths": list(session["current_set_depths"]),
        "rep_times": list(session["current_set_rep_times"]),
        "form_scores": list(session["current_set_form_scores"]),
        "reps_completed": state["counter"]
    })
    session["is_resting"] = True
    session["rest_start_time"] = time.time()
    session["current_set_depths"] = []
    session["current_set_rep_times"] = []
    session["current_set_form_scores"] = []
    reset_state(session["exercise"])


# ----------- OVERLAY HELPERS ----------- #

def _draw_form_hud(frame, exercise):
    """
    Draws a small form-check panel in the top-right corner.
    Green = passing, Red = failing for each registered check.
    """
    checks = FORM_CHECKS.get(exercise, [])
    if not checks:
        return

    h, w, _ = frame.shape
    panel_x = w - 280
    panel_y = 10
    line_h = 28

    for i, chk in enumerate(checks):
        name = chk["name"]
        value = state["form_metrics"].get(name)
        is_violation = any(v["check"] == name for v in state["form_violations"])

        color = (0, 60, 255) if is_violation else (0, 200, 80)
        status = chk["messages"]["fail"] if is_violation else chk["messages"]["pass"]

        # Background pill
        y = panel_y + i * line_h
        cv2.rectangle(frame, (panel_x - 4, y), (w - 6, y + line_h - 4), (30, 30, 30), -1)

        val_str = f"{value:.0f}°" if value is not None else "--"
        label = f"{chk['label']}: {val_str}"
        cv2.putText(frame, label, (panel_x, y + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 1, cv2.LINE_AA)

    # If there's an active violation, flash the message at the bottom
    if state["form_violations"]:
        top_msg = state["form_violations"][0]["message"]
        cv2.rectangle(frame, (0, h - 45), (w, h), (0, 0, 180), -1)
        cv2.putText(frame, top_msg, (12, h - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)


# ----------- MAIN FRAME PROCESSOR ----------- #

def process_frame(frame):
    current_exercise = state["current_exercise"]
    config = EXERCISES[current_exercise]

    # ── REST TIMER ───────────────────────────────────────────────────────────
    if session["active"] and session["is_resting"]:
        elapsed = time.time() - session["rest_start_time"]
        remaining = int(session["rest_duration"] - elapsed)
        if remaining <= 0:
            session["is_resting"] = False
            session["current_set"] += 1
            session["rep_start_time"] = time.time()
            reset_state(session["exercise"])
        else:
            cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]), (20, 20, 20), -1)
            cv2.putText(frame, "REST TIME",
                        (frame.shape[1] // 2 - 120, frame.shape[0] // 2 - 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 255), 3)
            cv2.putText(frame, f"{remaining}s",
                        (frame.shape[1] // 2 - 50, frame.shape[0] // 2 + 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 2.5, (0, 255, 0), 4)
            cv2.putText(frame, session["set_feedback"][:60], (20, frame.shape[0] - 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 1)
        return frame, state

    # ── POSE DETECTION ───────────────────────────────────────────────────────
    image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image.flags.writeable = False
    result = pose.process(image)
    image.flags.writeable = True

    if result.pose_landmarks:
        landmarks = result.pose_landmarks.landmark

        (p1, v1) = get_landmark(landmarks, config["points"][0])
        (p2, v2) = get_landmark(landmarks, config["points"][1])
        (p3, v3) = get_landmark(landmarks, config["points"][2])

        if v1 > 0.5 and v2 > 0.5 and v3 > 0.5:
            raw_angle = calculate_angle(p1, p2, p3)

            if 30 < raw_angle < 200:
                # ── SMOOTHING ─────────────────────────────────────────────
                state["angle_history"].append(raw_angle)
                if len(state["angle_history"]) > SMOOTHING_WINDOW:
                    state["angle_history"].pop(0)
                angle = sum(state["angle_history"]) / len(state["angle_history"])
                state["min_angle_this_rep"] = min(state["min_angle_this_rep"], angle)
                current_time = time.time()

                # ── FORM CHECKS (every frame) ─────────────────────────────
                # Compute metrics and compare against thresholds.
                # Violations are shown in real-time and tallied per rep.
                try:
                    metrics = compute_form_metrics(current_exercise, landmarks)
                    violations = evaluate_form_violations(current_exercise, metrics)
                    state["form_metrics"] = metrics
                    state["form_violations"] = violations

                    # Tally for per-rep form score
                    hist = state["form_violation_history"]
                    hist["_total_frames"] = hist.get("_total_frames", 0) + 1
                    for v in violations:
                        hist[v["check"]] = hist.get(v["check"], 0) + 1
                except Exception:
                    # Never let a form-check bug crash the rep counter
                    state["form_metrics"] = {}
                    state["form_violations"] = []

                # ── STATE MACHINE ─────────────────────────────────────────
                transition_handled = False

                if state["stage"] is None:
                    if angle > config["up_angle"]:
                        state["stage"] = "up"
                        session["rep_start_time"] = current_time
                        _reset_rep_form_tracking()
                        transition_handled = True

                if not transition_handled and state["stage"] == "up" \
                        and angle < config["down_angle"]:
                    state["stage"] = "down"
                    state["last_stage_change_time"] = current_time
                    transition_handled = True

                elif not transition_handled and state["stage"] == "down" \
                        and angle > config["up_angle"]:

                    if current_time - state["last_rep_time"] > state["cooldown"]:
                        # ── REP COMPLETED ─────────────────────────────────
                        state["counter"] += 1
                        state["last_rep_time"] = current_time
                        state["last_stage_change_time"] = current_time

                        # Depth feedback
                        state["ai_feedback"] = get_ai_feedback(
                            state["min_angle_this_rep"], current_exercise, config
                        )

                        if session["active"]:
                            session["current_set_depths"].append(state["min_angle_this_rep"])
                            rep_time = current_time - (session["rep_start_time"] or current_time)
                            session["current_set_rep_times"].append(round(rep_time, 2))

                            # Record form score for this rep
                            rep_score = compute_rep_form_score(
                                current_exercise, state["form_violation_history"]
                            )
                            session["current_set_form_scores"].append(rep_score)

                            session["rep_start_time"] = current_time

                            if state["counter"] >= session["target_reps"]:
                                complete_set()
                                return frame, state

                    # Reset min-angle tracker whether or not cooldown passed
                    state["min_angle_this_rep"] = 180
                    state["stage"] = "up"
                    _reset_rep_form_tracking()
                    transition_handled = True

                if not transition_handled:
                    if angle > config["up_angle"]:
                        state["stage"] = "up"
                    elif angle < config["down_angle"]:
                        state["stage"] = "down"

                # ── MOTION FEEDBACK ───────────────────────────────────────
                if state["counter"] > 0 and current_time - state["last_rep_time"] > 5:
                    state["feedback"] = "Let's get moving!"
                elif state["stage"] == "down" \
                        and current_time - state["last_stage_change_time"] > 2:
                    state["feedback"] = "Let's get moving! Push back up!"
                elif state["stage"] == "up":
                    state["feedback"] = "Ready"
                elif state["stage"] == "down":
                    state["feedback"] = "Good depth"
                else:
                    state["feedback"] = "Get in position!"

                # Angle label near the joint
                h, w, _ = frame.shape
                coords = tuple(np.multiply(p2, [w, h]).astype(int))
                cv2.putText(frame, f'Angle: {int(angle)}', coords,
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        mp_drawing.draw_landmarks(
            frame, result.pose_landmarks, mp_pose.POSE_CONNECTIONS
        )

    # ── FORM CHECK HUD ────────────────────────────────────────────────────
    _draw_form_hud(frame, current_exercise)

    # ── STANDARD OVERLAY ─────────────────────────────────────────────────
    cv2.putText(frame, f'Exercise: {current_exercise}', (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2)

    if session["active"]:
        cv2.putText(frame, f'Set: {session["current_set"]}/{session["target_sets"]}',
                    (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, f'Reps: {state["counter"]}/{session["target_reps"]}',
                    (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
    else:
        cv2.putText(frame, f'Reps: {state["counter"]}', (10, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.putText(frame, f'Feedback: {state["feedback"]}', (10, 150),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
    cv2.putText(frame, f'Trainer: {state["ai_feedback"]}', (10, 190),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)

    return frame, state