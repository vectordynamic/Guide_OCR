
import asyncio
import sys
from bson import ObjectId
from app.core.database import get_questions_collection, connect_to_mongo

async def check_types():
    try:
        await connect_to_mongo()
        collection = get_questions_collection()
        print("Connected to questions collection...")
        
        print("\n--- DUMPING RANDOM QUESTION ---")
        random_q = await collection.find_one()
        if random_q:
             print(f"Random Question: {random_q}")
             print(f"Page ID: {random_q.get('page_id')} (Type: {type(random_q.get('page_id'))})")
        # Inspect specific page from user logs
        target_page = "6989ca8f76b0d1b235751dbe"
        print(f"\n--- DELETING QUESTIONS FOR TARGET PAGE {target_page} ---")
        
        # Try finding with ObjectId
        try:
            del_result = await collection.delete_many({"page_id": ObjectId(target_page)})
            print(f"Deleted {del_result.deleted_count} questions using ObjectId(page_id)")
        except Exception as e:
            print(f"Error querying by ObjectId: {e}")

        print("\n--- CHECKING FOR QUESTIONS WITH STRING PAGE_ID ---")
        # Find questions where page_id is a string but resembles an ObjectId
        # regex match for 24 hex chars
        str_qs = await collection.find({
            "page_id": {"$type": "string"}
        }).limit(5).to_list(None)
        
        print(f"Found {len(str_qs)} questions with String page_id")
        for q in str_qs:
             print(f"QID: {q['_id']} | page_id: {q['page_id']} (Type: {type(q['page_id'])})")



    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_types())
