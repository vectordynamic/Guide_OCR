import os
import asyncio
from google import genai
from app.core.config import settings

async def list_models():
    print(f"Listing models using API Key: {settings.GEMINI_API_KEY[:5]}...")
    try:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        # List all models
        models = list(client.models.list())
        print(f"Found {len(models)} models.")
        for m in models:
            if "gemini" in m.name:
                print(f" - {m.name} ({m.display_name})")
                
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    asyncio.run(list_models())
