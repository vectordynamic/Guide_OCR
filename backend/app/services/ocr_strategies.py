"""
OCR Strategy Base Classes

This module defines the abstract base class for OCR strategies
and implements concrete strategies for different AI providers.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any
import httpx


class OCRStrategy(ABC):
    """Abstract base class for OCR strategies."""
    
    @abstractmethod
    async def process_image(self, image_url: str, continuation_context: str = None) -> Dict[str, Any]:
        """
        Process an image and extract questions.
        
        Args:
            image_url: Public URL of the image to process
            continuation_context: Optional context snippet from the previous page for stitching
            
        Returns:
            Dictionary containing extracted questions in standard format
        """
        pass
    
    def _parse_json_response(self, content: str) -> Dict[str, Any]:
        """
        Shared JSON parsing logic with fallback handling.
        Handles markdown code blocks, plain JSON, and embedded JSON.
        """
        import re
        import json
        
        content = content.strip()
        
        # Helper to attempt parse
        def attempt_parse(text):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return None

        # 1. Try direct parse
        res = attempt_parse(content)
        if hasattr(res, 'get') is False and isinstance(res, list):
            return {"questions": res}
        if res: return res

        # 2. Extract from Markdown code blocks (regex is safer than startswith)
        # Matches ```json ... ``` or just ``` ... ```
        # We find ALL matches and try them, just in case the first one isn't the JSON
        code_block_pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
        matches = re.findall(code_block_pattern, content)
        for match in matches:
            res = attempt_parse(match)
            if res: return res
        
        # 3. Extract purely between first { and last }
        # This handles text before/after
        json_pattern = r"\{[\s\S]*\}"
        match = re.search(json_pattern, content)
        if match:
            found_json = match.group(0)
            res = attempt_parse(found_json)
            if res: return res
            
            # 3.1 Try repairing the found JSON block
            repaired = self._repair_truncated_json(found_json)
            res = attempt_parse(repaired)
            if res: return res

        # 4. Fallback: Try repairing the original content
        repaired = self._repair_truncated_json(content)
        res = attempt_parse(repaired)
        if res: return res
        
        # If all fails, return error format
        print(f"Failed to parse JSON. Content preview: {content[:200]}...")
        return {
            "questions": [],
            "error": "Failed to parse LLM response",
            "raw_content": content[:500]
        }
    
    def _repair_truncated_json(self, content: str) -> str:
        """Repair truncated JSON by closing open brackets and removing trailing commas."""
        content = content.strip()
        
        # Close open string if necessary
        if content.count('"') % 2 != 0:
            content += '"'
        
        # Remove trailing comma (common in truncated JSON)
        content = content.rstrip()
        if content.endswith(','):
            content = content[:-1].rstrip()
            
        # Stack to track open brackets
        stack = []
        for char in content:
            if char == '{':
                stack.append('}')
            elif char == '[':
                stack.append(']')
            elif char == '}' or char == ']':
                if stack and char == stack[-1]:
                    stack.pop()
        
        # Append closing characters in reverse order
        while stack:
            content += stack.pop()
            
        return content
