from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Dict, Any
import llm_service
import pypdf
import io

router = APIRouter()

# --- Data Validation Schemas ---
class ExplainRequest(BaseModel):
    topic: str

class QuizRequest(BaseModel):
    context_text: str

class EvaluateRequest(BaseModel):
    quiz_data: List[Dict[str, Any]]
    user_answers: Dict[str, str]  # Format: {"1": "A", "2": "C"}

class ReexplainRequest(BaseModel):
    topic: str
    original_explanation: str
    weak_points: List[str]

# --- API Endpoints ---

@router.get("/health")
def health_check():
    return {"status": "healthy", "environment": "sandbox_active"}

@router.post("/explain")
def explain_topic(data: ExplainRequest):
    ai_response = llm_service.get_explanation(data.topic)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
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
    return ai_response

@router.post("/reexplain")
def reexplain_topic(data: ReexplainRequest):
    ai_response = llm_service.get_reexplanation(data.topic, data.original_explanation, data.weak_points)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response

@router.post("/upload-material")
async def upload_material(file: UploadFile = File(...)):
    # 1. Block non-PDF files early
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF documents are supported.")
    
    try:
        # 2. Read file contents into memory safely
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        
        # 3. Initialize the PDF reader and extract text page by page
        reader = pypdf.PdfReader(pdf_file)
        extracted_text = ""
        
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"
        
        # 4. Check if extraction succeeded (makes sure it's not a blank file or pure image scan)
        if not extracted_text.strip():
            raise HTTPException(
                status_code=422, 
                detail="Could not read text from this PDF. It might be scanned or empty."
            )
            
        return {"filename": file.filename, "extracted_text": extracted_text}
        
    except HTTPException:
        # Re-raise explicit HTTP exceptions we generated above
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF document: {str(e)}")