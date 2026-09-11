import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

import gym_trainer as gt
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.exercise_metric import ExerciseMetric
from app.models.user import User
from app.models.workout_session import WorkoutSession
from app.repositories.metric_repository import ExerciseMetricRepository
from app.repositories.workout_repository import WorkoutSessionRepository
from app.schemas.auth import APIResponse
from app.schemas.session import StartSessionRequest

router = APIRouter(prefix="/sessions", tags=["Workout Sessions"])


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_workout_session(
    req: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start an authenticated workout session."""
    workout_repo = WorkoutSessionRepository(db)

    session_uuid = None
    if req.session_id:
        try:
            session_uuid = uuid.UUID(req.session_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id UUID format."
            )
    else:
        session_uuid = uuid.uuid4()

    session_id_str = str(session_uuid)

    # Check if session record already exists in DB
    existing = workout_repo.get_by_id(session_uuid)
    if existing:
        if existing.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Session ID already claimed by another user."
            )
        session_entity = existing
    else:
        now = datetime.now(timezone.utc)
        session_entity = WorkoutSession(
            id=session_uuid,
            user_id=current_user.id,
            exercise=req.exercise,
            started_at=now,
            total_reps=0,
            ai_report_generated=False
        )
        workout_repo.create(session_entity)

    # Initialize in-memory CV state
    gt.start_session(
        req.exercise,
        req.target_reps,
        req.target_sets,
        session_id=session_id_str
    )

    started_at_str = (
        session_entity.started_at.isoformat()
        if session_entity.started_at
        else datetime.now(timezone.utc).isoformat()
    )

    return APIResponse(
        success=True,
        message="Workout session started.",
        data={
            "session_id": session_id_str,
            "started_at": started_at_str,
            "exercise": session_entity.exercise
        }
    )


@router.post("/{session_id}/stop", status_code=status.HTTP_200_OK)
async def stop_workout_session_path(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop/complete an authenticated workout session by path session_id."""
    return await _process_end_session(session_id, current_user, db)


@router.post("/stop", status_code=status.HTTP_200_OK)
async def stop_workout_session_body(
    session_id: str = Query(..., description="Session UUID string"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stop/complete an authenticated workout session by query session_id."""
    return await _process_end_session(session_id, current_user, db)


async def _process_end_session(session_id_str: str, current_user: User, db: Session):
    """Helper to finalize workout session, aggregate metrics, and persist to DB."""
    try:
        session_uuid = uuid.UUID(session_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    workout_repo = WorkoutSessionRepository(db)
    session_entity = workout_repo.get_by_id(session_uuid)

    if not session_entity or session_entity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    if session_entity.ended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workout session already completed."
        )

    # Retrieve in-memory CV state
    sess = gt.get_session_state(session_id_str)

    now = datetime.now(timezone.utc)
    started_at = session_entity.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    duration = max(0, int((now - started_at).total_seconds()))

    completed_sets = sess.session.get("completed_sets", [])
    total_reps = sum(s.get("reps", len(s.get("depths", []))) for s in completed_sets)
    if total_reps == 0:
        total_reps = sess.state.get("counter", 0)

    # Calculate form score
    all_depths = []
    for s in completed_sets:
        all_depths.extend(s.get("depths", []))
    avg_form_score = round(float(sum(all_depths) / len(all_depths)), 1) if all_depths else None

    # Build metric entities
    metrics_to_create = []
    rep_counter = 1
    for set_info in completed_sets:
        set_num = set_info.get("set_number", 1)
        depths = set_info.get("depths", [])
        for d in depths:
            metric = ExerciseMetric(
                id=uuid.uuid4(),
                session_id=session_entity.id,
                timestamp=now,
                rep_number=rep_counter,
                stage="complete",
                form_score=float(d),
                correction_message=f"Set {set_num} rep depth score {d:.1f}%"
            )
            metrics_to_create.append(metric)
            rep_counter += 1

    # Atomic DB persistence transaction
    try:
        session_entity.ended_at = now
        session_entity.duration_seconds = duration
        session_entity.total_reps = total_reps
        session_entity.average_form_score = avg_form_score
        session_entity.overall_score = avg_form_score

        db.add(session_entity)
        if metrics_to_create:
            db.add_all(metrics_to_create)
        db.commit()
        db.refresh(session_entity)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist workout session results."
        )

    # Clean up in-memory session
    gt.end_session(session_id_str)

    # Attempt AI report generation AFTER workout completion transaction
    from app.services.ai_service import generate_and_persist_ai_report
    report_id_str = None
    try:
        report = await generate_and_persist_ai_report(db, session_entity, completed_sets)
        report_id_str = str(report.id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception("AI report generation encountered an error; workout remains completed.")

    resp_data = {
        "session_id": session_id_str,
        "exercise": session_entity.exercise,
        "total_reps": total_reps,
        "duration_seconds": duration,
        "average_form_score": avg_form_score,
        "ended_at": now.isoformat()
    }
    if report_id_str:
        resp_data["report_id"] = report_id_str

    return APIResponse(
        success=True,
        message="Workout completed.",
        data=resp_data
    )


@router.get("", status_code=status.HTTP_200_OK)
@router.get("/", status_code=status.HTTP_200_OK)
def get_user_workouts(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve workout session history owned by the authenticated user."""
    workout_repo = WorkoutSessionRepository(db)
    sessions = workout_repo.get_by_user_id(current_user.id, limit=limit)

    items = []
    for s in sessions:
        items.append({
            "id": str(s.id),
            "exercise": s.exercise,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "ended_at": s.ended_at.isoformat() if s.ended_at else None,
            "duration_seconds": s.duration_seconds,
            "total_reps": s.total_reps,
            "average_form_score": s.average_form_score,
            "status": "completed" if s.ended_at else "in_progress"
        })

    return APIResponse(
        success=True,
        data={
            "items": items,
            "count": len(items)
        }
    )


@router.get("/{session_id}", status_code=status.HTTP_200_OK)
def get_workout_session_detail(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve specific workout session details owned by the authenticated user."""
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    workout_repo = WorkoutSessionRepository(db)
    metric_repo = ExerciseMetricRepository(db)

    session_entity = workout_repo.get_by_id(session_uuid)
    if not session_entity or session_entity.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workout session not found."
        )

    metrics = metric_repo.get_by_session_id(session_uuid)

    metric_items = []
    for m in metrics:
        metric_items.append({
            "id": str(m.id),
            "rep_number": m.rep_number,
            "stage": m.stage,
            "form_score": m.form_score,
            "correction_message": m.correction_message,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None
        })

    return APIResponse(
        success=True,
        data={
            "id": str(session_entity.id),
            "exercise": session_entity.exercise,
            "started_at": session_entity.started_at.isoformat() if session_entity.started_at else None,
            "ended_at": session_entity.ended_at.isoformat() if session_entity.ended_at else None,
            "duration_seconds": session_entity.duration_seconds,
            "total_reps": session_entity.total_reps,
            "average_form_score": session_entity.average_form_score,
            "status": "completed" if session_entity.ended_at else "in_progress",
            "metrics": metric_items
        }
    )
