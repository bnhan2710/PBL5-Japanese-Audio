from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from contextlib import asynccontextmanager

from app.shared.utils import setup_logger
from app.core.health import router as health_router
from app.modules.users.router import router as users_router
from app.modules.auth.router import router as auth_router
from app.modules.exam.router import router as exam_router
from app.modules.questions.router import router as questions_router
from app.modules.ai_exam.router import router as ai_exam_router

from app.db.session import init_db, engine
from app.core.config import get_settings

# Ensure all models are imported so SQLAlchemy can resolve all relationships
from app.modules.audio.models import Audio, TranscriptSegment  # noqa: F401
from app.modules.questions.models import Question, Answer  # noqa: F401
from app.modules.result.models import UserResult  # noqa: F401

settings = get_settings()
logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for the FastAPI application.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("Starting application")
    try:
        await init_db()
        logger.info("Application started successfully")
        yield
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")
        raise
    finally:
        # Cleanup
        logger.info("Shutting down application")
        await engine.dispose()


# Swagger/OpenAPI configuration
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    lifespan=lifespan,
    docs_url="/api/docs",  # Swagger UI
    redoc_url="/api/redoc",  # ReDoc
    openapi_url="/api/openapi.json",  # OpenAPI schema
    openapi_tags=[
        {
            "name": "health",
            "description": "Health check endpoints for system and database"
        },
        {
            "name": "auth",
            "description": "Authentication and user management (registration, login, password reset)"
        },
        {
            "name": "admin",
            "description": "User management for administrators (admin access required)"
        },
        {
            "name": "exams",
            "description": "Exam CRUD – create, list, update, delete exam drafts"
        },
        {
            "name": "questions",
            "description": "Question / Answer CRUD + audio upload per question"
        },
        {
            "name": "ai",
            "description": "AI-powered exam generation: upload audio \u2192 ReazonSpeech ASR \u2192 Gemini analysis \u2192 JLPT questions"
        }
    ],
    swagger_ui_parameters={
        "persistAuthorization": True,  # Keep token after page reload
        "displayRequestDuration": True,  # Display request duration
        "docExpansion": "none",  # Don't expand endpoints by default
        "filter": True,  # Enable endpoint search
    },
    contact={
        "name": "PBL5 Japanese Audio Team",
        "email": "support@pbl5.com",
    },
    license_info={
        "name": "MIT",
    },
)


# Custom OpenAPI schema to add JWT Bearer authentication
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
        tags=app.openapi_tags,
    )
    
    # Add JWT Bearer security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Enter JWT token (obtained from /api/auth/login endpoint). Just enter the token, no need to add 'Bearer ' prefix."
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(exam_router, prefix="/api")
app.include_router(questions_router, prefix="/api")
app.include_router(ai_exam_router, prefix="/api")


logger.info("Application routes configured")
