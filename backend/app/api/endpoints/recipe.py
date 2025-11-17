"""Recipe API endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.base import get_db
from app.models.food import Recipe
from app.models.user import User
from app.api.endpoints.auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_recipes(
    language: str = "th",
    category: Optional[str] = None,
    is_vegetarian: Optional[bool] = None,
    is_diabetic_friendly: Optional[bool] = None,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    Get recipes with optional filters.
    """
    query = db.query(Recipe).filter(Recipe.is_published == True)

    if category:
        query = query.filter(Recipe.category == category)
    if is_vegetarian is not None:
        query = query.filter(Recipe.is_vegetarian == is_vegetarian)
    if is_diabetic_friendly is not None:
        query = query.filter(Recipe.is_diabetic_friendly == is_diabetic_friendly)

    total = query.count()
    recipes = query.order_by(Recipe.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "recipes": recipes,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{recipe_id}")
async def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    """Get a single recipe by ID."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )

    # Increment view count
    recipe.view_count += 1
    db.commit()

    return recipe


@router.get("/featured/")
async def get_featured_recipes(
    language: str = "th",
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get featured recipes."""
    recipes = db.query(Recipe).filter(
        Recipe.is_published == True,
        Recipe.is_featured == True
    ).limit(limit).all()

    return {"recipes": recipes}
