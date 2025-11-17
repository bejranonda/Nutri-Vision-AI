"""
Meal planning and chat models.
"""
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Date, JSON
from sqlalchemy.orm import relationship
from app.db.base import Base


class MealPlan(Base):
    """Meal plan model for daily meal planning."""

    __tablename__ = "meal_plans"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Date
    plan_date = Column(Date, nullable=False, index=True)

    # Meals (JSON array of meal objects)
    breakfast = Column(JSON, nullable=True)
    lunch = Column(JSON, nullable=True)
    dinner = Column(JSON, nullable=True)
    snacks = Column(JSON, nullable=True)

    # Daily totals
    total_calories = Column(Integer, nullable=True)
    total_protein_g = Column(Integer, nullable=True)
    total_carbs_g = Column(Integer, nullable=True)
    total_fat_g = Column(Integer, nullable=True)
    total_fiber_g = Column(Integer, nullable=True)

    # User notes
    notes = Column(Text, nullable=True)
    is_completed = Column(Integer, default=0)  # 0-100 percentage

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="meal_plans")

    def __repr__(self):
        return f"<MealPlan {self.plan_date} for User {self.user_id}>"


class ChatMessage(Base):
    """Chat message model for AI nutrition coach conversations."""

    __tablename__ = "chat_messages"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Message content
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    language = Column(String, default="th")  # Language of the message

    # Context (optional, for reference)
    context_scan_id = Column(Integer, ForeignKey("food_scans.id"), nullable=True)
    context_recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)

    # AI metadata
    model_used = Column(String, nullable=True)  # e.g., "gemini-1.5-flash"
    tokens_used = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="chat_messages")

    def __repr__(self):
        return f"<ChatMessage {self.id} from User {self.user_id}>"


class DailyTip(Base):
    """Daily nutrition tips in Thai and English."""

    __tablename__ = "daily_tips"

    # Primary key
    id = Column(Integer, primary_key=True, index=True)

    # Tip content
    title_th = Column(String, nullable=False)
    title_en = Column(String, nullable=False)
    content_th = Column(Text, nullable=False)
    content_en = Column(Text, nullable=False)

    # Category
    category = Column(String, index=True)  # sugar, protein, hydration, etc.
    tags = Column(JSON, nullable=True)

    # Display
    icon = Column(String, nullable=True)
    color = Column(String, nullable=True)
    is_active = Column(Integer, default=1)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<DailyTip {self.title_en}>"
