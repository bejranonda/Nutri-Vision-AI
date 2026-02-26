"""
NutriVision AI - Main FastAPI Application
Smart Recipe Assistant for Modern Nutrition
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import logging

from app.core.config import settings
from app.db.base import Base, engine

# Configure logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered nutrition analysis and recipe assistant specialized in Thai cuisine",
    version="1.0.0",
    docs_url=settings.API_DOCS_URL if settings.ENABLE_API_DOCS else None,
    redoc_url="/redoc" if settings.ENABLE_API_DOCS else None,
    openapi_url="/openapi.json" if settings.ENABLE_API_DOCS else None,
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gzip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request and process timing middleware
@app.middleware("http")
async def log_requests_and_timing(request: Request, call_next):
    """Log all incoming requests and outgoing responses with timing."""
    start_time = time.time()
    
    # Process the request
    try:
        response = await call_next(request)
    except Exception as exc:
        # This will be handled by the global exception handler but we log it here for context
        process_time = time.time() - start_time
        logger.error(
            f"Request failed: {request.method} {request.url.path} - Error: {str(exc)} - Time: {process_time:.3f}s"
        )
        raise exc
        
    process_time = time.time() - start_time
    
    # Add timing header
    response.headers["X-Process-Time"] = str(process_time)
    
    # Log the request details
    logger.info(
        f"Request: {request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.3f}s"
    )
    
    return response


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions gracefully."""
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred" if settings.is_production else str(exc),
            "type": "internal_error"
        }
    )


# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint.
    Returns application status and version.
    """
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "environment": settings.APP_ENV
    }


# Root endpoint
@app.get("/", tags=["System"])
async def root():
    """
    Root endpoint with API information.
    """
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "description": "AI-powered nutrition analysis for Thai cuisine",
        "docs": f"{settings.BACKEND_URL}{settings.API_DOCS_URL}" if settings.ENABLE_API_DOCS else None,
        "languages": settings.SUPPORTED_LANGUAGES,
        "features": [
            "Food image recognition",
            "8-dimension nutrition scoring",
            "Recipe suggestions",
            "AI nutrition chat",
            "Meal planning",
            "Thai food specialization"
        ]
    }


# Import and include routers
from app.api.endpoints import auth, scan, recipe, chat, user, meal

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(scan.router, prefix="/api/scan", tags=["Food Scanning"])
app.include_router(recipe.router, prefix="/api/recipes", tags=["Recipes"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(user.router, prefix="/api/user", tags=["User"])
app.include_router(meal.router, prefix="/api/meal", tags=["Meal Planning"])


# Startup event
@app.on_event("startup")
async def startup_event():
    """Execute on application startup."""
    logger.info(f"Starting {settings.APP_NAME} in {settings.APP_ENV} mode")
    logger.info(f"API documentation available at: {settings.BACKEND_URL}{settings.API_DOCS_URL}")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Execute on application shutdown."""
    logger.info(f"Shutting down {settings.APP_NAME}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
