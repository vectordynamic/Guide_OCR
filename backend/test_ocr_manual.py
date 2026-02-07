
import asyncio
import os
import sys
from app.services.ocr_processor import get_ocr_processor

# Mock settings for standalone run
os.environ["ZAI_API_KEY"] = "f3c9f2a845d7464b8bd9a51156d0af0e.wrp21oQBWDKLnFcF"
os.environ["ZAI_BASE_URL"] = "https://api.z.ai/api/paas/v4"
os.environ["ZAI_MODEL"] = "glm-4.6v"

async def test_ocr():
    ocr = get_ocr_processor()
    # Using the image URL from your previous logs
    image_url = "https://algorxai.com/books/6987042c8cebf3c818dbdc06/chapters/ch_01/page_001.png"
    
    print(f"Sending image to OCR: {image_url}")
    print("Waiting for response (this may take a minute)...")
    
    try:
        result = await ocr.process_image(image_url)
        print("\n--- OCR OUTPUT ---")
        import json
        print(json.dumps(result, indent=2, ensure_ascii=False))
        print("\n--- END OUTPUT ---")
             
    except Exception as e:
        print(f"\nError: {e}")
        with open("ocr_error.txt", "w") as f:
            f.write(str(e))

if __name__ == "__main__":
    asyncio.run(test_ocr())
