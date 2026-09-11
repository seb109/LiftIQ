from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AIReportStructuredSchema(BaseModel):
    """Validated structured output contract returned by Groq AI model."""
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Overall workout performance score out of 100")
    form_score: float = Field(..., ge=0.0, le=100.0, description="Exercise form technique score out of 100")
    strengths: List[str] = Field(default_factory=list, description="Observed exercise technique strengths")
    mistakes: List[str] = Field(default_factory=list, description="Form mistakes or posture violations identified")
    improvements: List[str] = Field(default_factory=list, description="Actionable recommendations for improvement")
    coach_summary: str = Field(..., description="Encouraging AI coach summary paragraph")
    next_session_focus: str = Field(..., description="Key focus item for next workout session")
    motivation: Optional[str] = Field("Keep up the consistent work!", description="Motivational closing message")

    @field_validator("overall_score", "form_score")
    @classmethod
    def clamp_scores(cls, v: float) -> float:
        return max(0.0, min(100.0, float(v)))


class GenerateReportRequest(BaseModel):
    session_id: str = Field(..., description="UUID string of completed workout session")


class AIReportResponseData(BaseModel):
    id: str
    session_id: str
    overall_score: Optional[float] = None
    form_score: Optional[float] = None
    strengths: List[str] = []
    mistakes: List[str] = []
    improvements: List[str] = []
    coach_summary: Optional[str] = None
    next_session_focus: Optional[str] = None
    motivation: Optional[str] = None
    report_markdown: Optional[str] = None
    model_name: Optional[str] = None
    created_at: str

    model_config = ConfigDict(from_attributes=True)
