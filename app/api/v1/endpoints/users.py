from fastapi import APIRouter, Depends, status
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.auth import APIResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", status_code=status.HTTP_200_OK)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Return authenticated user profile."""
    return APIResponse(
        success=True,
        data={
            "id": str(current_user.id),
            "name": current_user.name,
            "email": current_user.email,
            "joined_at": current_user.created_at.isoformat()
        }
    )
