import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.ai_report import AIReport
from app.models.user import User
from app.repositories.ai_report_repository import AIReportRepository
from app.repositories.workout_repository import WorkoutSessionRepository
from app.schemas.auth import APIResponse
from app.schemas.report import GenerateReportRequest
from app.services.ai_service import generate_and_persist_ai_report, MODEL_NAME

router = APIRouter(prefix="/reports", tags=["AI Reports"])


def _serialize_report(report: AIReport) -> dict:
    """Helper to convert AIReport ORM entity into API response dictionary."""
    created_at_str = (
        report.created_at.isoformat()
        if report.created_at
        else None
    )

    exercise = report.session.exercise if report.session else "Workout"
    from app.schemas.report import AIReportStructuredSchema
    from app.services.ai_service import format_report_markdown

    structured = AIReportStructuredSchema(
        overall_score=report.overall_score or 85.0,
        form_score=report.form_score or 85.0,
        strengths=report.strengths or [],
        mistakes=report.mistakes or [],
        improvements=report.improvements or [],
        coach_summary=report.coach_summary or "Workout completed.",
        next_session_focus=report.next_session_focus or "Focus on technique.",
        motivation=report.motivation or "Keep up the work!"
    )
    markdown_content = format_report_markdown(exercise, structured)

    return {
        "id": str(report.id),
        "session_id": str(report.session_id),
        "overall_score": report.overall_score,
        "form_score": report.form_score,
        "strengths": report.strengths or [],
        "mistakes": report.mistakes or [],
        "improvements": report.improvements or [],
        "coach_summary": report.coach_summary,
        "next_session_focus": report.next_session_focus,
        "motivation": report.motivation,
        "report_markdown": markdown_content,
        "model_name": MODEL_NAME,
        "created_at": created_at_str
    }


@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_report(
    req: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger or retrieve AI report for a completed workout session."""
    try:
        session_uuid = uuid.UUID(req.session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    workout_repo = WorkoutSessionRepository(db)
    session_entity = await run_in_threadpool(workout_repo.get_by_id, session_uuid)

    if not session_entity or session_entity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    report = await generate_and_persist_ai_report(db, session_entity)

    return APIResponse(
        success=True,
        message="AI report generated successfully.",
        data=_serialize_report(report)
    )


@router.get("", status_code=status.HTTP_200_OK)
@router.get("/", status_code=status.HTTP_200_OK)
def list_reports(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve paginated AI workout reports owned by the authenticated user."""
    workout_repo = WorkoutSessionRepository(db)
    report_repo = AIReportRepository(db)

    user_sessions = workout_repo.get_by_user_id(current_user.id, limit=limit)
    session_ids = [s.id for s in user_sessions]

    reports = (
        db.query(AIReport)
        .filter(AIReport.session_id.in_(session_ids))
        .order_by(AIReport.created_at.desc())
        .all()
    ) if session_ids else []

    items = [_serialize_report(r) for r in reports]

    return APIResponse(
        success=True,
        data={
            "items": items,
            "count": len(items)
        }
    )


@router.get("/{id}", status_code=status.HTTP_200_OK)
def get_report_by_id(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a detailed AI report by report ID or session ID."""
    try:
        target_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Report not found."
        )

    report_repo = AIReportRepository(db)

    # Search by report ID or by session ID
    report = report_repo.get_by_id(target_uuid)
    if not report:
        report = report_repo.get_by_session_id(target_uuid)

    if not report or not report.session or report.session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI Report not found."
        )

    return APIResponse(
        success=True,
        data=_serialize_report(report)
    )
