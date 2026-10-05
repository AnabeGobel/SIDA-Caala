from pydantic import BaseModel
from typing import List, Optional

class BoundingBox(BaseModel):
    x_min: float
    y_min: float
    x_max: float
    y_max: float

class DetectionResult(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox

class DetectionResponse(BaseModel):
    success: bool
    total_detections: int
    detections: List[DetectionResult]
    image_url: Optional[str] = None
    analysis_id: str
    created_at: str
    inference_ms: int
    fps: float
    message: str