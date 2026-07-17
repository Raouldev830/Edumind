from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import llm_service

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