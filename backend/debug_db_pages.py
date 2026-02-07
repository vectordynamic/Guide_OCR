
import asyncio
import os
from app.core.database import get_database, get_ocr_pages_collection
from bson import ObjectId

# Mock settings just in case
os.environ["MONGODB_URL"] = "mongodb://localhost:27017"
os.environ["DATABASE_NAME"] = "digital_library"

from app.core.database import db

async def check_pages():
    # Helper to connect manualy
    from motor.motor_asyncio import AsyncIOMotorClient
    # Use the real connection string
    conn_str = "mongodb+srv://adnanul-islam:885454786@cluster0.itwgdmg.mongodb.net/?appName=Cluster0"
    db.client = AsyncIOMotorClient(conn_str)
    
    print(f"Connecting to: {conn_str[:20]}...")
    
    # Now use the get accessor
    from app.core.database import get_ocr_pages_collection
    collection = get_ocr_pages_collection()
    
    # Get all pages sorted by page_number
    cursor = collection.find().sort("page_number", 1)
    
    print(f"{'Page #':<10} | {'ID':<24} | {'Image URL'}")
    print("-" * 80)
    
    async for page in cursor:
        page_num = page.get("page_number", "?")
        page_id = str(page.get("_id"))
        url = page.get("image_url", "NO URL")
        print(f"{page_num:<10} | {page_id:<24} | {url}")

if __name__ == "__main__":
    asyncio.run(check_pages())
