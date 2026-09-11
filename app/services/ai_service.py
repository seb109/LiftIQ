import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from ai_trainer import client as groq_client
from app.models.ai_report import AIReport
from app.models.workout_session import WorkoutSession
from app.repositories.ai_report_repository import AIReportRepository
from app.schemas.report import AIReportStructuredSchema

logger = logging.getLogger(__name__)

MODEL_NAME = "llama-3.1-8b-instant"


def build_compact_workout_input(
    session: WorkoutSession,
    completed_sets: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Constructs a compact, structured representation of completed workout metrics."""
    sets_data = []
    if completed_sets:
        for s in completed_sets:
            depths = s.get("depths", [])
            rep_times = s.get("rep_times", [])
            avg_d = round(sum(depths) / len(depths), 1) if depths else 0.0
            avg_t = round(sum(rep_times) / len(rep_times), 1) if rep_times else 0.0
            sets_data.append({
                "set_number": s.get("set_number", 1),
                "reps": s.get("reps", len(depths)),
                "avg_depth_score": avg_d,
                "avg_rep_time_seconds": avg_t
            })

    avg_score = float(session.average_form_score or 85.0)
    overall = float(session.overall_score or avg_score)

    return {
        "exercise": session.exercise,
        "total_reps": session.total_reps,
        "duration_seconds": session.duration_seconds or 0,
        "average_form_score": avg_score,
        "overall_score": overall,
        "completed_sets": sets_data
    }


def generate_fallback_report(workout_data: Dict[str, Any]) -> AIReportStructuredSchema:
    """Generates a safe, deterministic, metric-grounded report when AI provider fails."""
    exercise = workout_data.get("exercise", "workout")
    total_reps = workout_data.get("total_reps", 0)
    avg_score = float(workout_data.get("average_form_score", 85.0))
    overall = float(workout_data.get("overall_score", avg_score))

    return AIReportStructuredSchema(
        overall_score=overall,
        form_score=avg_score,
        strengths=[
            f"Successfully completed {total_reps} reps of {exercise}.",
            "Maintained workout structure throughout the session."
        ],
        mistakes=[
            "Form depth varied slightly on final repetitions."
        ],
        improvements=[
            "Focus on maintaining a steady tempo and full range of motion."
        ],
        coach_summary=f"Solid session completing {total_reps} reps of {exercise} with an average form score of {avg_score:.1f}%. Keep up the consistent work.",
        next_session_focus="Maintain an upright torso and steady rep pace.",
        motivation="Great effort! Consistency is key to progress."
    )


def format_report_markdown(exercise: str, structured: AIReportStructuredSchema) -> str:
    """Formats structured AI report into clean GitHub-style Markdown."""
    strengths_md = "\n".join(f"- {s}" for s in structured.strengths) or "- Solid rep execution."
    mistakes_md = "\n".join(f"- {m}" for m in structured.mistakes) or "- Minor depth variance."
    improvements_md = "\n".join(f"- {i}" for i in structured.improvements) or "- Maintain steady pace."

    return f"""# AI Workout Report: {exercise.capitalize()}

**Overall Score:** {structured.overall_score:.0f}/100 | **Form Score:** {structured.form_score:.0f}/100

## 🎯 Coach Summary
{structured.coach_summary}

## 💪 Strengths
{strengths_md}

## ⚠️ Areas for Improvement
{mistakes_md}

## 💡 Recommendations
{improvements_md}

## 📌 Next Session Focus
{structured.next_session_focus}

## 🔥 Motivation
{structured.motivation}
"""


async def generate_structured_ai_report(workout_data: Dict[str, Any]) -> AIReportStructuredSchema:
    """Sends compact workout data to Groq LLM and validates structured output with 1 retry."""
    system_prompt = (
        "You are a professional AI fitness coach analyzing completed workout metrics.\n"
        "Return ONLY a raw JSON object matching this schema without markdown codeblocks or extra text:\n"
        "{\n"
        '  "overall_score": float (0-100),\n'
        '  "form_score": float (0-100),\n'
        '  "strengths": [string],\n'
        '  "mistakes": [string],\n'
        '  "improvements": [string],\n'
        '  "coach_summary": string,\n'
        '  "next_session_focus": string,\n'
        '  "motivation": string\n'
        "}\n"
        "Requirements:\n"
        "- Base feedback ONLY on provided workout metrics.\n"
        "- Do NOT diagnose injuries or make medical claims.\n"
        "- Keep coaching actionable, specific, and encouraging."
    )

    user_prompt = f"Workout Data:\n{json.dumps(workout_data, indent=2)}"

    # Check API Key
    if not os.getenv("GROQ_API_KEY"):
        logger.warning("GROQ_API_KEY is missing. Using safe fallback report.")
        return generate_fallback_report(workout_data)

    # Attempt 1
    try:
        completion = await groq_client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.3
        )
        content = completion.choices[0].message.content
        return AIReportStructuredSchema.model_validate_json(content)
    except Exception as err1:
        logger.warning("Groq AI generation Attempt 1 failed/invalid. Retrying once: %s", type(err1).__name__)

    # Attempt 2 (Retry 1 with stricter prompt)
    try:
        retry_system_prompt = (
            system_prompt + "\nCRITICAL: Your previous response was invalid. "
            "Respond ONLY with valid JSON matching the specified key names."
        )
        completion2 = await groq_client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": retry_system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            max_tokens=500,
            temperature=0.2
        )
        content2 = completion2.choices[0].message.content
        return AIReportStructuredSchema.model_validate_json(content2)
    except Exception as err2:
        logger.warning("Groq AI generation Attempt 2 failed/invalid (%s). Using safe fallback.", type(err2).__name__)

    return generate_fallback_report(workout_data)


async def generate_and_persist_ai_report(
    db: Session,
    session: WorkoutSession,
    completed_sets: Optional[List[Dict[str, Any]]] = None
) -> AIReport:
    """Idempotently generates and persists an AIReport for a completed WorkoutSession."""
    report_repo = AIReportRepository(db)

    # Idempotency check: return existing report if present
    existing = report_repo.get_by_session_id(session.id)
    if existing:
        return existing

    workout_data = build_compact_workout_input(session, completed_sets)
    structured = await generate_structured_ai_report(workout_data)

    markdown_content = format_report_markdown(session.exercise, structured)
    now = datetime.now(timezone.utc)

    report_entity = AIReport(
        id=uuid.uuid4(),
        session_id=session.id,
        overall_score=structured.overall_score,
        form_score=structured.form_score,
        strengths=structured.strengths,
        mistakes=structured.mistakes,
        improvements=structured.improvements,
        coach_summary=structured.coach_summary,
        next_session_focus=structured.next_session_focus,
        motivation=structured.motivation,
        raw_response=structured.model_dump(),
        created_at=now
    )

    try:
        report_repo.create(report_entity)
        session.ai_report_generated = True
        db.commit()
        db.refresh(report_entity)
    except Exception:
        db.rollback()
        logger.exception("Failed to persist AIReport for session %s", session.id)
        raise

    return report_entity
