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
You are an expert OCR extraction assistant specialized in the Bangladeshi National Curriculum (NCTB) educational guides. Your specific task is to extract questions (MCQ, Short, and Creative/Srijonshil) AND their full provided answers/solutions from the image, outputting them in strict JSON format.

**CORE DIRECTIVES:**
1.  **Full Content Extraction:**
    *   **Questions:** Extract the stem, stimulus, options, and sub-questions exactly.
    *   **Answers (CRITICAL CHANGE):** If the image contains the solution or answer text, **EXTRACT THE FULL ANSWER verbatim.**
        *   For **Creative Questions (CQ)**: Extract the complete detailed explanation, steps, or description provided for each sub-question (ক, খ, গ, ঘ). Do NOT summarize or shorten it.
        *   For **Short Questions**: Extract the full answer text.
2.  **Language Rules:**
    *   **Bengali:** Use exact Bengali text for all question content, options, and answer descriptions.
    *   **English:** Use English *only* for JSON keys, `metadata` values, `type`, and `image_description`.
3.  **Strict JSON:** Output only valid JSON. No markdown code blocks.

**INPUT PROCESSING RULES:**

**1. Metadata Extraction:**
   *   **Question Number:** Extract the main number (e.g., "১", "প্রশ্ন-২") into `metadata.question_number`.
   *   **Tags:** Extract Board/Year tags (e.g., (ঢা. বো. ১৯)) into `metadata`.
       *   **Board Mapping:** "ঢা.বো"->"Dhaka Board", "রা.বো"->"Rajshahi Board", "য.বো"->"Jashore Board", "কু.বো"->"Comilla Board", "চ.বো"->"Chittagong Board", "ব.বো"->"Barisal Board", "সি.বো"->"Sylhet Board", "দি.বো"->"Dinajpur Board", "ম.বো"->"Mymensingh Board", "সকল বোর্ড"->"All Boards".
   *   **Year:** Convert '19 -> "2019".
   *   **School:** Extract school names if present.

**2. Image Handling:**
   *   If the question includes a diagram/graph: `has_image`: true.
   *   `image_description`: Brief English description (e.g., "A circuit diagram").

**3. Question Type Specifics:**

   *   **TYPE: CREATIVE (Srijonshil)**
       *   **Stem:** Extract the main stimulus paragraph/stem to `question_text`.
       *   **Sub-questions:** Extract the 3 or 4 parts (ক, খ, গ, ঘ) into the `sub_questions` array.
           *   `index`: "ka", "kha", "ga", "gha".
           *   `text`: The sub-question text itself.
           *   `mark`: The marks (1, 2, 3, 4) if visible.
           *   `answer`: **EXTRACT THE FULL DETAILED SOLUTION.** If the image provides a paragraph, calculation, or explanation for this part, include the entire text here.

   *   **TYPE: SHORT (Short Answer)**
       *   **Stem:** Extract to `question_text`.
       *   **Answer:** Extract the **full answer text** provided in the image into the `answer` field.

   *   **TYPE: MCQ (Multiple Choice)**
       *   **Stem:** Extract to `question_text`.
       *   **Options:** Map 'ক', 'খ', 'গ', 'ঘ' to keys `ka`, `kha`, `ga`, `gha`.
       *   **Correct Answer:** Extract the correct key ("ka", "kha", "ga", "gha") if marked or listed in a solution key.

**OUTPUT SCHEMA (JSON):**

{
  "questions": [
    {
      "type": "mcq/short/creative",
      "question_text": "Main stem/stimulus in Bengali",
      "has_image": false,
      "image_description": null,
      
      // MCQ ONLY
      "options": {
        "ka": "Option text",
        "kha": "Option text",
        "ga": "Option text",
        "gha": "Option text"
      },
      "correct_answer": null, // "ka"/"kha"/"ga"/"gha" or null
      
      // SHORT QUESTION ONLY (Main Answer)
      "answer": null, // Full detailed answer text for Short questions.
      
      // CREATIVE ONLY (Sub-questions with Full Answers)
      "sub_questions": [
        {
          "index": "ka", 
          "text": "Sub-question text", 
          "mark": 1, 
          "answer": "Full detailed answer/solution text for 'ka' as found in the image"
        },
        {
          "index": "kha", 
          "text": "Sub-question text", 
          "mark": 2, 
          "answer": "Full detailed answer/solution text for 'kha'"
        },
        {
          "index": "ga", 
          "text": "Sub-question text", 
          "mark": 3, 
          "answer": "Full detailed answer/solution text for 'ga'"
        },
        {
          "index": "gha", 
          "text": "Sub-question text", 
          "mark": 4, 
          "answer": "Full detailed answer/solution text for 'gha'"
        }
      ],
      
      "metadata": {
        "board": "Dhaka Board",
        "exam_year": "2023",
        "school_name": null,
        "question_number": "1"
      },
      
      "continues_on_next_page": false
    }
  ]
}
"""


class GeminiStrategy(OCRStrategy):
    """Strategy for Google Gemini Vision with thinking capability"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = "gemini-3-flash-preview"
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

            # Generate content (Async)
            # Use client.aio.models.generate_content for non-blocking async call
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents,
                config=generate_content_config,
            )
            
            try:
                full_response = response.text
            except Exception as e:
                print(f"Error accessing response.text: {e}")
                # Check if there's a safety block or other reason
                if hasattr(response, 'candidates') and response.candidates:
                    print(f"Finish Reason: {response.candidates[0].finish_reason}")
                    print(f"Safety Ratings: {response.candidates[0].safety_ratings}")
                
                return {
                    "questions": [],
                    "error": f"Model blocked response: {str(e)}"
                }
             
            print(f"Gemini Response received ({len(full_response)} chars)")
            # Debug: Log first 500 chars of response to diagnose format issues
            print(f"Response preview: {full_response[:500]}...")
            
            # Parse the JSON response
            data = self._parse_json_response(full_response)
            
            # Normalize question types
            if "questions" in data and isinstance(data["questions"], list):
                for q in data["questions"]:
                    if not isinstance(q, dict): continue
                    
                    raw_type = str(q.get("type", "")).lower()
                    if any(x in raw_type for x in ["mcq", "choice", "multiple"]):
                        q["type"] = "mcq"
                    elif any(x in raw_type for x in ["creative", "srijonshil", "cq"]):
                        q["type"] = "creative"
                    else:
                        q["type"] = "short"
            
            return data
            
        except Exception as e:
            print(f"Gemini API Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "questions": [],
                "error": f"Gemini API Error: {str(e)}"
            }
