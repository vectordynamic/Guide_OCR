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
    async def process_image(self, image_url: str) -> Dict[str, Any]:
        """
        Process an image and extract questions.
        
        Args:
            image_url: Public URL of the image to process
            
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
        
        # Try direct JSON parse first
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Remove markdown code blocks
        if content.startswith("```"):
            content = re.sub(r'^```(?:json)?\s*', '', content)
            content = re.sub(r'\s*```$', '', content)
            content = content.strip()
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
        
        # Extract JSON object from surrounding text
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass
        
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
