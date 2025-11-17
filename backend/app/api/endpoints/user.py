"""User profile API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db.base import get_db
from app.models.user import User, UserGoal, ActivityLevel
from app.api.endpoints.auth import get_current_user

router = APIRouter()


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    language: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    target_weight_kg: Optional[float] = None
    goal: Optional[str] = None
    activity_level: Optional[str] = None
    dietary_restrictions: Optional[str] = None
    allergies: Optional[str] = None


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "language": current_user.language,
        "subscription_tier": current_user.subscription_tier,
        "age": current_user.age,
        "gender": current_user.gender,
        "height_cm": current_user.height_cm,
        "weight_kg": current_user.weight_kg,
        "bmi": current_user.bmi,
        "goal": current_user.goal,
        "activity_level": current_user.activity_level,
        "monthly_scans": current_user.monthly_scans,
        "monthly_chat_messages": current_user.monthly_chat_messages,
        "is_premium": current_user.is_premium,
    }


@router.put("/profile")
async def update_profile(
    profile: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile."""
    update_data = profile.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return {"message": "Profile updated successfully", "user": current_user}
