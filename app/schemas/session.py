from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator

SUPPORTED_EXERCISES = {"squat", "pushup", "bicep_curl", "shoulder_press", "lunge", "deadlift"}


class StartSessionRequest(BaseModel):
    exercise: str = Field("squat", description="Exercise type (e.g. squat, pushup, bicep_curl, shoulder_press, lunge, deadlift)")
    target_reps: int = Field(10, ge=1, le=100)
    target_sets: int = Field(3, ge=1, le=20)
    session_id: Optional[str] = Field(None, description="Optional custom session UUID string")

    @field_validator("exercise")
    @classmethod
    def validate_exercise(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in SUPPORTED_EXERCISES:
            raise ValueError(f"Exercise '{v}' is not supported. Must be one of: {', '.join(sorted(SUPPORTED_EXERCISES))}")
        return v


class EndSessionRequest(BaseModel):
    session_id: Optional[str] = None


class ExerciseMetricResponse(BaseModel):
    id: str
    rep_number: Optional[int] = None
    stage: Optional[str] = None
    form_score: Optional[float] = None
    correction_message: Optional[str] = None
    timestamp: str

    model_config = ConfigDict(from_attributes=True)


class WorkoutSessionResponse(BaseModel):
    id: str
    exercise: str
    started_at: str
    ended_at: Optional[str] = None
    duration_seconds: Optional[int] = None
    total_reps: int
    average_form_score: Optional[float] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class WorkoutSessionDetailResponse(WorkoutSessionResponse):
    metrics: List[ExerciseMetricResponse] = []
