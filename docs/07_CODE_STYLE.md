# LiftIQ Code Style & Engineering Standards

**Version:** 1.0
**Status:** Mandatory

---

# 1. Purpose

This document defines the coding standards for LiftIQ.

Every engineer and AI coding agent must follow these rules.

These standards exist to ensure:

* Readability
* Maintainability
* Scalability
* Consistency
* Low technical debt

Code quality is a product feature.

---

# 2. General Principles

Code should be:

* Simple
* Predictable
* Modular
* Testable
* Typed
* Self-documenting

Avoid clever code.

Prefer explicit code over implicit behavior.

Optimize for the next engineer reading the code.

---

# 3. Naming Conventions

## Variables

Use descriptive names.

Good:

```python
average_form_score
current_session
rep_counter
```

Avoid:

```python
a
temp
data1
value
```

---

## Functions

Use verbs.

Examples:

```python
create_session()

calculate_joint_angles()

generate_ai_report()

count_repetition()

update_dashboard()
```

---

## Classes

Use PascalCase.

Examples:

```python
WorkoutService

SessionRepository

AIReportGenerator

AuthService
```

---

## Constants

Uppercase.

```python
MAX_RETRIES

DEFAULT_TIMEOUT

JWT_EXPIRATION_MINUTES
```

---

## Files

Use snake_case for Python.

Use kebab-case or feature folders for frontend where appropriate.

Examples:

```
auth_service.py

session_repository.py

dashboard-card.tsx
```

---

# 4. Function Standards

Maximum function length:

**60 lines**

Target:

20–40 lines.

Functions should have one responsibility.

If a function requires multiple sections or extensive comments, split it.

---

# 5. File Size

Target:

< 300 lines

Maximum:

500 lines

If a file exceeds 500 lines, refactor into smaller modules.

---

# 6. Class Size

Prefer composition over large classes.

A class should represent one responsibility.

Avoid "God classes."

---

# 7. API Route Rules

API routes should:

* Validate input
* Authenticate user
* Call service layer
* Return response

API routes must not:

* Query the database directly
* Contain business logic
* Call Groq directly
* Perform heavy calculations

---

# 8. Service Layer Rules

Services coordinate business logic.

Services may:

* Call repositories
* Call AI services
* Aggregate data
* Enforce business rules

Services should not:

* Return HTTP responses
* Access request objects
* Render UI

---

# 9. Repository Rules

Repositories manage persistence only.

Allowed:

* CRUD
* Queries
* Pagination
* Transactions

Forbidden:

* AI prompting
* Business decisions
* Validation unrelated to persistence

---

# 10. Frontend Standards

Pages should remain lightweight.

Business logic belongs in:

* hooks
* feature modules
* services

Avoid placing complex logic directly in page components.

Components should receive data through props and callbacks whenever practical.

---

# 11. React Guidelines

Prefer:

* Functional components
* Hooks
* Composition

Avoid:

* Class components
* Deep prop drilling
* Unnecessary state

Memoize only when profiling indicates a benefit.

---

# 12. TypeScript

Avoid `any`.

Prefer:

* Interfaces
* Type aliases
* Explicit return types for exported functions

Shared API types should live in a common location.

---

# 13. Error Handling

Errors should be:

* Logged
* User-friendly
* Recoverable when possible

Never swallow exceptions silently.

Never expose stack traces to users.

---

# 14. Logging

Use structured logging.

Include:

* Timestamp
* Log level
* Context
* Correlation ID (when applicable)

Do not log:

* Passwords
* Tokens
* Secrets
* Sensitive user data

---

# 15. Comments

Write comments only when they explain *why*, not *what*.

Bad:

```python
# Increment rep count
rep_count += 1
```

Good:

```python
# Ignore transient pose fluctuations to reduce false-positive repetitions.
```

---

# 16. Formatting

Backend:

* Black
* Ruff (or equivalent)
* isort

Frontend:

* Prettier
* ESLint

Formatting should be automated where possible.

---

# 17. Imports

Order:

1. Standard library
2. Third-party packages
3. Internal modules

Remove unused imports.

Avoid wildcard imports.

---

# 18. Configuration

Never hardcode:

* API keys
* URLs
* Secrets
* Credentials

All configuration must come from environment variables.

---

# 19. Git Standards

Commit messages:

```
feat: add workout history

fix: correct rep counting bug

refactor: simplify auth service

docs: update API specification

test: add report service tests
```

Commit only working code.

Avoid committing generated artifacts or secrets.

---

# 20. Testing Expectations

Every new feature should include tests where practical.

Minimum coverage for critical paths:

* Authentication
* Workout lifecycle
* AI report generation
* Dashboard aggregation

Tests should be deterministic and independent.

---

# 21. Performance Guidelines

Avoid:

* Duplicate API requests
* N+1 database queries
* Blocking operations on request threads
* Unnecessary re-renders

Profile before optimizing.

---

# 22. Accessibility

UI should support:

* Keyboard navigation
* Sufficient color contrast
* Meaningful labels
* Screen-reader friendly controls where applicable

Accessibility is part of quality, not an optional enhancement.

---

# 23. Security

Validate all input.

Use parameterized database queries.

Escape user-generated content.

Enforce authentication and authorization consistently.

Never trust client-side validation alone.

---

# 24. Refactoring Rules

Refactor only when it provides measurable value.

Preserve existing behavior.

Avoid mixing refactoring with unrelated feature work in the same change.

---

# 25. Definition of Good Code

Good code is:

* Easy to read
* Easy to test
* Easy to extend
* Easy to debug
* Consistent with the rest of the project

The best solution is not necessarily the shortest—it is the one that future contributors can understand and maintain with confidence.
---

## Document Control

**Status:** Active

**Approval Required For Changes:** Yes

**Next Review:** After MVP Release

**Maintainer:** Joel Sebastian

---

_End of Document_