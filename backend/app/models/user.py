"""
User models for authentication and profile management.
"""
from datetime import datetime
from enum import Enum
from sqlalchemy import Boolean, Column, String, Integer, DateTime, Float, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import Base


class SubscriptionTier(str, Enum):
    """Subscription tier enumeration."""
    FREE = "free"
    PREMIUM = "premium"
    FAMILY = "family"


class UserGoal(str, Enum):
    """User health goal enumeration."""
    WEIGHT_LOSS = "weight_loss"
    WEIGHT_GAIN = "weight_gain"
    MAINTENANCE = "maintenance"
    MUSCLE_GAIN = "muscle_gain"
    HEALTH_IMPROVEMENT = "health_improvement"
    DIABETES_MANAGEMENT = "diabetes_management"


class ActivityLevel(str, Enum):
    """User activity level enumeration."""
    SEDENTARY = "sedentary"
    LIGHTLY_ACTIVE = "lightly_active"
    MODERATELY_ACTIVE = "moderately_active"
    VERY_ACTIVE = "very_active"
    EXTREMELY_ACTIVE = "extremely_active"


class User(Base):
    """User model for authentication and profile."""

    __tablename__ = "users"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Authentication
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth users
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_superuser = Column(Boolean, default=False)

    # OAuth providers
    google_id = Column(String, unique=True, index=True, nullable=True)
    line_id = Column(String, unique=True, index=True, nullable=True)
    facebook_id = Column(String, unique=True, index=True, nullable=True)

    # Profile information
    full_name = Column(String, nullable=True)
    display_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)

    # Preferences
    language = Column(String, default="th")  # th or en
    timezone = Column(String, default="Asia/Bangkok")

    # Subscription
    subscription_tier = Column(
        SQLEnum(SubscriptionTier),
        default=SubscriptionTier.FREE,
        nullable=False
    )
    subscription_start_date = Column(DateTime, nullable=True)
    subscription_end_date = Column(DateTime, nullable=True)

    # Usage tracking
    monthly_scans = Column(Integer, default=0)
    monthly_chat_messages = Column(Integer, default=0)
    total_scans = Column(Integer, default=0)
    total_chat_messages = Column(Integer, default=0)
    last_scan_date = Column(DateTime, nullable=True)
    usage_reset_date = Column(DateTime, nullable=True)

    # Physical information
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # male, female, other, prefer_not_to_say
    height_cm = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    target_weight_kg = Column(Float, nullable=True)

    # Health & goals
    goal = Column(SQLEnum(UserGoal), nullable=True)
    activity_level = Column(SQLEnum(ActivityLevel), nullable=True)

    # Dietary restrictions (JSON array stored as text, can be parsed)
    dietary_restrictions = Column(Text, nullable=True)  # ["vegetarian", "halal", etc.]
    allergies = Column(Text, nullable=True)  # ["peanuts", "shellfish", etc.]
    health_conditions = Column(Text, nullable=True)  # ["diabetes", "hypertension", etc.]

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)

    # Relationships
    scans = relationship("FoodScan", back_populates="user", cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="user", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    favorite_recipes = relationship("FavoriteRecipe", back_populates="user", cascade="all, delete-orphan")

    @property
    def is_premium(self) -> bool:
        """Check if user has premium subscription."""
        if self.subscription_tier == SubscriptionTier.FREE:
            return False

        if self.subscription_end_date and self.subscription_end_date < datetime.utcnow():
            return False

        return True

    @property
    def can_scan(self) -> bool:
        """Check if user can perform another scan."""
        if self.is_premium:
            return True

        from app.core.config import settings
        return self.monthly_scans < settings.API_SCAN_LIMIT_FREE

    @property
    def can_chat(self) -> bool:
        """Check if user can send another chat message."""
        if self.is_premium:
            return True

        from app.core.config import settings
        return self.monthly_chat_messages < settings.API_CHAT_LIMIT_FREE

    @property
    def bmi(self) -> float:
        """Calculate BMI if height and weight are available."""
        if self.height_cm and self.weight_kg:
            height_m = self.height_cm / 100
            return round(self.weight_kg / (height_m ** 2), 1)
        return None

    def __repr__(self):
        return f"<User {self.email}>"
