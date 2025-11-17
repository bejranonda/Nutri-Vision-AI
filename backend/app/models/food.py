"""
Food-related models: scans, recipes, ingredients, nutrition scores.
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class FoodScan(Base):
    """Food scan model for storing image recognition results."""

    __tablename__ = "food_scans"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Image information
    image_url = Column(String, nullable=False)
    image_filename = Column(String, nullable=False)
    image_size_bytes = Column(Integer, nullable=True)

    # Recognition results (JSON)
    detected_items = Column(JSON, nullable=True)  # List of detected food items
    confidence_scores = Column(JSON, nullable=True)  # Confidence for each item
    portion_estimates = Column(JSON, nullable=True)  # Estimated portion sizes

    # Nutrition summary
    total_calories = Column(Float, nullable=True)
    total_protein_g = Column(Float, nullable=True)
    total_carbs_g = Column(Float, nullable=True)
    total_fat_g = Column(Float, nullable=True)
    total_fiber_g = Column(Float, nullable=True)

    # 8-Dimension nutrition scores
    blood_sugar_score = Column(Integer, nullable=True)  # 0-100
    gut_health_score = Column(Integer, nullable=True)  # 0-100
    inflammation_score = Column(Integer, nullable=True)  # 0-100
    nutrient_density_score = Column(Integer, nullable=True)  # 0-100
    processing_level_score = Column(Integer, nullable=True)  # 0-100
    protein_quality_score = Column(Integer, nullable=True)  # 0-100
    micronutrient_score = Column(Integer, nullable=True)  # 0-100
    overall_health_score = Column(Integer, nullable=True)  # 0-100

    # Analysis details
    glycemic_load = Column(Float, nullable=True)
    omega3_omega6_ratio = Column(Float, nullable=True)
    nova_classification = Column(Integer, nullable=True)  # 1-4

    # User notes
    meal_type = Column(String, nullable=True)  # breakfast, lunch, dinner, snack
    user_notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="scans")

    def __repr__(self):
        return f"<FoodScan {self.id} by User {self.user_id}>"


class Recipe(Base):
    """Recipe model for Thai and international recipes."""

    __tablename__ = "recipes"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Basic information
    name_th = Column(String, nullable=False, index=True)
    name_en = Column(String, nullable=False, index=True)
    description_th = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)

    # Recipe details
    ingredients = Column(JSON, nullable=False)  # List of ingredients with amounts
    instructions_th = Column(JSON, nullable=False)  # Step-by-step Thai
    instructions_en = Column(JSON, nullable=False)  # Step-by-step English

    # Images
    image_url = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)

    # Cooking information
    prep_time_minutes = Column(Integer, nullable=True)
    cook_time_minutes = Column(Integer, nullable=True)
    total_time_minutes = Column(Integer, nullable=True)
    servings = Column(Integer, default=1)
    difficulty = Column(String, nullable=True)  # easy, medium, hard

    # Categories
    cuisine = Column(String, index=True)  # thai, international
    category = Column(String, index=True)  # main_dish, soup, salad, dessert, etc.
    tags = Column(JSON, nullable=True)  # ["quick", "spicy", "healthy", etc.]

    # Dietary filters
    is_vegetarian = Column(Boolean, default=False)
    is_vegan = Column(Boolean, default=False)
    is_halal = Column(Boolean, default=False)
    is_gluten_free = Column(Boolean, default=False)
    is_dairy_free = Column(Boolean, default=False)
    is_diabetic_friendly = Column(Boolean, default=False)
    is_low_carb = Column(Boolean, default=False)

    # Nutrition per serving
    calories_per_serving = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)
    sugar_g = Column(Float, nullable=True)
    sodium_mg = Column(Float, nullable=True)

    # 8-Dimension nutrition scores
    blood_sugar_score = Column(Integer, nullable=True)
    gut_health_score = Column(Integer, nullable=True)
    inflammation_score = Column(Integer, nullable=True)
    nutrient_density_score = Column(Integer, nullable=True)
    processing_level_score = Column(Integer, nullable=True)
    protein_quality_score = Column(Integer, nullable=True)
    micronutrient_score = Column(Integer, nullable=True)
    overall_health_score = Column(Integer, nullable=True)

    # Popularity & ratings
    view_count = Column(Integer, default=0)
    favorite_count = Column(Integer, default=0)
    average_rating = Column(Float, nullable=True)

    # Status
    is_published = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)

    # Source
    source = Column(String, nullable=True)  # "admin", "community", "ai_generated"
    author_name = Column(String, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    favorites = relationship("FavoriteRecipe", back_populates="recipe", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Recipe {self.name_en}>"


class Ingredient(Base):
    """Ingredient database for nutrition lookup."""

    __tablename__ = "ingredients"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Names
    name_th = Column(String, nullable=False, index=True)
    name_en = Column(String, nullable=False, index=True)
    alternative_names = Column(JSON, nullable=True)  # Alternative names/spellings

    # Category
    category = Column(String, index=True)  # vegetable, fruit, protein, grain, etc.
    is_thai_ingredient = Column(Boolean, default=False)

    # Nutrition per 100g
    calories = Column(Float, nullable=True)
    protein_g = Column(Float, nullable=True)
    carbs_g = Column(Float, nullable=True)
    fat_g = Column(Float, nullable=True)
    fiber_g = Column(Float, nullable=True)
    sugar_g = Column(Float, nullable=True)

    # Vitamins (% RDI per 100g)
    vitamin_a = Column(Float, nullable=True)
    vitamin_c = Column(Float, nullable=True)
    vitamin_d = Column(Float, nullable=True)
    vitamin_e = Column(Float, nullable=True)
    vitamin_k = Column(Float, nullable=True)
    vitamin_b12 = Column(Float, nullable=True)
    folate = Column(Float, nullable=True)

    # Minerals (% RDI per 100g)
    calcium = Column(Float, nullable=True)
    iron = Column(Float, nullable=True)
    magnesium = Column(Float, nullable=True)
    potassium = Column(Float, nullable=True)
    zinc = Column(Float, nullable=True)

    # Special properties
    glycemic_index = Column(Integer, nullable=True)
    omega3_mg = Column(Float, nullable=True)
    omega6_mg = Column(Float, nullable=True)
    is_prebiotic = Column(Boolean, default=False)
    is_probiotic = Column(Boolean, default=False)
    antioxidant_orac = Column(Float, nullable=True)

    # Common Thai measurements
    tablespoon_weight_g = Column(Float, nullable=True)  # ช้อนโต๊ะ
    cup_weight_g = Column(Float, nullable=True)  # ถ้วย

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Ingredient {self.name_en}>"


class FavoriteRecipe(Base):
    """User's favorite recipes."""

    __tablename__ = "favorite_recipes"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False, index=True)

    # User notes
    notes = Column(Text, nullable=True)
    user_rating = Column(Integer, nullable=True)  # 1-5 stars

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="favorite_recipes")
    recipe = relationship("Recipe", back_populates="favorites")

    def __repr__(self):
        return f"<FavoriteRecipe User {self.user_id} Recipe {self.recipe_id}>"
