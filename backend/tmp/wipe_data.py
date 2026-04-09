import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import boto3
from botocore.config import Config
import os
import sys

# Add backend to path to import state
sys.path.append("/Users/adnan/Projects/OCR/OCR/backend")
from app.core.config import settings

async def wipe_mongodb():
    print("🧹 Cleaning MongoDB...")
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    
    collections = ["books", "chapters", "ocr_pages", "questions"]
    for coll in collections:
        await db[coll].drop()
        print(f"   - Dropped collection: {coll}")
    
    client.close()
    print("✅ MongoDB clean.")

def wipe_r2():
    print("🧹 Cleaning R2 Storage...")
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto"
    )
    bucket = settings.R2_BUCKET_NAME
    
    # List and delete all objects in books/
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket, Prefix='books/')
    
    deleted_count = 0
    for page in pages:
        if 'Contents' in page:
            delete_keys = [{'Key': obj['Key']} for obj in page['Contents']]
            s3.delete_objects(Bucket=bucket, Delete={'Objects': delete_keys})
            deleted_count += len(delete_keys)
            print(f"   - Deleted {len(delete_keys)} objects...")
            
    print(f"✅ R2 clean. Total objects deleted: {deleted_count}")

async def main():
    await wipe_mongodb()
    wipe_r2()
    print("\n✨ System reset complete.")

if __name__ == "__main__":
    asyncio.run(main())
