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
# Each exercise defines:
#   points     — 3 landmark names forming the primary rep-counting angle
#   up_angle   — angle at the top of the rep (starting/lockout position)
#   down_angle — angle at the bottom of the rep (end range / peak depth)
EXERCISES = {
    # Knee angle (hip → knee → ankle)
    # Standing ≈ 165°, thighs parallel ≈ 85°
    "squat": {
        "points": ["hip", "knee", "ankle"],
        "up_angle": 165,
        "down_angle": 85
    },
    # Elbow angle (shoulder → elbow → wrist)
    # Arms extended ≈ 160°, chest near floor ≈ 70°
    "pushup": {
        "points": ["shoulder", "elbow", "wrist"],
        "up_angle": 160,
        "down_angle": 70
    },
    # Elbow angle (shoulder → elbow → wrist)
    # Arm hanging ≈ 155°, fully curled ≈ 45°
    "bicep_curl": {
        "points": ["shoulder", "elbow", "wrist"],
        "up_angle": 155,
        "down_angle": 45
    },
    # Shoulder angle (hip → shoulder → elbow)
    # Arms overhead ≈ 155°, elbows at shoulder height ≈ 75°
    "shoulder_press": {
        "points": ["hip", "shoulder", "elbow"],
        "up_angle": 155,
        "down_angle": 75
    },
    # Knee angle (hip → knee → ankle)
    # Standing ≈ 165°, front knee at 90° ≈ 95°
    "lunge": {
        "points": ["hip", "knee", "ankle"],
        "up_angle": 165,
        "down_angle": 95
    },
    # Hip angle (shoulder → hip → knee)
    # Standing tall ≈ 165°, bar at knee ≈ 90°
    "deadlift": {
        "points": ["shoulder", "hip", "knee"],
        "up_angle": 165,
        "down_angle": 90
    }
}

# ----------- FORM CHECKS CONFIG ----------- #
# These drive the HUD display and the form-score calculation.
# The actual measurement logic lives in the _compute_form_metrics_*
# functions below — this config only stores thresholds and messages.
#
# Fields:
#   name       — matches the key returned by the compute function
#   label      — short string shown in the HUD
#   unit       — display unit, usually "°"
#   threshold  — boundary value; violation fires when the check fails
#   direction  — "below": value must stay BELOW threshold (flag if above)
#                "above": value must stay ABOVE threshold (flag if below)
#   messages   — pass/fail strings shown on-screen
FORM_CHECKS = {

    # ── SQUAT ──────────────────────────────────────────────────────────────────
    "squat": [
        {
            # Forward lean: angle of the torso (shoulder→hip) vs image vertical.
            # Ideal < 20° of lean. Too much lean = quad/back dominance, not glutes.
            "name": "forward_lean",
            "label": "Torso lean",
            "unit": "°",
            "threshold": 20,
            "direction": "below",
            "messages": {
                "pass": "Chest up ✓",
                "fail": "Chest up — you're leaning too far forward!"
            }
        },
        {
            # Knee cave (valgus): angle of the knee vector (hip→knee) vs
            # the shin vector (knee→ankle) in the frontal plane.
            # A large deviation means the knees are collapsing inward.
            # Ideal < 15°. Safety-critical — knees are at risk here.
            "name": "knee_cave",
            "label": "Knee tracking",
            "unit": "°",
            "threshold": 15,
            "direction": "below",
            "messages": {
                "pass": "Knees tracking ✓",
                "fail": "Push knees out — they're caving in!"
            }
        }
    ],

    # ── PUSHUP ─────────────────────────────────────────────────────────────────
    "pushup": [
        {
            # Hip sag: deviation of the hip from the shoulder→ankle straight line.
            # Measured as angle of shoulder→hip→ankle. Ideal ~180° (flat plank).
            # Below 165° = hips sagging — core not engaged.
            "name": "hip_sag",
            "label": "Hip position",
            "unit": "°",
            "threshold": 165,
            "direction": "above",   # value must stay ABOVE 165 (flat plank)
            "messages": {
                "pass": "Plank solid ✓",
                "fail": "Squeeze your core — hips are sagging!"
            }
        },
        {
            # Elbow flare: angle between upper-arm vector (shoulder→elbow)
            # and the torso-down vector (shoulder→hip).
            # Ideal ~30–50° (45° tuck). Above 65° = elbows winging out wide.
            "name": "elbow_flare",
            "label": "Elbow tuck",
            "unit": "°",
            "threshold": 65,
            "direction": "below",
            "messages": {
                "pass": "Elbows tucked ✓",
                "fail": "Tuck your elbows — about 45° from your body!"
            }
        }
    ],

    # ── BICEP CURL ─────────────────────────────────────────────────────────────
    "bicep_curl": [
        {
            # Elbow flare: angle between upper-arm vector (shoulder→elbow)
            # and the torso-down vector (shoulder→hip).
            # When arm is pinned to the side this is ~0°.
            # Above 15° = elbow is drifting, front delt taking over.
            "name": "elbow_flare",
            "label": "Elbow flare",
            "unit": "°",
            "threshold": 15,
            "direction": "below",
            "messages": {
                "pass": "Elbow pinned ✓",
                "fail": "Pin your elbow to your side — don't let it drift!"
            }
        },
        {
            # Torso sway: angle of shoulder→hip line vs image vertical.
            # Perfectly upright = 0°. Above 10° = swinging the weight up.
            "name": "torso_sway",
            "label": "Torso sway",
            "unit": "°",
            "threshold": 10,
            "direction": "below",
            "messages": {
                "pass": "Torso still ✓",
                "fail": "Stop swinging — keep your torso locked!"
            }
        }
    ],

    # ── SHOULDER PRESS ─────────────────────────────────────────────────────────
    "shoulder_press": [
        {
            # Lower back arch: angle of torso (shoulder→hip) vs image vertical.
            # Pressing with a big arch shifts load dangerously onto the lumbar.
            # Ideal < 10°. Above 15° = arching too hard.
            "name": "lower_back_arch",
            "label": "Back arch",
            "unit": "°",
            "threshold": 15,
            "direction": "below",
            "messages": {
                "pass": "Neutral spine ✓",
                "fail": "Brace your core — you're arching your lower back!"
            }
        },
        {
            # Wrist alignment: elbow→wrist vector vs image vertical.
            # The wrist should be stacked directly over the elbow at the bottom.
            # If the wrist drifts behind (< ~70° to vertical) the joint is loaded badly.
            "name": "wrist_alignment",
            "label": "Wrist stack",
            "unit": "°",
            "threshold": 70,
            "direction": "above",   # wrist-to-vertical angle must stay ABOVE 70°
            "messages": {
                "pass": "Wrists stacked ✓",
                "fail": "Stack your wrists over your elbows!"
            }
        }
    ],

    # ── LUNGE ──────────────────────────────────────────────────────────────────
    "lunge": [
        {
            # Torso uprightness: angle of shoulder→hip vs image vertical.
            # Should stay close to 0° (vertical). Above 15° = forward lean.
            "name": "forward_lean",
            "label": "Torso lean",
            "unit": "°",
            "threshold": 15,
            "direction": "below",
            "messages": {
                "pass": "Chest up ✓",
                "fail": "Keep your chest up — don't lean forward!"
            }
        },
        {
            # Knee tracking: lateral deviation of knee from ankle.
            # In a lunge the knee should track directly over the 2nd toe.
            # Measured as the angle between hip→knee and knee→ankle vectors.
            # If the knee caves inward this angle increases relative to vertical.
            "name": "knee_alignment",
            "label": "Knee alignment",
            "unit": "°",
            "threshold": 15,
            "direction": "below",
            "messages": {
                "pass": "Knee tracking ✓",
                "fail": "Drive your knee over your toe — it's caving in!"
            }
        }
    ],

    # ── DEADLIFT ───────────────────────────────────────────────────────────────
    "deadlift": [
        {
            # Back rounding: angle of shoulder→hip line vs image vertical.
            # In a proper hip hinge the torso stays rigid.
            # Above 35° of lean from vertical = significant spinal flexion risk.
            # This is a safety-critical check — threshold is kept generous
            # because deadlifts naturally involve forward lean.
            "name": "back_rounding",
            "label": "Back angle",
            "unit": "°",
            "threshold": 35,
            "direction": "below",
            "messages": {
                "pass": "Back neutral ✓",
                "fail": "Keep your back flat — hinge from the hips, not the spine!"
            }
        },
        {
            # Bar drift: angle of shoulder→wrist vector vs image vertical.
            # The wrist (bar) should stay close to the body on the way up.
            # Above 25° from vertical = bar drifting forward, massive lumbar load.
            "name": "bar_drift",
            "label": "Bar path",
            "unit": "°",
            "threshold": 25,
            "direction": "below",
            "messages": {
                "pass": "Bar close ✓",
                "fail": "Keep the bar close — drag it up your shins!"
            }
        }
    ]
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
    "form_metrics": {},        # {check_name: float} — current frame values
    "form_violations": [],     # [{check, value, message}] — current frame
    "form_violation_history": {}  # {check_name: frame_count} — resets per rep
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
    "current_set_form_scores": [],  # 0–100 per rep
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

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def calculate_angle(a, b, c):
    """Interior angle in degrees at vertex b formed by points a, b, c."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = (np.arctan2(c[1] - b[1], c[0] - b[0]) -
               np.arctan2(a[1] - b[1], a[0] - b[0]))
    angle = np.abs(np.degrees(radians))
    return 360 - angle if angle > 180 else angle


def vec_angle_deg(v1: np.ndarray, v2: np.ndarray) -> float:
    """Unsigned angle (0–180°) between two 2-D vectors."""
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom < 1e-6:
        return 0.0
    cos_a = np.clip(np.dot(v1, v2) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_a)))


def get_landmark(landmarks, name):
    """
    Return ([x, y], visibility) for a named landmark,
    choosing whichever side (left/right) has higher visibility.
    This single function is used for BOTH primary angle calculation
    and form metric computation — consistent side selection throughout.
    """
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


def _get_side_landmarks(landmarks, *names):
    """
    Fetch multiple landmarks, ALL from the same side.
    Uses the shoulder visibility to decide which side is dominant,
    then returns all requested landmarks from that side.

    This is critical: mixing left-shoulder with right-elbow gives
    nonsense angles. Every form metric function must use this helper
    instead of calling get_landmark independently per point.

    Returns: list of np.array([x, y]) in the same order as `names`
    """
    mapping = {
        "left": {
            "hip":      mp_pose.PoseLandmark.LEFT_HIP,
            "knee":     mp_pose.PoseLandmark.LEFT_KNEE,
            "ankle":    mp_pose.PoseLandmark.LEFT_ANKLE,
            "shoulder": mp_pose.PoseLandmark.LEFT_SHOULDER,
            "elbow":    mp_pose.PoseLandmark.LEFT_ELBOW,
            "wrist":    mp_pose.PoseLandmark.LEFT_WRIST
        },
        "right": {
            "hip":      mp_pose.PoseLandmark.RIGHT_HIP,
            "knee":     mp_pose.PoseLandmark.RIGHT_KNEE,
            "ankle":    mp_pose.PoseLandmark.RIGHT_ANKLE,
            "shoulder": mp_pose.PoseLandmark.RIGHT_SHOULDER,
            "elbow":    mp_pose.PoseLandmark.RIGHT_ELBOW,
            "wrist":    mp_pose.PoseLandmark.RIGHT_WRIST
        }
    }
    lsh = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
    rsh = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
    side = "left" if lsh.visibility > rsh.visibility else "right"

    result = []
    for name in names:
        lm = landmarks[mapping[side][name].value]
        result.append(np.array([lm.x, lm.y]))
    return result


# =============================================================================
# FORM METRIC COMPUTERS
# =============================================================================
# Each function receives the full landmarks list and returns a dict of
# {check_name: float_value}.  Keys must match FORM_CHECKS[exercise][*]["name"].
#
# Design rules applied to ALL functions:
#   1. Use _get_side_landmarks() for every point — never mix sides.
#   2. Use vec_angle_deg() for form angles — not calculate_angle().
#      calculate_angle() measures interior joint angles (good for rep counting),
#      but form checks compare VECTORS (upper-arm vs torso, torso vs vertical),
#      which requires the dot-product method.
#   3. Image vertical is always np.array([0.0, 1.0]) because OpenCV y increases
#      downward, so "straight down" == (0,1) in normalised landmark coords.
# =============================================================================

def _compute_form_metrics_squat(landmarks) -> dict:
    """
    Squat form metrics:
      1. forward_lean  — torso angle vs vertical (shoulder→hip vs [0,1])
                         Ideal < 20°. Flags excessive forward lean.
      2. knee_cave     — deviation of the knee-to-ankle vector from the
                         hip-to-knee vector. Ideal < 15°.
                         Flags valgus (inward knee collapse).
    """
    sh, hp, kn, an = _get_side_landmarks(landmarks, "shoulder", "hip", "knee", "ankle")

    torso_down = hp - sh            # shoulder → hip  (≈ downward when upright)
    vertical   = np.array([0.0, 1.0])

    # 1. Forward lean: torso vector vs vertical
    forward_lean = vec_angle_deg(torso_down, vertical)

    # 2. Knee cave: hip→knee vector vs knee→ankle vector
    #    When knees track perfectly over toes these two vectors are aligned → 0°.
    #    Inward collapse increases this angle.
    thigh = kn - hp
    shin  = an - kn
    knee_cave = vec_angle_deg(thigh, shin)

    return {
        "forward_lean": round(forward_lean, 1),
        "knee_cave":    round(knee_cave, 1)
    }


def _compute_form_metrics_pushup(landmarks) -> dict:
    """
    Pushup form metrics:
      1. hip_sag    — shoulder→hip→ankle interior angle.
                      Ideal ~180° (flat plank). Below 165° = sagging hips.
      2. elbow_flare — angle between upper-arm vector (shoulder→elbow)
                       and torso-down vector (shoulder→hip).
                       Ideal ~30–50°. Above 65° = elbows winging wide.

    Note: hip_sag uses calculate_angle (interior joint angle).
          elbow_flare uses vec_angle_deg (vector comparison).
    """
    sh, el, hp, an = _get_side_landmarks(landmarks, "shoulder", "elbow", "hip", "ankle")

    # 1. Hip sag — interior angle at hip in the shoulder→hip→ankle chain
    hip_sag = calculate_angle(sh.tolist(), hp.tolist(), an.tolist())

    # 2. Elbow flare — upper-arm vs torso-down
    upper_arm  = el - sh
    torso_down = hp - sh
    elbow_flare = vec_angle_deg(upper_arm, torso_down)

    return {
        "hip_sag":     round(hip_sag, 1),
        "elbow_flare": round(elbow_flare, 1)
    }


def _compute_form_metrics_bicep_curl(landmarks) -> dict:
    """
    Bicep curl form metrics:
      1. elbow_flare — angle between upper-arm vector (shoulder→elbow)
                       and torso-down vector (shoulder→hip).
                       Ideal < 15°. Flags elbow winging away from the body.
      2. torso_sway  — angle of torso-down vector vs image vertical.
                       Ideal < 10°. Flags leaning back to swing the weight.
    """
    sh, el, hp = _get_side_landmarks(landmarks, "shoulder", "elbow", "hip")

    upper_arm  = el - sh
    torso_down = hp - sh
    vertical   = np.array([0.0, 1.0])

    elbow_flare = vec_angle_deg(upper_arm, torso_down)
    torso_sway  = vec_angle_deg(torso_down, vertical)

    return {
        "elbow_flare": round(elbow_flare, 1),
        "torso_sway":  round(torso_sway, 1)
    }


def _compute_form_metrics_shoulder_press(landmarks) -> dict:
    """
    Shoulder press form metrics:
      1. lower_back_arch — torso angle vs vertical (shoulder→hip vs [0,1]).
                           Ideal < 10°. Above 15° = arching the lower back.
      2. wrist_alignment — elbow→wrist vector vs image vertical.
                           Wrist should be stacked over elbow (close to 90°
                           from vertical at the bottom). Below 70° = wrist
                           drifting behind the elbow.
    """
    sh, el, wr, hp = _get_side_landmarks(landmarks, "shoulder", "elbow", "wrist", "hip")

    torso_down = hp - sh
    vertical   = np.array([0.0, 1.0])

    # 1. Lower back arch: torso lean vs vertical
    lower_back_arch = vec_angle_deg(torso_down, vertical)

    # 2. Wrist alignment: forearm (elbow→wrist) vs vertical
    #    At the bottom of a press the forearm should be close to vertical.
    #    We measure the deviation from vertical — small = good alignment.
    forearm = wr - el
    wrist_alignment = vec_angle_deg(forearm, vertical)

    return {
        "lower_back_arch": round(lower_back_arch, 1),
        "wrist_alignment": round(wrist_alignment, 1)
    }


def _compute_form_metrics_lunge(landmarks) -> dict:
    """
    Lunge form metrics:
      1. forward_lean    — torso angle vs vertical (shoulder→hip vs [0,1]).
                           Ideal < 15°. Flags chest-down lean.
      2. knee_alignment  — deviation of the hip→knee vector from the
                           knee→ankle vector. Same as squat knee cave.
                           Ideal < 15°. Flags inward knee collapse.
    """
    sh, hp, kn, an = _get_side_landmarks(landmarks, "shoulder", "hip", "knee", "ankle")

    torso_down = hp - sh
    vertical   = np.array([0.0, 1.0])

    # 1. Forward lean
    forward_lean = vec_angle_deg(torso_down, vertical)

    # 2. Knee alignment (same logic as squat knee_cave)
    thigh = kn - hp
    shin  = an - kn
    knee_alignment = vec_angle_deg(thigh, shin)

    return {
        "forward_lean":   round(forward_lean, 1),
        "knee_alignment": round(knee_alignment, 1)
    }


def _compute_form_metrics_deadlift(landmarks) -> dict:
    """
    Deadlift form metrics:
      1. back_rounding — torso angle vs vertical (shoulder→hip vs [0,1]).
                         In a deadlift the torso leans forward — that's fine.
                         We flag when the lean exceeds 35° because beyond that
                         the lifter is likely rounding the lumbar, not hinging.
      2. bar_drift     — shoulder→wrist vector vs vertical.
                         The bar should stay close to the body (roughly vertical
                         path). Above 25° from vertical = bar drifting forward.
    """
    sh, hp, wr = _get_side_landmarks(landmarks, "shoulder", "hip", "wrist")

    torso_down = hp - sh
    bar_path   = wr - sh   # shoulder → wrist (approximates bar path)
    vertical   = np.array([0.0, 1.0])

    # 1. Back rounding: torso lean from vertical
    back_rounding = vec_angle_deg(torso_down, vertical)

    # 2. Bar drift: wrist path from vertical
    bar_drift = vec_angle_deg(bar_path, vertical)

    return {
        "back_rounding": round(back_rounding, 1),
        "bar_drift":     round(bar_drift, 1)
    }


# ----------- DISPATCHER ----------- #

_METRIC_COMPUTERS = {
    "squat":          _compute_form_metrics_squat,
    "pushup":         _compute_form_metrics_pushup,
    "bicep_curl":     _compute_form_metrics_bicep_curl,
    "shoulder_press": _compute_form_metrics_shoulder_press,
    "lunge":          _compute_form_metrics_lunge,
    "deadlift":       _compute_form_metrics_deadlift
}

def compute_form_metrics(exercise: str, landmarks) -> dict:
    """
    Central dispatcher. Returns a metrics dict or {} if not defined.
    Adding a new exercise: write the function, add it to _METRIC_COMPUTERS.
    Nothing else needs to change.
    """
    fn = _METRIC_COMPUTERS.get(exercise)
    return fn(landmarks) if fn else {}


def evaluate_form_violations(exercise: str, metrics: dict) -> list:
    """
    Compare computed metrics against FORM_CHECKS thresholds.
    Returns [{check, value, message}, ...] for each violated check.
    """
    checks = FORM_CHECKS.get(exercise, [])
    violations = []
    for chk in checks:
        name  = chk["name"]
        value = metrics.get(name)
        if value is None:
            continue
        if chk["direction"] == "below":
            breached = value > chk["threshold"]   # must stay below → flag if above
        else:
            breached = value < chk["threshold"]   # must stay above → flag if below
        if breached:
            violations.append({
                "check":   name,
                "value":   value,
                "message": chk["messages"]["fail"]
            })
    return violations


# =============================================================================
# DEPTH FEEDBACK
# =============================================================================

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


# =============================================================================
# FORM SCORE (per rep)
# =============================================================================

def compute_rep_form_score(exercise: str, violation_history: dict) -> int:
    """
    Return a 0–100 form score for the completed rep.
    Each check that was violated in more than 20% of its frames costs 20 pts.
    """
    checks = FORM_CHECKS.get(exercise, [])
    if not checks:
        return 100
    score        = 100
    total_frames = max(violation_history.get("_total_frames", 1), 1)
    for chk in checks:
        count = violation_history.get(chk["name"], 0)
        if count / total_frames > 0.2:
            score -= 20
    return max(score, 0)


# =============================================================================
# STATE RESET
# =============================================================================

def _reset_rep_form_tracking():
    """Clear per-rep violation counters at the start of each new rep."""
    state["form_violation_history"] = {"_total_frames": 0}
    for chk in FORM_CHECKS.get(state["current_exercise"], []):
        state["form_violation_history"][chk["name"]] = 0


def reset_state(exercise=None):
    state["counter"]               = 0
    state["stage"]                 = None
    state["feedback"]              = ""
    state["ai_feedback"]           = ""
    state["last_rep_time"]         = 0
    state["last_stage_change_time"] = time.time()
    state["min_angle_this_rep"]    = 180
    state["angle_history"]         = []
    state["rep_start_time"]        = time.time()
    state["form_metrics"]          = {}
    state["form_violations"]       = []
    state["form_violation_history"] = {}
    if exercise:
        state["current_exercise"] = exercise


# =============================================================================
# SESSION CONTROL
# =============================================================================

def start_session(exercise, target_reps, target_sets, rest_duration=60):
    session["active"]                  = True
    session["exercise"]                = exercise
    session["target_reps"]             = target_reps
    session["target_sets"]             = target_sets
    session["current_set"]             = 1
    session["completed_sets"]          = []
    session["current_set_depths"]      = []
    session["current_set_rep_times"]   = []
    session["current_set_form_scores"] = []
    session["rep_start_time"]          = time.time()
    session["is_resting"]              = False
    session["rest_start_time"]         = None
    session["rest_duration"]           = rest_duration
    session["set_feedback"]            = ""
    session["session_summary"]         = ""
    session["session_complete"]        = False
    session["target_depth"]            = EXERCISES[exercise]["down_angle"]
    reset_state(exercise)


def complete_set():
    session["completed_sets"].append({
        "set_number":    session["current_set"],
        "depths":        list(session["current_set_depths"]),
        "rep_times":     list(session["current_set_rep_times"]),
        "form_scores":   list(session["current_set_form_scores"]),
        "reps_completed": state["counter"]
    })
    session["is_resting"]              = True
    session["rest_start_time"]         = time.time()
    session["current_set_depths"]      = []
    session["current_set_rep_times"]   = []
    session["current_set_form_scores"] = []
    reset_state(session["exercise"])


# =============================================================================
# OVERLAY HELPERS
# =============================================================================

def _draw_form_hud(frame, exercise):
    """
    Top-right panel showing each form check with its live value.
    Green = passing, Red = failing.
    """
    checks = FORM_CHECKS.get(exercise, [])
    if not checks:
        return

    h, w, _ = frame.shape
    panel_x  = w - 280
    panel_y  = 10
    line_h   = 28

    for i, chk in enumerate(checks):
        name  = chk["name"]
        value = state["form_metrics"].get(name)
        is_vio = any(v["check"] == name for v in state["form_violations"])

        color  = (0, 60, 255) if is_vio else (0, 200, 80)
        status = chk["messages"]["fail"] if is_vio else chk["messages"]["pass"]

        y = panel_y + i * line_h
        cv2.rectangle(frame, (panel_x - 4, y), (w - 6, y + line_h - 4), (30, 30, 30), -1)

        val_str = f"{value:.0f}{chk['unit']}" if value is not None else "--"
        label   = f"{chk['label']}: {val_str}"
        cv2.putText(frame, label, (panel_x, y + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 1, cv2.LINE_AA)

    # Flash the top violation message at the bottom of the frame
    if state["form_violations"]:
        top_msg = state["form_violations"][0]["message"]
        cv2.rectangle(frame, (0, h - 45), (w, h), (0, 0, 180), -1)
        cv2.putText(frame, top_msg, (12, h - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)


# =============================================================================
# MAIN FRAME PROCESSOR
# =============================================================================

def process_frame(frame):
    current_exercise = state["current_exercise"]
    config           = EXERCISES[current_exercise]

    # ── REST TIMER ───────────────────────────────────────────────────────────
    if session["active"] and session["is_resting"]:
        elapsed   = time.time() - session["rest_start_time"]
        remaining = int(session["rest_duration"] - elapsed)
        if remaining <= 0:
            session["is_resting"]   = False
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
    try:
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        result = pose.process(image)
        image.flags.writeable = True
    except Exception:
        return frame, state

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
                # Isolated in try/except so a bad form-check never crashes
                # the rep counter — the most important thing keeps running.
                try:
                    metrics    = compute_form_metrics(current_exercise, landmarks)
                    violations = evaluate_form_violations(current_exercise, metrics)
                    state["form_metrics"]    = metrics
                    state["form_violations"] = violations

                    hist = state["form_violation_history"]
                    hist["_total_frames"] = hist.get("_total_frames", 0) + 1
                    for v in violations:
                        hist[v["check"]] = hist.get(v["check"], 0) + 1
                except Exception:
                    state["form_metrics"]    = {}
                    state["form_violations"] = []

                # ── STATE MACHINE ─────────────────────────────────────────
                # transition_handled prevents the "update stage" fallback at
                # the bottom from immediately undoing a transition on the
                # same boundary frame.
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
                        state["counter"]               += 1
                        state["last_rep_time"]          = current_time
                        state["last_stage_change_time"] = current_time

                        state["ai_feedback"] = get_ai_feedback(
                            state["min_angle_this_rep"], current_exercise, config
                        )

                        if session["active"]:
                            session["current_set_depths"].append(state["min_angle_this_rep"])
                            rep_time = current_time - (session["rep_start_time"] or current_time)
                            session["current_set_rep_times"].append(round(rep_time, 2))

                            rep_score = compute_rep_form_score(
                                current_exercise, state["form_violation_history"]
                            )
                            session["current_set_form_scores"].append(rep_score)
                            session["rep_start_time"] = current_time

                            if state["counter"] >= session["target_reps"]:
                                complete_set()
                                return frame, state

                    # Reset min-angle and form tracking on any down→up crossing
                    # (whether or not cooldown allowed the rep count).
                    state["min_angle_this_rep"] = 180
                    state["stage"]              = "up"
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