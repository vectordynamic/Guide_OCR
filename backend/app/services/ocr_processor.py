"""
OCR Processor for Google Gemini

Uses Google Gemini exclusively for OCR processing.
"""
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.ocr_strategy_implementations import GeminiStrategy


class OCRProcessor:
    """
    Main OCR Processor using Google Gemini.
    Use as a singleton.
    """
    
    def __init__(self):
        self.strategy: Optional[GeminiStrategy] = None
        self._initialize_strategy()
    
    def _initialize_strategy(self):
        """Initialize the Gemini OCR strategy"""
        print(f"Initializing Google Gemini OCR strategy")
        self.strategy = GeminiStrategy(api_key=settings.GEMINI_API_KEY)
    
    async def process_image(self, image_url: str) -> Dict[str, Any]:
        """
        Process an image using Google Gemini.
        
        Args:
            image_url: Public URL of the image to process
            
        Returns:
            Dictionary with questions in standard format
        """
        if not self.strategy:
            raise RuntimeError("OCR strategy not initialized")
        
        return await self.strategy.process_image(image_url)


# Singleton instance
_ocr_processor_instance: Optional[OCRProcessor] = None


def get_ocr_processor() -> OCRProcessor:
    """Get or create singleton OCR processor instance"""
    global _ocr_processor_instance
    if _ocr_processor_instance is None:
        _ocr_processor_instance = OCRProcessor()
    return _ocr_processor_instance

