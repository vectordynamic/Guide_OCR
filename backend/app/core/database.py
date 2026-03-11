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

    # Create indexes for query performance
    try:
        questions = get_questions_collection()
        await questions.create_index("metadata.appearances.board")
        await questions.create_index("metadata.appearances.exam_year")
        await questions.create_index([("book_id", 1), ("chapter_id", 1)])
        await questions.create_index("type")
        print("MongoDB indexes created/verified")
    except Exception as e:
        print(f"Warning: Index creation failed: {e}")


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
