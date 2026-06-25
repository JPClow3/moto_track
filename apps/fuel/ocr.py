import logging
from typing import TypedDict, Optional
import re
from decimal import Decimal

logger = logging.getLogger(__name__)

class OCRResult(TypedDict):
    liters: Optional[Decimal]
    total_price: Optional[Decimal]
    price_per_liter: Optional[Decimal]
    date: Optional[str]

def parse_receipt_image(file_obj) -> OCRResult:
    """
    Mock OCR service that simulates extracting data from a fuel receipt.
    In a real implementation, this would send `file_obj.read()` to 
    Google Cloud Vision or AWS Textract and parse the response.
    """
    # For now, we return mock data based on a simulated successful scan.
    # We could simulate reading the filename or contents if it was a real test image,
    # but returning static/randomized mock data is sufficient for UI validation.
    
    logger.info(f"Mock OCR scanning file: {file_obj.name}")
    
    return {
        "liters": Decimal("12.500"),
        "total_price": Decimal("75.00"),
        "price_per_liter": Decimal("6.00"),
        "date": None, # Could extract a date but keeping it simple
    }
