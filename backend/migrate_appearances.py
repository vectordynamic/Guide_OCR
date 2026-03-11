"""
Migration Script: Convert metadata.board (string) → metadata.appearances[] (array)

Transforms all existing question documents AND embedded questions in ocr_pages
(raw_ocr_json, verified_json) from the old flat format to the new appearances array.

Usage:
    python migrate_appearances.py              # Run migration
    python migrate_appearances.py --dry-run    # Preview without modifying

Idempotent: Skips documents that already have appearances[].
"""
import asyncio
import sys
import os

# Load .env for database connection
from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient


MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "digital_library")

DRY_RUN = "--dry-run" in sys.argv


def convert_question_metadata(question: dict) -> bool:
    """
    Convert a single question's metadata from flat to appearances[].
    Returns True if the question was modified.
    """
    metadata = question.get("metadata")
    if not metadata or not isinstance(metadata, dict):
        return False

    # Skip if already migrated
    if "appearances" in metadata:
        return False

    # Extract old fields
    board = metadata.pop("board", None)
    exam_year = metadata.pop("exam_year", None)
    school_name = metadata.pop("school_name", None)

    # Build appearances array
    appearances = []
    if board or exam_year or school_name:
        appearance = {}
        if board:
            appearance["board"] = board
        if exam_year:
            appearance["exam_year"] = exam_year
        if school_name:
            appearance["school_name"] = school_name
        appearances.append(appearance)

    metadata["appearances"] = appearances
    return True


async def migrate_questions_collection(db) -> int:
    """Migrate the questions collection."""
    collection = db["questions"]

    # Find questions with old-style metadata (has board but no appearances)
    query = {
        "$and": [
            {"metadata": {"$exists": True}},
            {"metadata.appearances": {"$exists": False}},
        ]
    }

    count = await collection.count_documents(query)
    print(f"\n📋 Questions Collection: {count} documents to migrate")

    if count == 0 or DRY_RUN:
        return count

    migrated = 0
    cursor = collection.find(query)
    async for doc in cursor:
        metadata = doc.get("metadata", {})

        # Extract old fields
        board = metadata.pop("board", None)
        exam_year = metadata.pop("exam_year", None)
        school_name = metadata.pop("school_name", None)

        appearances = []
        if board or exam_year or school_name:
            appearance = {}
            if board:
                appearance["board"] = board
            if exam_year:
                appearance["exam_year"] = exam_year
            if school_name:
                appearance["school_name"] = school_name
            appearances.append(appearance)

        metadata["appearances"] = appearances

        await collection.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {"metadata": metadata},
            }
        )
        migrated += 1

    print(f"  ✅ Migrated {migrated} question documents")
    return migrated


async def migrate_ocr_pages_collection(db) -> int:
    """Migrate embedded questions in ocr_pages (raw_ocr_json and verified_json)."""
    collection = db["ocr_pages"]

    # Find pages that have embedded questions with old-style metadata
    query = {
        "$or": [
            {"raw_ocr_json.questions.metadata.board": {"$exists": True}},
            {"verified_json.questions.metadata.board": {"$exists": True}},
        ]
    }

    count = await collection.count_documents(query)
    print(f"\n📄 OCR Pages Collection: {count} documents to migrate")

    if count == 0 or DRY_RUN:
        return count

    migrated = 0
    cursor = collection.find(query)
    async for doc in cursor:
        update = {}
        changed = False

        for json_field in ["raw_ocr_json", "verified_json"]:
            json_data = doc.get(json_field)
            if not json_data or not isinstance(json_data, dict):
                continue

            questions = json_data.get("questions", [])
            if not isinstance(questions, list):
                continue

            field_changed = False
            for q in questions:
                if convert_question_metadata(q):
                    field_changed = True

            if field_changed:
                update[json_field] = json_data
                changed = True

        if changed:
            await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": update}
            )
            migrated += 1

    print(f"  ✅ Migrated {migrated} OCR page documents")
    return migrated


async def main():
    if DRY_RUN:
        print("🔍 DRY RUN MODE — no changes will be made\n")
    else:
        print("🚀 LIVE MIGRATION — will modify documents\n")

    print(f"Database: {DATABASE_NAME}")
    print(f"MongoDB: {MONGODB_URL[:40]}...")

    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    # Pre-migration counts
    total_questions = await db["questions"].count_documents({})
    total_pages = await db["ocr_pages"].count_documents({})
    print(f"\nTotal questions in DB: {total_questions}")
    print(f"Total OCR pages in DB: {total_pages}")

    # Run migrations
    q_count = await migrate_questions_collection(db)
    p_count = await migrate_ocr_pages_collection(db)

    # Summary
    print("\n" + "=" * 50)
    if DRY_RUN:
        print(f"DRY RUN COMPLETE: Would migrate {q_count} questions + {p_count} OCR pages")
        print("Run without --dry-run to apply changes.")
    else:
        print(f"MIGRATION COMPLETE: {q_count} questions + {p_count} OCR pages migrated")

    # Post-migration verification
    if not DRY_RUN:
        remaining = await db["questions"].count_documents({
            "metadata.board": {"$exists": True},
            "metadata.appearances": {"$exists": False},
        })
        print(f"\nVerification: {remaining} questions still have old format (should be 0)")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
