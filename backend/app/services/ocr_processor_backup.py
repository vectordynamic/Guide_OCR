"""
OCR Processor with Multi-Provider Strategy Pattern

Supports easy switching between OCR providers via configuration:
- Z.AI GLM-4.6V (Vision Chat Model)
- Z.AI GLM-OCR (Specialized Layout Parsing)
- Google Gemini (Placeholder)
- OpenAI GPT-4o (Placeholder)
"""
from typing import Dict, Any, Optional
from app.core.config import settings
from app.services.ocr_strategy_implementations import (
    ZAIGLMVisionStrategy,
    ZAIGLMOCRStrategy,
    GeminiStrategy,
    OpenAIStrategy,
    OCRStrategy
)


class OCRProcessor:
    """
    Main OCR Processor that delegates to provider-specific strategies.
    Use as a singleton.
    """
    
    def __init__(self):
        self.strategy: Optional[OCRStrategy] = None
        self._initialize_strategy()
    
    def _initialize_strategy(self):
        """Initialize the OCR strategy based on configuration"""
        provider = settings.OCR_PROVIDER.lower()
        
        if provider == "zai-glm-4.6v":
            print(f"Initializing Z.AI GLM-4.6V (Vision) OCR strategy")
            self.strategy = ZAIGLMVisionStrategy(
                api_key=settings.ZAI_API_KEY,
                base_url=settings.ZAI_BASE_URL
            )
        
        elif provider == "zai-glm-ocr":
            print(f"Initializing Z.AI GLM-OCR (Layout Parsing) strategy")
            self.strategy = ZAIGLMOCRStrategy(
                api_key=settings.ZAI_API_KEY,
                base_url=settings.ZAI_BASE_URL
            )
        
        elif provider == "gemini-1.5-pro":
            print(f"Initializing Google Gemini strategy")
            self.strategy = GeminiStrategy(
                api_key=settings.GEMINI_API_KEY
            )
        
        elif provider == "openai-gpt-4o":
            print(f"Initializing OpenAI GPT-4o strategy")
            self.strategy = OpenAIStrategy(
                api_key=settings.OPENAI_API_KEY
            )
        
        else:
            raise ValueError(
                f"Unknown OCR_PROVIDER: {settings.OCR_PROVIDER}. "
                f"Supported: zai-glm-4.6v, zai-glm-ocr, gemini-1.5-pro, openai-gpt-4o"
            )
    
    async def process_image(self, image_url: str) -> Dict[str, Any]:
        """
        Process an image using the configured OCR provider.
        
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
