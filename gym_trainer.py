import logging
import random
import cv2
import mediapipe as mp
import numpy as np
import time

logger = logging.getLogger(__name__)

# ----------- INIT ----------- #
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils


def _create_pose():
    # A fresh instance each session start — MediaPipe's Pose tracker keeps
    # internal state (its last-known ROI) between calls, which otherwise
    # biases landmark detection on the next session's opening frames with
    # whatever the previous, unrelated video/session last saw.
    return mp_pose.Pose(
        model_complexity=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6
    )


pose = _create_pose()

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

# ----------- SESSION & STATE MANAGEMENT ----------- #
DEFAULT_SESSION_ID = "default"
SESSION_TTL_SECONDS = 1800  # 30 minutes in-memory TTL for abandoned sessions

def _create_default_rep_state(exercise="squat"):
    return {
        "current_exercise": exercise,
        "counter": 0,
        "stage": None,
        "feedback": "",
        "ai_feedback": "",
        "last_rep_time": 0,
        "last_stage_change_time": time.time(),
        # Residual wall-clock sanity floor against pathological sensor glitches —
        # NOT the primary anti-double-count guard (see CONFIRM_FRAMES). A real
        # rep can't physically complete in under 0.3s, so this only ever rejects
        # noise, never a genuine fast rep.
        "cooldown": 0.3,
        "min_angle_this_rep": 180,
        "angle_history": [],
        # Consecutive smoothed-angle frames past the threshold currently being
        # sought — must reach CONFIRM_FRAMES before a stage transition commits.
        "consec_down": 0,
        "consec_up": 0,
        "rep_start_time": time.time(),
        "form_metrics": {},        # {check_name: float} — current frame values
        "form_violations": [],     # [{check, value, message}] — current frame
        "form_violation_history": {}  # {check_name: frame_count} — resets per rep
    }


def _create_default_session_state(exercise="squat", target_reps=10, target_sets=3, rest_duration=60):
    return {
        "active": False,
        "exercise": exercise,
        "target_reps": target_reps,
        "target_sets": target_sets,
        "current_set": 1,
        "completed_sets": [],
        "current_set_depths": [],
        "current_set_rep_times": [],
        "current_set_form_scores": [],  # 0–100 per rep
        "rep_start_time": None,
        "is_resting": False,
        "rest_start_time": None,
        "rest_duration": rest_duration,
        "set_feedback": "",
        "session_summary": "",
        "session_complete": False,
        "target_depth": EXERCISES.get(exercise, {}).get("down_angle", 85)
    }


class WorkoutSessionState:
    """Encapsulates all mutable workout, rep, and MediaPipe tracker state for a single session."""
    def __init__(self, session_id: str, exercise: str = "squat", target_reps: int = 10, target_sets: int = 3, rest_duration: int = 60):
        self.session_id = session_id
        self.pose = _create_pose()
        self.state = _create_default_rep_state(exercise)
        self.session = _create_default_session_state(exercise, target_reps, target_sets, rest_duration)
        self.last_accessed = time.time()

    def touch(self):
        self.last_accessed = time.time()


_sessions: dict[str, WorkoutSessionState] = {}


def _cleanup_expired_sessions(ttl_seconds: float = SESSION_TTL_SECONDS):
    """Purge sessions inactive for longer than ttl_seconds (except DEFAULT_SESSION_ID)."""
    now = time.time()
    expired = [
        sid for sid, sess in list(_sessions.items())
        if sid != DEFAULT_SESSION_ID and (now - sess.last_accessed) > ttl_seconds
    ]
    for sid in expired:
        delete_session(sid)


def get_session_state(session_id: str = None, create_if_missing: bool = True) -> WorkoutSessionState:
    _cleanup_expired_sessions()
    sid = session_id or DEFAULT_SESSION_ID
    if sid not in _sessions:
        if create_if_missing:
            _sessions[sid] = WorkoutSessionState(sid)
        else:
            raise KeyError(f"Session '{sid}' not found")
    sess = _sessions[sid]
    sess.touch()
    return sess


def delete_session(session_id: str):
    """Clean up and delete a workout session instance."""
    if session_id in _sessions:
        sess = _sessions.pop(session_id)
        try:
            sess.pose.close()
        except Exception:
            pass


def end_session(session_id: str = None):
    """End and clean up a workout session."""
    sid = session_id or DEFAULT_SESSION_ID
    delete_session(sid)


def get_active_session_count() -> int:
    """Return the current number of in-memory active workout sessions."""
    return len(_sessions)


class _SessionDictProxy(dict):
    """Proxy dictionary forwarding dict operations to the default session's state or session dict."""
    def __init__(self, key_type: str):
        super().__init__()
        self._key_type = key_type

    @property
    def _target(self) -> dict:
        sess = get_session_state(DEFAULT_SESSION_ID)
        return sess.state if self._key_type == 'state' else sess.session

    def __getitem__(self, key):
        return self._target[key]

    def __setitem__(self, key, value):
        self._target[key] = value

    def __delitem__(self, key):
        del self._target[key]

    def __contains__(self, key):
        return key in self._target

    def __len__(self):
        return len(self._target)

    def __iter__(self):
        return iter(self._target)

    def __repr__(self):
        return repr(self._target)

    def __str__(self):
        return str(self._target)

    def get(self, key, default=None):
        return self._target.get(key, default)

    def keys(self):
        return self._target.keys()

    def values(self):
        return self._target.values()

    def items(self):
        return self._target.items()

    def copy(self):
        return self._target.copy()


state = _SessionDictProxy('state')
session = _SessionDictProxy('session')

def __getattr__(name: str):
    if name == "pose":
        return get_session_state(DEFAULT_SESSION_ID).pose
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")

SMOOTHING_WINDOW = 5

# Consecutive smoothed-angle frames required past a threshold before a stage
# transition (up->down or down->up) commits. Filters single-frame smoothing
# noise right at a boundary without adding perceptible latency (~2 frames,
# well under 100ms at typical webcam frame rates).
CONFIRM_FRAMES = 2

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


_SIDE_LANDMARK_MAP = {
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


def _dominant_side(landmarks) -> str:
    """Which body side (left/right) is more visible this frame, by shoulder visibility."""
    lsh = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
    rsh = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
    return "left" if lsh.visibility > rsh.visibility else "right"


def _get_side_landmarks(landmarks, *names):
    """
    Fetch multiple landmarks, ALL from the same side.
    Uses the shoulder visibility to decide which side is dominant,
    then returns all requested landmarks from that side.

    This is critical: mixing left-shoulder with right-elbow gives
    nonsense angles. Every form metric function must use this helper
    instead of picking each point's side independently.

    Returns: list of np.array([x, y]) in the same order as `names`
    """
    side = _dominant_side(landmarks)
    return [
        np.array([landmarks[_SIDE_LANDMARK_MAP[side][name].value].x,
                   landmarks[_SIDE_LANDMARK_MAP[side][name].value].y])
        for name in names
    ]


def _get_primary_landmarks(landmarks, names):
    """
    Fetch the primary rep-counting angle's landmarks, ALL from the same side,
    plus each point's visibility.

    Previously the rep-counting angle picked each of its 3 points' side
    independently (per-landmark, by that landmark's own visibility), which
    could silently mix e.g. a left shoulder with a right elbow into a single
    angle whenever their independent visibility scores crossed over between
    frames — producing a corrupted angle that may never cleanly cross a rep
    threshold, undercounting reps. This mirrors _get_side_landmarks' single,
    consistent per-frame side decision instead.

    Returns: (points, visibilities) — points as [x, y] lists, in `names` order.
    """
    side = _dominant_side(landmarks)
    points, visibilities = [], []
    for name in names:
        lm = landmarks[_SIDE_LANDMARK_MAP[side][name].value]
        points.append([lm.x, lm.y])
        visibilities.append(lm.visibility)
    return points, visibilities


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

def _reset_rep_form_tracking(sess: WorkoutSessionState = None):
    """Clear per-rep violation counters at the start of each new rep."""
    if sess is None:
        sess = get_session_state(DEFAULT_SESSION_ID)
    st = sess.state
    st["form_violation_history"] = {"_total_frames": 0}
    for chk in FORM_CHECKS.get(st["current_exercise"], []):
        st["form_violation_history"][chk["name"]] = 0


def reset_state(exercise=None, session_id: str = None):
    sess = get_session_state(session_id)
    st = sess.state
    st["counter"]               = 0
    st["stage"]                 = None
    st["feedback"]              = ""
    st["ai_feedback"]           = ""
    st["last_rep_time"]         = 0
    st["last_stage_change_time"] = time.time()
    st["min_angle_this_rep"]    = 180
    st["angle_history"]         = []
    st["consec_down"]           = 0
    st["consec_up"]             = 0
    st["rep_start_time"]        = time.time()
    st["form_metrics"]          = {}
    st["form_violations"]       = []
    st["form_violation_history"] = {}
    if exercise:
        st["current_exercise"] = exercise


def _advance_rep_state(st, sn, sess, angle, current_time, config, current_exercise) -> bool:
    """
    Core rep-counting state machine: REST(None) -> up -> down -> up (+1 rep).

    Isolated from MediaPipe/frame IO on purpose so it can be driven with
    synthetic angle sequences in unit tests (tests/test_rep_counting.py) —
    it only reads/writes the `st`/`sn` dicts and the exercise config, no
    camera or video frame involved.

    Each stage transition requires CONFIRM_FRAMES consecutive calls with the
    angle past the relevant threshold before it commits — a single noisy
    angle sample right at a boundary can no longer flip (or fail to flip)
    the stage by itself. `cooldown` is a residual wall-clock sanity floor
    against pathological sensor glitches, not the primary anti-jitter guard.

    Mutates st/sn in place. Returns True if this call completed the target
    number of reps for the set (caller should stop processing that frame).
    """
    past_up   = angle > config["up_angle"]
    past_down = angle < config["down_angle"]

    if st["stage"] is None:
        if past_up:
            st["stage"] = "up"
            sn["rep_start_time"] = current_time
            _reset_rep_form_tracking(sess)

    elif st["stage"] == "up":
        st["consec_down"] = st["consec_down"] + 1 if past_down else 0
        if st["consec_down"] >= CONFIRM_FRAMES:
            st["stage"]                  = "down"
            st["last_stage_change_time"] = current_time
            st["consec_down"]            = 0

    elif st["stage"] == "down":
        st["consec_up"] = st["consec_up"] + 1 if past_up else 0
        if st["consec_up"] >= CONFIRM_FRAMES:
            if current_time - st["last_rep_time"] > st["cooldown"]:
                # ── REP COMPLETED ─────────────────────────────────────────
                st["counter"]               += 1
                st["last_rep_time"]          = current_time
                st["last_stage_change_time"] = current_time

                st["ai_feedback"] = get_ai_feedback(
                    st["min_angle_this_rep"], current_exercise, config
                )

                if sn["active"]:
                    sn["current_set_depths"].append(st["min_angle_this_rep"])
                    rep_time = current_time - (sn["rep_start_time"] or current_time)
                    sn["current_set_rep_times"].append(round(rep_time, 2))

                    rep_score = compute_rep_form_score(
                        current_exercise, st["form_violation_history"]
                    )
                    sn["current_set_form_scores"].append(rep_score)
                    sn["rep_start_time"] = current_time

                    if st["counter"] >= sn["target_reps"]:
                        complete_set(sess)
                        return True

            # Reset min-angle and form tracking on any confirmed down->up
            # crossing (whether or not cooldown allowed the rep count).
            st["min_angle_this_rep"] = 180
            st["stage"]              = "up"
            st["consec_up"]          = 0
            _reset_rep_form_tracking(sess)

    return False


# =============================================================================
# SESSION CONTROL
# =============================================================================

def start_session(exercise, target_reps, target_sets, rest_duration=60, session_id: str = None):
    sid = session_id or DEFAULT_SESSION_ID
    sess = get_session_state(sid)
    sess.pose = _create_pose()
    sn = sess.session
    sn["active"]                  = True
    sn["exercise"]                = exercise
    sn["target_reps"]             = target_reps
    sn["target_sets"]             = target_sets
    sn["current_set"]             = 1
    sn["completed_sets"]          = []
    sn["current_set_depths"]      = []
    sn["current_set_rep_times"]   = []
    sn["current_set_form_scores"] = []
    sn["rep_start_time"]          = time.time()
    sn["is_resting"]              = False
    sn["rest_start_time"]         = None
    sn["rest_duration"]           = rest_duration
    sn["set_feedback"]            = ""
    sn["session_summary"]         = ""
    sn["session_complete"]        = False
    sn["target_depth"]            = EXERCISES[exercise]["down_angle"]
    reset_state(exercise, session_id=sid)
    return sid


def complete_set(sess: WorkoutSessionState = None):
    if sess is None:
        sess = get_session_state(DEFAULT_SESSION_ID)
    sn = sess.session
    st = sess.state
    sn["completed_sets"].append({
        "set_number":    sn["current_set"],
        "depths":        list(sn["current_set_depths"]),
        "rep_times":     list(sn["current_set_rep_times"]),
        "form_scores":   list(sn["current_set_form_scores"]),
        "reps_completed": st["counter"]
    })
    sn["is_resting"]              = True
    sn["rest_start_time"]         = time.time()
    sn["current_set_depths"]      = []
    sn["current_set_rep_times"]   = []
    sn["current_set_form_scores"] = []
    reset_state(sn["exercise"], session_id=sess.session_id)


# =============================================================================
# OVERLAY HELPERS
# =============================================================================

def _draw_form_hud(frame, exercise, sess: WorkoutSessionState = None):
    """
    Top-right panel showing each form check with its live value.
    Green = passing, Red = failing.
    """
    if sess is None:
        sess = get_session_state(DEFAULT_SESSION_ID)
    checks = FORM_CHECKS.get(exercise, [])
    if not checks:
        return

    st = sess.state
    h, w, _ = frame.shape
    panel_x  = w - 280
    panel_y  = 10
    line_h   = 28

    for i, chk in enumerate(checks):
        name  = chk["name"]
        value = st["form_metrics"].get(name)
        is_vio = any(v["check"] == name for v in st["form_violations"])

        color  = (0, 60, 255) if is_vio else (0, 200, 80)
        status = chk["messages"]["fail"] if is_vio else chk["messages"]["pass"]

        y = panel_y + i * line_h
        cv2.rectangle(frame, (panel_x - 4, y), (w - 6, y + line_h - 4), (30, 30, 30), -1)

        val_str = f"{value:.0f}{chk['unit']}" if value is not None else "--"
        label   = f"{chk['label']}: {val_str}"
        cv2.putText(frame, label, (panel_x, y + 18),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.52, color, 1, cv2.LINE_AA)

    # Flash the top violation message at the bottom of the frame
    if st["form_violations"]:
        top_msg = st["form_violations"][0]["message"]
        cv2.rectangle(frame, (0, h - 45), (w, h), (0, 0, 180), -1)
        cv2.putText(frame, top_msg, (12, h - 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)


# =============================================================================
# MAIN FRAME PROCESSOR
# =============================================================================

def process_frame(frame, session_id: str = None):
    sess = get_session_state(session_id)
    st = sess.state
    sn = sess.session
    pose_tracker = sess.pose

    current_exercise = st["current_exercise"]
    config           = EXERCISES[current_exercise]

    # ── REST TIMER ───────────────────────────────────────────────────────────
    if sn["active"] and sn["is_resting"]:
        elapsed   = time.time() - sn["rest_start_time"]
        remaining = int(sn["rest_duration"] - elapsed)
        if remaining <= 0:
            sn["is_resting"]   = False
            sn["current_set"] += 1
            sn["rep_start_time"] = time.time()
            reset_state(sn["exercise"], session_id=sess.session_id)
        else:
            cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]), (20, 20, 20), -1)
            cv2.putText(frame, "REST TIME",
                        (frame.shape[1] // 2 - 120, frame.shape[0] // 2 - 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 255), 3)
            cv2.putText(frame, f"{remaining}s",
                        (frame.shape[1] // 2 - 50, frame.shape[0] // 2 + 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 2.5, (0, 255, 0), 4)
            cv2.putText(frame, sn["set_feedback"][:60], (20, frame.shape[0] - 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 1)
        return frame, st

    # ── POSE DETECTION ───────────────────────────────────────────────────────
    try:
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        result = pose_tracker.process(image)
        image.flags.writeable = True
    except Exception:
        logger.exception("MediaPipe pose.process() failed on this frame")
        return frame, st

    if result.pose_landmarks:
        landmarks = result.pose_landmarks.landmark

        primary_points, primary_vis = _get_primary_landmarks(landmarks, config["points"])
        (p1, p2, p3) = primary_points
        (v1, v2, v3) = primary_vis

        if v1 > 0.5 and v2 > 0.5 and v3 > 0.5:
            raw_angle = calculate_angle(p1, p2, p3)

            if 30 < raw_angle < 200:
                # ── SMOOTHING ─────────────────────────────────────────────
                st["angle_history"].append(raw_angle)
                if len(st["angle_history"]) > SMOOTHING_WINDOW:
                    st["angle_history"].pop(0)
                angle = sum(st["angle_history"]) / len(st["angle_history"])
                st["min_angle_this_rep"] = min(st["min_angle_this_rep"], angle)
                current_time = time.time()

                # ── FORM CHECKS (every frame) ─────────────────────────────
                # Isolated in try/except so a bad form-check never crashes
                # the rep counter — the most important thing keeps running.
                try:
                    metrics    = compute_form_metrics(current_exercise, landmarks)
                    violations = evaluate_form_violations(current_exercise, metrics)
                    st["form_metrics"]    = metrics
                    st["form_violations"] = violations

                    hist = st["form_violation_history"]
                    hist["_total_frames"] = hist.get("_total_frames", 0) + 1
                    for v in violations:
                        hist[v["check"]] = hist.get(v["check"], 0) + 1
                except Exception:
                    logger.exception(
                        "Form-check computation failed for exercise=%s", current_exercise
                    )
                    st["form_metrics"]    = {}
                    st["form_violations"] = []

                # ── STATE MACHINE ─────────────────────────────────────────
                if _advance_rep_state(st, sn, sess, angle, current_time, config, current_exercise):
                    return frame, st

                # ── MOTION FEEDBACK ───────────────────────────────────────
                if st["counter"] > 0 and current_time - st["last_rep_time"] > 5:
                    st["feedback"] = "Let's get moving!"
                elif st["stage"] == "down" \
                        and current_time - st["last_stage_change_time"] > 2:
                    st["feedback"] = "Let's get moving! Push back up!"
                elif st["stage"] == "up":
                    st["feedback"] = "Ready"
                elif st["stage"] == "down":
                    st["feedback"] = "Good depth"
                else:
                    st["feedback"] = "Get in position!"

                h, w, _ = frame.shape
                coords = tuple(np.multiply(p2, [w, h]).astype(int))
                cv2.putText(frame, f'Angle: {int(angle)}', coords,
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        mp_drawing.draw_landmarks(
            frame, result.pose_landmarks, mp_pose.POSE_CONNECTIONS
        )

    # ── FORM CHECK HUD ────────────────────────────────────────────────────
    _draw_form_hud(frame, current_exercise, sess)

    # ── STANDARD OVERLAY ─────────────────────────────────────────────────
    cv2.putText(frame, f'Exercise: {current_exercise}', (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 255), 2)

    if sn["active"]:
        cv2.putText(frame, f'Set: {sn["current_set"]}/{sn["target_sets"]}',
                    (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, f'Reps: {st["counter"]}/{sn["target_reps"]}',
                    (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
    else:
        cv2.putText(frame, f'Reps: {st["counter"]}', (10, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    cv2.putText(frame, f'Feedback: {st["feedback"]}', (10, 150),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
    cv2.putText(frame, f'Trainer: {st["ai_feedback"]}', (10, 190),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)

    return frame, st