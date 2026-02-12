from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    """
    API health check.
    
    This endpoint confirms that the API is running normally.
    """
    return {"status": "healthy"}
