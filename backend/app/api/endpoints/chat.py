"""AI chat API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from app.db.base import get_db
from app.models.user import User
from app.models.meal import ChatMessage
from app.api.endpoints.auth import get_current_user
from app.services.gemini_service import gemini_service

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    language: str = "th"


class ChatResponse(BaseModel):
    answer: str
    created_at: datetime


@router.post("/ask", response_model=ChatResponse)
async def ask_nutrition_question(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Ask the AI nutrition coach a question.
    """
    # Check usage limits
    if not current_user.can_chat:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat limit reached. Please upgrade to premium."
        )

    # Get recent chat history
    recent_messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.desc()).limit(10).all()

    chat_history = [
        {"role": msg.role, "content": msg.content}
        for msg in reversed(recent_messages)
    ]

    # Get AI response
    try:
        response = await gemini_service.chat_nutrition_question(
            question=request.message,
            chat_history=chat_history,
            language=request.language,
            context={
                "user_goal": current_user.goal.value if current_user.goal else None,
                "dietary_restrictions": current_user.dietary_restrictions,
            }
        )

        # Save user message
        user_msg = ChatMessage(
            user_id=current_user.id,
            role="user",
            content=request.message,
            language=request.language
        )
        db.add(user_msg)

        # Save assistant response
        assistant_msg = ChatMessage(
            user_id=current_user.id,
            role="assistant",
            content=response["answer"],
            language=request.language,
            model_used=response.get("model_used")
        )
        db.add(assistant_msg)

        # Update usage
        current_user.monthly_chat_messages += 1
        current_user.total_chat_messages += 1

        db.commit()

        return {
            "answer": response["answer"],
            "created_at": datetime.utcnow()
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )


@router.get("/history")
async def get_chat_history(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history."""
    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id
    ).order_by(ChatMessage.created_at.desc()).limit(limit).all()

    return {"messages": list(reversed(messages))}
