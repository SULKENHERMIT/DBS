import logging
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("app.database")

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

async def connect_to_mongo():
    logger.info("Connecting to MongoDB Atlas via MONGODB_URI loaded from item1.env with certifi CA bundle...")
    
    try:
        # Initialize Motor client directly with certifi certificate bundle and 4s timeout
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=4000
        )
        await client.admin.command('ping')
        db_instance.client = client
        try:
            db_instance.db = db_instance.client.get_default_database(default=settings.DB_NAME)
        except Exception:
            db_instance.db = db_instance.client[settings.DB_NAME]
        logger.info(f"Successfully connected to MongoDB Atlas database: '{db_instance.db.name}'")
    except Exception as e:
        logger.warning(f"Could not connect to remote MongoDB Atlas ({e}). Falling back to in-memory MongoDB engine for local operation...")
        try:
            from mongomock_motor import AsyncMongoMockClient
            db_instance.client = AsyncMongoMockClient()
            db_instance.db = db_instance.client[settings.DB_NAME]
            logger.info(f"Connected to in-memory MongoDB database: '{settings.DB_NAME}'")
        except Exception as mock_err:
            logger.error(f"Failed to initialize database: {mock_err}")
            raise e

    # Setup indexes
    await setup_indexes()

async def close_mongo_connection():
    if db_instance.client:
        logger.info("Closing MongoDB connection...")
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

async def setup_indexes():
    """Ensure all required collections have proper indexes according to the ER model and caching requirements."""
    try:
        # Users: Unique email
        await db_instance.db.users.create_index("email", unique=True)
        
        # Portfolios: user_id index
        await db_instance.db.portfolios.create_index("user_id")

        # Assets: symbol index
        await db_instance.db.assets.create_index("symbol", unique=True)

        # Price Cache: TTL Index on expire_at and compound index on symbol + asset_type
        await db_instance.db.price_cache.create_index("expire_at", expireAfterSeconds=0)
        await db_instance.db.price_cache.create_index([("symbol", 1), ("asset_type", 1)])

        # Transactions: portfolio_id, user_id, timestamp
        await db_instance.db.transactions.create_index([("portfolio_id", 1), ("timestamp", -1)])
        await db_instance.db.transactions.create_index("user_id")

        # Alerts: user_id, enabled
        await db_instance.db.alerts.create_index([("user_id", 1), ("enabled", 1)])

        # Watchlists: user_id
        await db_instance.db.watchlists.create_index("user_id")

        # Portfolio Performance: portfolio_id and timestamp
        await db_instance.db.portfolio_performance.create_index([("portfolio_id", 1), ("timestamp", -1)])

        # Audit logs: user_id, timestamp
        await db_instance.db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])

        logger.info("Database indexes successfully setup on MongoDB Atlas.")
    except Exception as e:
        logger.warning(f"Index creation note: {e}")

def get_database() -> AsyncIOMotorDatabase:
    if db_instance.db is None:
        raise RuntimeError("Database is not initialized. Please call connect_to_mongo() first.")
    return db_instance.db
