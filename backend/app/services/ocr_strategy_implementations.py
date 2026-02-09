"""
Concrete OCR Strategy Implementation for Google Gemini

Implements OCR strategy using Google Gemini 3 Flash with thinking capability
for Bangladeshi National Curriculum (NCTB) educational content extraction.
"""
import os
import json
from typing import Dict, Any
from google import genai
from google.genai import types
from app.services.ocr_strategies import OCRStrategy


# System prompt for Bengali educational content extraction
SYSTEM_PROMPT = """
You are an expert OCR extraction assistant specialized in the Bangladeshi National Curriculum (NCTB) educational guides. Your sole purpose is to extract questions (MCQ, Short, and Creative/Srijonshil) from the provided image text and output them in strict JSON format.

**CORE DIRECTIVE:** You must filter out all non-question text. IGNORE chapter summaries, learning outcomes, author names, advertisements, and page headers/footers. Only extract text that belongs to a specific question block.

**INPUT PROCESSING RULES:**
1.  **Bengali Integrity:** Preserve all Bengali text exactly as it appears.
2.  **Creative Questions (Srijonshil):**
    * The "Stimulus" or "Uddipak" (paragraph/image description) goes into `question_text`.
    * The four parts (ক, খ, গ, ঘ) go into `sub_questions`.
3.  **MCQ Handling:** * Map options (ক, খ, গ, ঘ) to keys `ka`, `kha`, `ga`, `gha`.
    * If the correct answer is marked (e.g., bolded, ticked, or listed at the bottom), extract it.
4.  **Metadata Extraction (CRITICAL):**
    * Look for tags in parentheses usually found at the end of a question stem, e.g., (ঢা. বো. ২২) or [R.B. '23].
    * **Board Mapping:**
        * "ঢা.বো" / "D.B" -> "Dhaka Board"
        * "রা.বো" / "R.B" -> "Rajshahi Board"
        * "কু.বো" / "C.B" -> "Comilla Board"
        * "য.বো" / "J.B" -> "Jashore Board"
        * "চ.বো" / "Ctg.B" -> "Chittagong Board"
        * "ব.বো" / "B.B" -> "Barisal Board"
        * "সি.বো" / "S.B" -> "Sylhet Board"
        * "দি.বো" / "Dj.B" -> "Dinajpur Board"
        * "ম.বো" / "Mym.B" -> "Mymensingh Board"
        * "সকল বোর্ড" / "All Boards" -> "All Boards"
    * **Year Mapping:** Convert abbreviated years (e.g., '19, 2022) to full 4-digit format (2019, 2022).
    * **School Names:** If a question is tagged with a school name (e.g., "Viqarunnisa Noon School"), capture it in `school_name`.

**OUTPUT SCHEMA (JSON):**
{
  "questions": [
    {
      "type": "mcq/short/creative",
      "question_text": "The stem or stimulus text (Uddipak) here. Leave empty if only image.",
      "has_image": true, 
      "image_description": "Describe any diagrams/charts in the stimulus",
      
      // FOR MCQ
      "options": {
        "ka": "Option text",
        "kha": "Option text",
        "ga": "Option text",
        "gha": "Option text"
      },
      "correct_answer": "ka", // if detected, else null
      
      // FOR SHORT/CREATIVE
      "answer": "The answer text if immediately visible",
      "sub_questions": [
        {"index": "ka", "text": "knowledge based question text...", "mark": 1},
        {"index": "kha", "text": "comprehension based question text...", "mark": 2},
        {"index": "ga", "text": "application based question text...", "mark": 3},
        {"index": "gha", "text": "higher order thinking text...", "mark": 4}
      ],
      
      "metadata": {
        "board": "Dhaka Board", // Standardized English Name
        "exam_year": "2023",     // Full Year
        "school_name": null,
        "question_number": "1"   // As seen on page
      },
      
      "continues_on_next_page": false
    }
  ]
}

**CONSTRAINTS:**
* Output **ONLY** raw JSON. No markdown code blocks, no introductory text.
* If a field is missing (e.g., no school name), use `null`.
* If the text is cut off at the bottom, set `continues_on_next_page` to `true`.
"""


class GeminiStrategy(OCRStrategy):
    """Strategy for Google Gemini Vision with thinking capability"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gemini-2.5-flash"
        # gemini-3-flash-preview
        self.client = genai.Client(api_key=self.api_key)
    
    async def process_image(self, image_url: str) -> Dict[str, Any]:
        """Process image using Gemini 3 Flash Preview with thinking capability"""
        print(f"Using Google Gemini 3 Flash Preview for OCR: {image_url}")
        
        try:
            # Prepare the prompt with instructions
            prompt_text = f"""{SYSTEM_PROMPT}

IMPORTANT INSTRUCTIONS:
1. **Language:** The content is in BENGALI. Preserve it EXACTLY. Do NOT translate the question text.
2. **Data Integrity:** Do NOT truncate long text or numbers. Capture the full 'Uddipak' (Stimulus) and all equations so the question remains solvable.
3. **Noise Filter:** Ignore page headers, footers, and 'Chapter Summary' text. Extract ONLY the questions.
4. **Output:** Return strictly raw JSON. Do not use Markdown code blocks (no ```json wrappers).

TASK: Extract all questions from this image."""

            # Create content parts with image and text
            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_uri(
                            file_uri=image_url,
                            mime_type="image/jpeg"  # Adjust if needed
                        ),
                        types.Part.from_text(text=prompt_text),
                    ],
                ),
            ]
            
            # Configure generation settings
            # NOTE: Temporarily disabled include_thoughts to debug JSON parsing issues
            generate_content_config = types.GenerateContentConfig(
                temperature=0.1,
                # thinking_config=types.ThinkingConfig(
                #     include_thoughts=True,
                # ),
                media_resolution="MEDIA_RESOLUTION_MEDIUM",
                response_mime_type="application/json",
            )
            
            # Check image size for debugging
            import httpx
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.head(image_url)
                    size_bytes = int(resp.headers.get('content-length', 0))
                    size_mb = size_bytes / (1024 * 1024)
                    print(f"Image Size: {size_mb:.2f} MB")
            except Exception as e:
                print(f"Could not determine image size: {e}")

            # Generate content (Non-streaming)
            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            )
            
            full_response = response.text
             
            print(f"Gemini Response received ({len(full_response)} chars)")
            # Debug: Log first 500 chars of response to diagnose format issues
            print(f"Response preview: {full_response[:500]}...")
            
            # Parse the JSON response
            return self._parse_json_response(full_response)
            
        except Exception as e:
            print(f"Gemini API Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "questions": [],
                "error": f"Gemini API Error: {str(e)}"
            }
