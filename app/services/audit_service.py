import logging
from datetime import datetime, timezone
from app.database import get_database

logger = logging.getLogger("app.audit")

async def log_user_action(user_id: str, action: str):
    """
    Log an action into MongoDB audit_logs collection,
    satisfying USERS -[GENERATES]-> AUDIT LOGS relationship.
    """
    try:
        db = get_database()
        audit_entry = {
            "user_id": str(user_id),
            "action": action,
            "timestamp": datetime.now(timezone.utc)
        }
        await db.audit_logs.insert_one(audit_entry)
    except Exception as e:
        logger.warning(f"Failed to write audit log for user {user_id}: {e}")
