"""
API ROUTES — owned by backend (you).

This file only does HTTP plumbing: validate input, call llm_service,
shape the response, handle errors gracefully. It never talks to
DeepSeek directly — that's llm_service.py's job (Person C).
"""

from fastapi import APIRouter, HTTPException

import llm_service
from schemas import (
    ExplainRequest, ExplainResponse,
    QuizRequest, QuizResponse,
    EvaluateRequest, EvaluateResponse, MissedConcept,
    ReexplainRequest, ReexplainResponse,
)

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    try:
        result = llm_service.generate_explanation(req.content, req.weak_points)
        return ExplainResponse(**result)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not generate explanation. Please try again.")


@router.post("/quiz", response_model=QuizResponse)
def quiz(req: QuizRequest):
    try:
        result = llm_service.generate_quiz(req.content, req.difficulty, req.num_questions)
        return QuizResponse(**result)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not generate quiz. Please try again.")


@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate(req: EvaluateRequest):
    # This logic is pure Python, no LLM call needed — deterministic scoring.
    correct_map = {q.question: q.answer for q in req.correct_answers}
    missed = []
    score = 0

    for ans in req.answers:
        correct_answer = correct_map.get(ans.question)
        if correct_answer == ans.selected:
            score += 1
        else:
            missed.append(MissedConcept(concept_tag=ans.concept_tag, question=ans.question))

    return EvaluateResponse(score=score, total=len(req.answers), missed_concepts=missed)


@router.post("/reexplain", response_model=ReexplainResponse)
def reexplain(req: ReexplainRequest):
    try:
        result = llm_service.generate_reexplanation(
            req.concept_tag, req.original_content, req.previous_explanation
        )
        return ReexplainResponse(**result)
    except Exception:
        raise HTTPException(status_code=502, detail="Could not re-explain. Please try again.")
