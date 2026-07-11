# LiftIQ API Specification

**Version:** 1.0
**Status:** MVP

---

# 1. Purpose

This document defines the REST API contract for LiftIQ.

The API contract is the single source of truth between the frontend and backend.

Every endpoint must follow this specification.

Breaking API changes are prohibited unless the version is incremented.

---

# 2. API Principles

The API must be:

* RESTful
* Stateless
* Versioned
* Secure
* Predictable
* Typed
* Documented

Base URL:

```
/api/v1
```

---

# 3. Response Format

## Success

```json
{
  "success": true,
  "message": "Workout created successfully.",
  "data": {}
}
```

---

## Error

```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Workout session does not exist."
  }
}
```

---

# 4. Authentication

Authentication uses JWT.

Headers:

```
Authorization: Bearer <access_token>
```

Protected endpoints require a valid access token.

Refresh tokens must never be accepted as access tokens.

---

# 5. Authentication Endpoints

## POST /auth/register

### Description

Create a new user account.

### Request

```json
{
  "name": "Joel Sebastian",
  "email": "joel@example.com",
  "password": "StrongPassword123!"
}
```

### Response

```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "user": {
      "id": "uuid",
      "name": "Joel Sebastian",
      "email": "joel@example.com"
    }
  }
}
```

---

## POST /auth/login

### Request

```json
{
  "email": "joel@example.com",
  "password": "StrongPassword123!"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "name": "Joel Sebastian",
      "email": "joel@example.com"
    }
  }
}
```

---

## POST /auth/refresh

Returns a new access token.

---

## POST /auth/logout

Revokes the current refresh token.

---

# 6. User Endpoints

## GET /users/me

Returns the authenticated user's profile.

### Response

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Joel Sebastian",
    "email": "joel@example.com",
    "joined_at": "2026-07-11T10:00:00Z",
    "stats": {
      "total_sessions": 42,
      "current_streak": 8,
      "average_form_score": 89
    }
  }
}
```

---

## PUT /users/me

Updates profile details.

Editable fields:

* Name
* Avatar
* Preferences

---

# 7. Workout Session Endpoints

## POST /sessions/start

Creates a workout session.

### Request

```json
{
  "exercise": "squat"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "started_at": "timestamp"
  }
}
```

---

## POST /sessions/{id}/stop

Stops the workout.

The backend must:

* calculate duration
* finalize metrics
* trigger AI report generation
* persist results

### Response

```json
{
  "success": true,
  "message": "Workout completed.",
  "data": {
    "session_id": "uuid",
    "report_id": "uuid"
  }
}
```

---

## GET /sessions

Returns paginated workout history.

Query Parameters:

* page
* limit
* exercise
* sort

---

## GET /sessions/{id}

Returns full workout details.

---

## DELETE /sessions/{id}

Deletes a workout session.

---

# 8. Posture Endpoints

## POST /posture/analyze

Receives a frame or pose payload.

Returns:

* posture score
* detected exercise
* repetition state
* correction message
* joint metrics

Example Response:

```json
{
  "success": true,
  "data": {
    "exercise": "Squat",
    "rep_count": 12,
    "stage": "Down",
    "form_score": 91,
    "correction": "Keep your chest up.",
    "angles": {
      "left_knee": 96,
      "right_knee": 94
    }
  }
}
```

---

## GET /posture/live

Returns the live stream URL or connection metadata required by the frontend.

---

# 9. Report Endpoints

## GET /reports

Returns paginated reports.

Supports:

* page
* limit
* exercise
* date range

---

## GET /reports/{id}

Returns a detailed AI workout report.

Example:

```json
{
  "success": true,
  "data": {
    "overall_score": 92,
    "form_score": 89,
    "strengths": [
      "Excellent squat depth"
    ],
    "mistakes": [
      "Chest leaned forward"
    ],
    "improvements": [
      "Keep your core braced"
    ],
    "coach_summary": "...",
    "next_session_focus": "...",
    "generated_at": "timestamp"
  }
}
```

---

## POST /reports/generate

Generates an AI report manually for a completed session.

Normally this is triggered automatically after session completion.

---

# 10. Dashboard Endpoint

## GET /dashboard

Returns all dashboard data in a single request.

This endpoint should aggregate multiple data sources to reduce frontend API calls.

Example response:

```json
{
  "success": true,
  "data": {
    "current_streak": 7,
    "total_sessions": 36,
    "average_form_score": 91,
    "weekly_sessions": 5,
    "recent_sessions": [],
    "chart_data": [],
    "ai_tip": "Maintain a slower eccentric phase."
  }
}
```

---

# 11. Health Endpoints

## GET /health

Returns application health.

Example:

```json
{
  "status": "healthy"
}
```

---

## GET /version

Returns:

* API version
* application version
* build information

---

# 12. Status Codes

Use standard HTTP status codes.

| Status | Meaning               |
| ------ | --------------------- |
| 200    | Success               |
| 201    | Created               |
| 204    | No Content            |
| 400    | Bad Request           |
| 401    | Unauthorized          |
| 403    | Forbidden             |
| 404    | Not Found             |
| 409    | Conflict              |
| 422    | Validation Error      |
| 429    | Too Many Requests     |
| 500    | Internal Server Error |

---

# 13. Validation Rules

Requests must be validated using Pydantic v2.

Examples:

Email:

* Valid format
* Maximum length

Password:

* Minimum 8 characters
* Uppercase
* Lowercase
* Number
* Special character

Exercise:

* Must be one of the supported exercises

---

# 14. Pagination

List endpoints should support:

* page
* limit
* total
* total_pages

Example:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "limit": 10,
    "total": 42,
    "total_pages": 5
  }
}
```

---

# 15. Versioning

Current API version:

```
v1
```

Future breaking changes require a new version (for example, `/api/v2`).

---

# 16. Acceptance Criteria

The API specification is complete when:

* Every frontend feature has a corresponding endpoint.
* Every endpoint has request and response schemas.
* Error responses are standardized.
* Authentication is documented.
* Validation rules are defined.
* Pagination is standardized.
* Status codes are consistent.
* Swagger/OpenAPI documentation matches this specification.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_