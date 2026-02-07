"""
MongoDB Database Connection
"""
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    
db = Database()


async def connect_to_mongo():
    """Create database connection."""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_mongo_connection():
    """Close database connection."""
    if db.client:
        db.client.close()
        print("Closed MongoDB connection")


def get_database():
    """Get database instance."""
    return db.client[settings.DATABASE_NAME]


# Collection accessors
def get_books_collection():
    return get_database()["books"]

def get_chapters_collection():
    return get_database()["chapters"]

def get_ocr_pages_collection():
    return get_database()["ocr_pages"]

def get_questions_collection():
    return get_database()["questions"]
