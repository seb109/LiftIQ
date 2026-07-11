"""Application constants."""

# Supported exercises from gym_trainer.py
SUPPORTED_EXERCISES = [
    "squat",
    "pushup",
    "bicep_curl",
    "shoulder_press",
    "lunge",
    "deadlift",
]

# Form score constants
MIN_FORM_SCORE = 0
MAX_FORM_SCORE = 100
DEFAULT_FORM_SCORE = 100

# Rep constants
MIN_REPS_PER_SET = 1
MAX_REPS_PER_SET = 100

# Set constants
MIN_SETS = 1
MAX_SETS = 10

# Timing constants
DEFAULT_REST_DURATION_SECONDS = 60
MIN_REST_DURATION_SECONDS = 30
MAX_REST_DURATION_SECONDS = 300

# Frame analysis
MIN_FRAME_CONFIDENCE = 0.5
ANALYSIS_TIMEOUT_SECONDS = 5
