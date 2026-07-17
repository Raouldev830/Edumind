from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Dict, Any
import llm_service
import pypdf
import io
from PIL import Image
import easyocr
import database  # Gamification database core

router = APIRouter()

# Initialize the OCR reader once globally when the server starts (English language)
reader = easyocr.Reader(['en'])

# --- Data Validation Schemas ---
class ExplainRequest(BaseModel):
    topic: str
    username: str = "StudentPro"  # Default profile for testing gamification

class QuizRequest(BaseModel):
    context_text: str

class EvaluateRequest(BaseModel):
    quiz_data: List[Dict[str, Any]]
    user_answers: Dict[str, str]  # Format: {"1": "A", "2": "C"}
    topic: str = "General Study"  # Tracks topic history in the dashboard
    username: str = "StudentPro"

class ReexplainRequest(BaseModel):
    topic: str
    original_explanation: str
    weak_points: List[str]

# --- API Endpoints ---

@router.get("/health")
def health_check():
    return {"status": "healthy", "environment": "sandbox_active"}

@router.get("/profile/{username}")
def get_student_profile(username: str):
    """Fetches real-time student gamification profile (XP, Level, Streak)."""
    profile = database.get_user_stats(username)
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return profile

@router.post("/explain")
def explain_topic(data: ExplainRequest):
    ai_response = llm_service.get_explanation(data.topic)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    
    # Award base XP for processing and reading an explanation
    game_rewards = database.update_student_progress(data.username, "read_explanation")
    ai_response["gamification"] = game_rewards
    return ai_response

@router.post("/quiz")
def generate_quiz(data: QuizRequest):
    ai_response = llm_service.get_quiz(data.context_text)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response

@router.post("/evaluate")
def evaluate_quiz(data: EvaluateRequest):
    ai_response = llm_service.evaluate_answers(data.quiz_data, data.user_answers)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    
    # Extract calculated performance scores from the AI evaluation engine
    score = ai_response.get("score", 0)
    total = ai_response.get("total_questions", len(data.user_answers))
    
    # Award performance-based XP, manage active streaks, and update the dashboard history
    game_rewards = database.update_student_progress(
        username=data.username,
        activity_type="complete_quiz",
        quiz_score=score,
        quiz_total=total,
        topic=data.topic
    )
    ai_response["gamification"] = game_rewards
    return ai_response

@router.post("/reexplain")
def reexplain_topic(data: ReexplainRequest):
    ai_response = llm_service.get_reexplanation(data.topic, data.original_explanation, data.weak_points)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response

@router.post("/upload-material")
async def upload_material(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF documents are supported.")
    
    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        
        reader_pdf = pypdf.PdfReader(pdf_file)
        extracted_text = ""
        
        for page in reader_pdf.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        
        if not extracted_text.strip():
            raise HTTPException(
                status_code=422, 
                detail="Could not read text from this PDF. It might be scanned or empty."
            )
            
        return {"filename": file.filename, "extracted_text": extracted_text}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF document: {str(e)}")

@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PNG, JPG, and WEBP images are supported.")
    
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format=image.format)
        img_bytes = img_byte_arr.getvalue()
        
        results = reader.readtext(img_bytes, detail=0)
        extracted_text = " ".join(results)
        
        if not extracted_text.strip():
            raise HTTPException(
                status_code=422, 
                detail="Could not detect any clear text in this image. Make sure it's well-lit and legible."
            )
            
        return {"filename": file.filename, "extracted_text": extracted_text}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")