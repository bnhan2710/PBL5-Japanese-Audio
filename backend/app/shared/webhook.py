import httpx
from typing import Any, Dict, Optional
from app.core.config import get_settings
from app.shared.utils import setup_logger

logger = setup_logger(__name__)
settings = get_settings()

async def trigger_n8n_webhook(event_type: str, data: Dict[str, Any]) -> bool:
    """
    Send a notification to n8n webhook for automation.
    
    Args:
        event_type: Type of event (e.g., 'user.created', 'user.updated')
        data: Event payload
    
    Returns:
        bool: True if successful, False otherwise
    """
    webhook_url = settings.N8N_WEBHOOK_URL
    if not webhook_url:
        logger.debug("N8N_WEBHOOK_URL not configured, skipping automation trigger.")
        return False

    payload = {
        "event": event_type,
        "timestamp": str(httpx.utils.now() if hasattr(httpx.utils, 'now') else ""), # Fallback if needed
        "data": data
    }
    
    # Custom timestamp logic for consistency
    from datetime import datetime
    payload["timestamp"] = datetime.utcnow().isoformat()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=5.0)
            response.raise_for_status()
            logger.info(f"Successfully triggered n8n webhook for event: {event_type}")
            return True
    except Exception as e:
        logger.error(f"Failed to trigger n8n webhook for event {event_type}: {str(e)}")
        return False
