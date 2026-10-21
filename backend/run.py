import uvicorn
import os
import sys

# Ensure backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.config import settings

if __name__ == "__main__":
    print(f"============================================================")
    print(f"Starting TimescaleDB Market Analytics Platform Backend API")
    print(f"Listening on: http://localhost:{settings.SERVER_PORT}")
    print(f"API Documentation: http://localhost:{settings.SERVER_PORT}/docs")
    print(f"Database Target: {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    print(f"============================================================")
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=False,
        log_level="info"
    )
