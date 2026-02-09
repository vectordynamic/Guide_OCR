import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import MagicMock
sys.modules["pdf2image"] = MagicMock()
sys.modules["boto3"] = MagicMock()
sys.modules["botocore"] = MagicMock()
sys.modules["botocore.config"] = MagicMock()

from app.services.ocr_strategy_implementations import GeminiStrategy
from app.core.config import settings

async def main():
    print("Initializing Gemini Strategy...")
    # Ensure API key is present
    if not settings.GEMINI_API_KEY:
        print("Error: GEMINI_API_KEY is not set.")
        return

    strategy = GeminiStrategy(api_key=settings.GEMINI_API_KEY)
    
    test_image_url = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png" # Simple PNG
    
    print(f"Processing image: {test_image_url}")
    try:
        result = await strategy.process_image(test_image_url)
        print("Result:", result)
    except Exception as e:
        print(f"Caught Exception: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
