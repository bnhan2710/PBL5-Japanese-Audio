from pydantic import BaseModel
from typing import List, Optional, Literal

class ImageOptionGenerate(BaseModel):
    """Sử dụng trong Service để lưu trữ kế hoạch vẽ từng ô"""
    label: str  # 1, 2, 3, 4
    description: str # Prompt tiếng Anh

class VisualPlanResponse(BaseModel):
    master_setting: str
    options: List[ImageOptionGenerate]

class AIImageTaskRequest(BaseModel):
    question_id: str
    script_text: str
    question_text: str
    jlpt_level: str
    # Thêm mode để linh hoạt: 'quad' (4 ô) hoặc 'single' (1 hình)
    mode: Literal["quad", "single"] = "quad"

class ImageResultData(BaseModel):
    question_id: str
    image_url: str  # URL ảnh cuối cùng từ Cloudinary
    prompts_used: List[str] # Danh sách các prompt AI đã dùng để vẽ

class AIImageResponse(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""

class AIImageJobStatus(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""
    result: Optional[ImageResultData] = None
    error: Optional[str] = None