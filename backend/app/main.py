import logging
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints.calculator import router as calculator_router
from app.api.endpoints.ai import router as ai_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend service for LPS Smart-Assistant and Intelligent 3T Calculator",
    version="0.1.0",
)

# Production Security: Global Exception Middleware
@app.middleware("http")
async def global_exception_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
        # Sanitized error response so we don't leak stack traces
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "message": "A critical system error occurred. Our engineers have been notified."
            }
        )

# Register endpoints
app.include_router(calculator_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")

# Configure CORS for Production & Development
origins = [
    "http://localhost:3000",
    "https://lps-smart-assistant.vercel.app",  # Production frontend URL placeholder
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "app_name": settings.APP_NAME,
        "status": "healthy",
        "environment": settings.APP_ENV
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
# reload trigger comment v4
