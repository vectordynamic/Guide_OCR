"""
OCR Processor for Google Gemini

Uses Google Gemini exclusively for OCR processing.
"""
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.ocr_strategies import OCRStrategy
from app.services.ocr_strategy_implementations import GeminiStrategy, Gemma4Strategy


class OCRProcessor:
    """
    Main OCR Processor using dynamic strategies.
    """
    
    def __init__(self, strategy: OCRStrategy):
        self.strategy = strategy
    
    async def process_image(self, image_url: str, continuation_context: str = None) -> Dict[str, Any]:
        """
        Process an image using the selected strategy.
        """
        if not self.strategy:
            raise RuntimeError("OCR strategy not initialized")
        
        return await self.strategy.process_image(image_url, continuation_context)


SUPPORTED_MODELS = {
    "gemini-3-flash-preview": lambda key: GeminiStrategy(api_key=key),
    "gemma-4-31b-it":         lambda key: Gemma4Strategy(api_key=key),
}


def get_ocr_processor(model: str = "gemini-3-flash-preview") -> OCRProcessor:
    """Get a processor for a specific model."""
    if model not in SUPPORTED_MODELS:
        print(f"Warning: Model {model} not found, falling back to Gemini.")
        model = "gemini-3-flash-preview"
        
    strategy = SUPPORTED_MODELS[model](settings.GEMINI_API_KEY)
    return OCRProcessor(strategy=strategy)
