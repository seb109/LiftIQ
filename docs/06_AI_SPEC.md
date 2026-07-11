# LiftIQ AI Specification

**Version:** 1.0
**Status:** Production MVP

---

# 1. Purpose

This document defines the Artificial Intelligence architecture used throughout LiftIQ.

The AI system consists of two independent layers:

1. Computer Vision Engine
2. AI Coaching Engine

These layers must remain loosely coupled.

The Computer Vision Engine extracts objective workout data.

The AI Coaching Engine interprets that data and produces personalized coaching.

---

# 2. AI Architecture

```
User

↓

Webcam

↓

MediaPipe

↓

Landmarks

↓

Joint Angle Calculator

↓

Exercise Detection

↓

Rep Counter

↓

Form Analysis

↓

Workout Metrics

↓

Groq LLM

↓

Structured JSON Report

↓

Frontend Dashboard
```

The LLM must **never** receive raw images or video.

Only structured numerical workout data should be sent.

---

# 3. AI Responsibilities

The AI Coach is responsible for:

* Summarizing the workout
* Explaining strengths
* Identifying mistakes
* Prioritizing improvements
* Suggesting the next training focus
* Providing encouraging feedback

The AI is **not** responsible for:

* Rep counting
* Exercise detection
* Joint angle calculations
* Pose estimation

Those belong to the Computer Vision Engine.

---

# 4. Supported Exercises (MVP)

The MVP supports:

* Squat
* Push-up
* Deadlift
* Shoulder Press
* Bicep Curl
* Lunge

Each exercise has independent rule-based validation before AI summarization.

---

# 5. Computer Vision Pipeline

The Computer Vision Engine performs:

* Pose detection
* Landmark extraction
* Joint angle calculation
* Exercise classification
* Stage detection
* Rep counting
* Live correction generation
* Metric aggregation

Output:

Structured workout metrics.

---

# 6. Metrics Sent to the AI

The LLM receives structured data only.

Example:

```json
{
  "exercise": "Squat",
  "duration_seconds": 412,
  "total_reps": 24,
  "average_form_score": 91,
  "overall_score": 89,
  "average_rep_duration": 3.4,
  "correction_count": 5,
  "top_corrections": [
    "Keep chest up",
    "Go deeper"
  ]
}
```

The payload should contain no personally identifiable information.

---

# 7. Prompt Engineering Principles

Every prompt must:

* Be deterministic where practical.
* Request JSON only.
* Avoid markdown output.
* Avoid conversational formatting.
* Avoid unnecessary verbosity.
* Focus on actionable coaching.

Never request HTML.

Never request tables.

Never request formatted text.

---

# 8. Expected AI Response

The AI must always return valid JSON.

Example:

```json
{
  "overall_score": 90,
  "form_score": 88,
  "strengths": [
    "Excellent squat depth",
    "Good repetition consistency"
  ],
  "mistakes": [
    "Chest leaned forward during ascent"
  ],
  "improvements": [
    "Brace your core before every repetition"
  ],
  "coach_summary": "You maintained consistent form throughout most of the workout. Focus on keeping your chest higher during the upward phase.",
  "next_session_focus": "Maintain an upright torso.",
  "motivation": "Great progress. Keep building consistency."
}
```

Free-form text responses should be treated as invalid.

---

# 9. AI Output Validation

Before storing the response:

* Validate JSON.
* Validate required fields.
* Validate score ranges.
* Validate array types.

If validation fails:

* Retry once.
* Log the failure.
* Fall back to a predefined report template.

The user should never see a parsing error.

---

# 10. AI Scoring

Scores range from:

0–100

Metrics include:

* Overall Score
* Form Score

Future versions may add:

* Stability Score
* Tempo Score
* Range of Motion Score
* Consistency Score

---

# 11. Prompt Inputs

The LLM should receive:

* Exercise
* Workout duration
* Total repetitions
* Overall score
* Form score
* Correction frequency
* Common correction messages

Avoid sending unnecessary raw telemetry.

---

# 12. Hallucination Prevention

The AI must not:

* Invent injuries.
* Diagnose medical conditions.
* Recommend medication.
* Promise performance improvements.
* Give unsafe advice.

Recommendations must stay within general exercise coaching.

---

# 13. Error Handling

Possible failures:

* API timeout
* Rate limit
* Invalid JSON
* Empty response
* Network failure

Recovery strategy:

1. Retry once.
2. Log the error.
3. Return fallback coaching.
4. Allow report generation to complete.

The workout session must never fail because the AI failed.

---

# 14. Performance Targets

Target response time:

< 5 seconds

Prompt size should remain compact.

Avoid sending repetitive data.

---

# 15. Security

Never send:

* Passwords
* Email addresses
* JWTs
* Database IDs
* Secrets

The AI receives workout metrics only.

---

# 16. Logging

Log:

* Prompt version
* Model name
* Response time
* Success/failure
* Token usage (if available)

Never log secrets or access tokens.

---

# 17. AI Versioning

Prompt templates should be versioned.

Example:

* Prompt v1
* Prompt v2

Reports should record which prompt version generated them.

---

# 18. Future Enhancements

Not part of the MVP:

* Voice coaching
* Personalized workout plans
* Exercise recommendations
* Fatigue estimation
* Weekly AI summaries
* Long-term trend analysis
* Multi-language coaching

---

# 19. Acceptance Criteria

The AI layer is complete when:

* Existing Groq integration is preserved.
* Structured workout metrics are passed to the LLM.
* Responses are valid JSON.
* Reports are stored successfully.
* Invalid responses are handled gracefully.
* Users always receive a coaching report.
* Prompt templates are versioned.
* Logging captures AI request outcomes.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_