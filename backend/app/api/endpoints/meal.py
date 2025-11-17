"""Meal planning API endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from typing import Optional

from app.db.base import get_db
from app.models.user import User
from app.models.meal import MealPlan
from app.api.endpoints.auth import get_current_user

router = APIRouter()


class MealPlanCreate(BaseModel):
    plan_date: date
    breakfast: Optional[dict] = None
    lunch: Optional[dict] = None
    dinner: Optional[dict] = None
    snacks: Optional[dict] = None


@router.get("/plans")
async def get_meal_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's meal plans."""
    plans = db.query(MealPlan).filter(
        MealPlan.user_id == current_user.id
    ).order_by(MealPlan.plan_date.desc()).limit(30).all()

    return {"plans": plans}


@router.post("/plans")
async def create_meal_plan(
    plan: MealPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new meal plan."""
    meal_plan = MealPlan(
        user_id=current_user.id,
        plan_date=plan.plan_date,
        breakfast=plan.breakfast,
        lunch=plan.lunch,
        dinner=plan.dinner,
        snacks=plan.snacks
    )

    db.add(meal_plan)
    db.commit()
    db.refresh(meal_plan)

    return meal_plan
