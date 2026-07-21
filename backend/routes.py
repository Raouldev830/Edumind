"""
MindLoop API routes.

All request/response models are imported from schemas.py — the single
source of truth for the API contract.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any
import io
import pypdf
from PIL import Image
import easyocr

import llm_service
import database
from schemas import (
    ExplainRequest,
    QuizRequest,
    EvaluateRequest,
    ReexplainRequest,
    ResolveWeakPointRequest,
    FlashcardRequest,
    FlashcardResponse,
    AnalogyRequest,
    AnalogyResponse,
)

router = APIRouter()

# Initialize the OCR reader once globally when the server starts (English language)
reader = easyocr.Reader(["en"])


# ---------------------------------------------------------------------------
# Health & Profile
# ---------------------------------------------------------------------------

@router.get("/health")
def health_check():
    return {"status": "healthy", "environment": "sandbox_active"}


@router.get("/profile/{username}")
def get_student_profile(username: str):
    """Fetches real-time student gamification profile (XP, Level, Streak)."""
    profile = database.get_user_stats(username)
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found")

    # Attach active weak points to the profile response
    profile["weak_points"] = database.get_active_weak_points(username)
    return profile


# ---------------------------------------------------------------------------
# Core Study Loop
# ---------------------------------------------------------------------------

@router.post("/explain")
def explain_topic(data: ExplainRequest):
    """Generate an AI explanation, enriched with the student's weak-point history."""
    # Fetch the student's existing weak-point concept tags so the AI can
    # pay extra attention to areas they previously struggled with.
    active_weak = database.get_active_weak_points(data.username)
    weak_tags = [wp["concept_tag"] for wp in active_weak] if active_weak else None

    ai_response = llm_service.get_explanation(
        topic=data.topic,
        mode=data.mode,
        weak_points=weak_tags,
    )
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])

    # Award base XP for processing and reading an explanation
    game_rewards = database.update_student_progress(data.username, "read_explanation")
    ai_response["gamification"] = game_rewards
    return ai_response


@router.post("/quiz")
def generate_quiz(data: QuizRequest):
    """Generate quiz questions from study material."""
    ai_response = llm_service.get_quiz(
        context_text=data.context_text,
        mode=data.mode,
        num_questions=data.num_questions,
    )
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response


@router.post("/evaluate")
def evaluate_quiz(data: EvaluateRequest):
    """Grade the student's quiz answers and persist weak points.

    Supports mixed question types: MCQ (letter matching), structural
    (AI-graded worked solutions), and code (AI-graded implementations).
    """
    ai_response = llm_service.evaluate_answers(data.quiz_data, data.user_answers)
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])

    # --- Parse score safely as int ---
    raw_score = ai_response.get("score", 0)
    if isinstance(raw_score, str):
        try:
            raw_score = int(raw_score.split("/")[0])
        except (ValueError, IndexError):
            raw_score = 0
    score = int(raw_score)

    total = int(ai_response.get("total_questions", len(data.user_answers)))

    # --- Build per-question result breakdown ---
    # Use AI per_question_feedback when available (needed for structural/code grading)
    ai_per_q = {
        item["id"]: item
        for item in ai_response.get("per_question_feedback", [])
        if isinstance(item, dict) and "id" in item
    }

    results = []
    for q in data.quiz_data:
        qid = str(q.get("id", ""))
        qid_int = q.get("id", 0)
        q_type = q.get("type", "mcq")
        user_ans = data.user_answers.get(qid, "")
        correct_ans = q.get("correct_answer", "")

        if q_type == "mcq":
            # Simple key comparison for MCQ
            is_correct = user_ans.strip().upper() == correct_ans.strip().upper()
        else:
            # For structural/code, rely on AI grader's judgement
            ai_q = ai_per_q.get(qid_int, {})
            is_correct = ai_q.get("correct", False)

        comment = ai_per_q.get(qid_int, {}).get("comment", "")

        results.append({
            "question_id": qid_int,
            "correct": is_correct,
            "correct_answer": correct_ans,
            "user_answer": user_ans,
            "type": q_type,
            "comment": comment,
        })

    # --- Persist weak points from missed concepts ---
    weak_points = ai_response.get("weak_points", [])
    if isinstance(weak_points, list) and weak_points:
        database.add_weak_points(data.username, weak_points, data.topic)

    # --- Award performance-based XP ---
    game_rewards = database.update_student_progress(
        username=data.username,
        activity_type="complete_quiz",
        quiz_score=score,
        quiz_total=total,
        topic=data.topic,
    )

    return {
        "score": score,
        "total_questions": total,
        "passed": ai_response.get("passed", score >= total / 2 if total else False),
        "weak_points": weak_points,
        "feedback": ai_response.get("feedback", ""),
        "results": results,
        "per_question_feedback": ai_response.get("per_question_feedback", []),
        "gamification": game_rewards,
    }


@router.post("/reexplain")
def reexplain_topic(data: ReexplainRequest):
    """Re-explain a topic with focus on weak points."""
    ai_response = llm_service.get_reexplanation(
        topic=data.topic,
        original_explanation=data.original_explanation,
        weak_points=data.weak_points,
        mode=data.mode,
    )
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response


@router.post("/flashcards", response_model=FlashcardResponse)
def generate_flashcards_route(data: FlashcardRequest):
    """Generate flip-style flashcards from explained content."""
    ai_response = llm_service.generate_flashcards(
        content=data.content,
        mode=data.mode,
    )
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response


@router.post("/analogy", response_model=AnalogyResponse)
def generate_analogy_route(data: AnalogyRequest):
    """Generate ONE real-world analogy from explained content."""
    ai_response = llm_service.generate_analogy(
        content=data.content,
        mode=data.mode,
    )
    if "error" in ai_response:
        raise HTTPException(status_code=502, detail=ai_response["error"])
    return ai_response


# ---------------------------------------------------------------------------
# Weak Points
# ---------------------------------------------------------------------------

@router.get("/weak-points/{username}")
def get_weak_points(username: str):
    """Return all active (unresolved) weak points for a student."""
    return {"weak_points": database.get_active_weak_points(username)}


@router.post("/resolve-weak-point")
def resolve_weak_point(data: ResolveWeakPointRequest):
    """Mark a weak-point concept as resolved."""
    database.resolve_weak_point(data.username, data.concept_tag)
    return {"resolved": True}


# ---------------------------------------------------------------------------
# File Uploads (unchanged)
# ---------------------------------------------------------------------------

@router.post("/upload-material")
async def upload_material(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF documents are supported.",
        )

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
                detail="Could not read text from this PDF. It might be scanned or empty.",
            )

        return {"filename": file.filename, "extracted_text": extracted_text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF document: {str(e)}",
        )


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PNG, JPG, and WEBP images are supported.",
        )

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
                detail="Could not detect any clear text in this image. Make sure it's well-lit and legible.",
            )

        return {"filename": file.filename, "extracted_text": extracted_text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process image: {str(e)}",
        )