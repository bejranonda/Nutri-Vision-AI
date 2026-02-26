"""Food scanning API endpoints."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import os
import uuid

from app.db.base import get_db
from app.models.user import User
from app.models.food import FoodScan
from app.api.endpoints.auth import get_current_user
from app.services.gemini_service import gemini_service
from app.services.nutrition_scorer import nutrition_scorer
from app.core.config import settings

import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class ScanResponse(BaseModel):
    id: int
    detected_items: list
    nutrition_summary: dict
    scores: dict
    image_url: str

    class Config:
        from_attributes = True


@router.post("/analyze", response_model=ScanResponse)
async def analyze_food_image(
    file: UploadFile = File(...),
    language: str = "th",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze a food image using AI.
    Detects ingredients and calculates nutrition scores.
    """
    # Check usage limits
    if not current_user.can_scan:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scan limit reached. Please upgrade to premium."
        )

    # Validate file type
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(settings.ALLOWED_IMAGE_TYPES)}"
        )

    # Save uploaded file
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        # Analyze with Gemini AI
        logger.info(f"Starting food analysis for user {current_user.id} with image {unique_filename}")
        analysis = await gemini_service.analyze_food_image(file_path, language)
        logger.info(f"Gemini analysis complete for {unique_filename}")

        # Calculate nutrition scores
        nutrition_data = analysis.get("nutrition_summary", {})
        ingredients = analysis.get("ingredients", [])
        
        logger.info(f"Calculating nutrition scores for {unique_filename}")
        scores = nutrition_scorer.calculate_all_scores(nutrition_data, ingredients)
        logger.info(f"Nutrition scores calculated for {unique_filename}")

        # Create scan record
        scan = FoodScan(
            user_id=current_user.id,
            image_url=f"/uploads/{unique_filename}",
            image_filename=unique_filename,
            detected_items=analysis.get("detected_items", []),
            total_calories=nutrition_data.get("total_calories"),
            total_protein_g=nutrition_data.get("protein_g"),
            total_carbs_g=nutrition_data.get("carbs_g"),
            total_fat_g=nutrition_data.get("fat_g"),
            total_fiber_g=nutrition_data.get("fiber_g"),
            blood_sugar_score=scores["blood_sugar_score"],
            gut_health_score=scores["gut_health_score"],
            inflammation_score=scores["inflammation_score"],
            nutrient_density_score=scores["nutrient_density_score"],
            processing_level_score=scores["processing_level_score"],
            protein_quality_score=scores["protein_quality_score"],
            micronutrient_score=scores["micronutrient_score"],
            overall_health_score=scores["overall_health_score"],
        )

        db.add(scan)

        # Update user usage
        current_user.monthly_scans += 1
        current_user.total_scans += 1
        current_user.last_scan_date = datetime.utcnow()

        db.commit()
        db.refresh(scan)
        
        logger.info(f"Scan record created (ID: {scan.id}) for user {current_user.id}")

        return {
            "id": scan.id,
            "detected_items": scan.detected_items,
            "nutrition_summary": nutrition_data,
            "scores": scores,
            "image_url": scan.image_url
        }

    except Exception as e:
        logger.error(f"Analysis failed for {unique_filename}: {str(e)}", exc_info=True)
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/history")
async def get_scan_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's scan history."""
    scans = db.query(FoodScan).filter(
        FoodScan.user_id == current_user.id
    ).order_by(FoodScan.created_at.desc()).limit(limit).all()

    return {"scans": scans, "total": len(scans)}
