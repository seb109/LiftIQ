"""Custom application exceptions."""


class LiftIQException(Exception):
    """Base exception for LiftIQ application."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationException(LiftIQException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)


class AuthorizationException(LiftIQException):
    """Raised when user lacks required permissions."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, status_code=403)


class ResourceNotFoundException(LiftIQException):
    """Raised when a requested resource is not found."""

    def __init__(self, resource: str, resource_id: str = ""):
        message = f"{resource} not found"
        if resource_id:
            message += f" (ID: {resource_id})"
        super().__init__(message, status_code=404)


class ValidationException(LiftIQException):
    """Raised when validation fails."""

    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status_code=422)


class DuplicateResourceException(LiftIQException):
    """Raised when attempting to create a duplicate resource."""

    def __init__(self, resource: str, field: str = ""):
        message = f"{resource} already exists"
        if field:
            message += f" ({field})"
        super().__init__(message, status_code=409)


class AIServiceException(LiftIQException):
    """Raised when AI service (Groq) fails."""

    def __init__(self, message: str = "AI service unavailable"):
        super().__init__(message, status_code=503)


class PostureAnalysisException(LiftIQException):
    """Raised when posture analysis fails."""

    def __init__(self, message: str = "Posture analysis failed"):
        super().__init__(message, status_code=500)
