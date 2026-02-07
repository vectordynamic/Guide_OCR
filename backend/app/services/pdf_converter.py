"""
PDF to Image Converter Service
Converts PDF pages to high-resolution lossless PNG images.
"""
import os
import tempfile
from pathlib import Path
from typing import List, Tuple
from pdf2image import convert_from_path


class PDFConverter:
    """Convert PDF pages to high-quality PNG images."""
    
    DPI = 200  # Good balance between quality and API speed
    FORMAT = "png"  # Lossless format, no compression artifacts
    
    @staticmethod
    def convert(pdf_path: str, output_dir: str = None) -> List[Tuple[int, str]]:
        """
        Convert PDF to PNG images at 300 DPI.
        
        Args:
            pdf_path: Path to the PDF file
            output_dir: Directory to save images (uses temp if not provided)
            
        Returns:
            List of (page_number, image_path) tuples
        """
        if output_dir is None:
            output_dir = tempfile.mkdtemp()
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert PDF to images
        images = convert_from_path(
            pdf_path,
            dpi=PDFConverter.DPI,
            fmt=PDFConverter.FORMAT
        )
        
        result = []
        for i, image in enumerate(images, start=1):
            # Save with structured naming: page_001.png, page_002.png, etc.
            filename = f"page_{i:03d}.png"
            filepath = os.path.join(output_dir, filename)
            image.save(filepath, PDFConverter.FORMAT.upper())
            result.append((i, filepath))
        
        return result
    
    @staticmethod
    def get_page_count(pdf_path: str) -> int:
        """Get total number of pages in PDF without converting."""
        from pdf2image.pdf2image import pdfinfo_from_path
        info = pdfinfo_from_path(pdf_path)
        return info.get("Pages", 0)


# Convenience function
def convert_pdf_to_images(pdf_path: str, output_dir: str = None) -> List[Tuple[int, str]]:
    """Convert PDF to lossless PNG images at 300 DPI."""
    return PDFConverter.convert(pdf_path, output_dir)
