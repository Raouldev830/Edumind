"""
Pydantic models for MindLoop.

These define the exact JSON shape every endpoint accepts and returns.
Frontend builds against these shapes — do not change a field name here
without telling the whole team, it breaks the contract.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional


# ---------------------------------------------------------------------------
# /explain
# ---------------------------------------------------------------------------

class ExplainRequest(BaseModel):
    topic: str
    username: str = "StudentPro"
    mode: str = "deep"  # "deep" | "cram"


class ExplainResponse(BaseModel):
    title: str
    explanation: str
    key_takeaways: List[str]
    gamification: dict = {}


# ---------------------------------------------------------------------------
# /quiz
# ---------------------------------------------------------------------------

class QuizRequest(BaseModel):
    context_text: str
    mode: str = "deep"  # "deep" | "cram"
    num_questions: int = 4


class QuizQuestionOptions(BaseModel):
    A: str
    B: str
    C: str
    D: str


class QuizQuestion(BaseModel):
    id: int
    question: str
    options: Dict[str, str]  # {"A": "...", "B": "...", "C": "...", "D": "..."}
    correct_answer: str
    concept_tag: str


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]


# ---------------------------------------------------------------------------
# /evaluate
# ---------------------------------------------------------------------------

class EvaluateRequest(BaseModel):
    quiz_data: List[Dict]  # list of question dicts from the quiz response
    user_answers: Dict[str, str]  # {"1": "A", "2": "C", ...}
    topic: str = "General Study"
    username: str = "StudentPro"


class EvaluateResult(BaseModel):
    question_id: int
    correct: bool
    correct_answer: str
    user_answer: str


class EvaluateResponse(BaseModel):
    score: int
    total_questions: int
    passed: bool
    weak_points: List[str]
    feedback: str
    results: List[EvaluateResult]
    gamification: dict = {}


# ---------------------------------------------------------------------------
# /reexplain
# ---------------------------------------------------------------------------

class ReexplainRequest(BaseModel):
    topic: str
    original_explanation: str
    weak_points: List[str]
    mode: str = "deep"  # "deep" | "cram"


class ReexplainResponse(BaseModel):
    title: str
    re_explanation: str
    reassurance: str


# ---------------------------------------------------------------------------
# /profile/{username}
# ---------------------------------------------------------------------------

class WeakPointEntry(BaseModel):
    concept_tag: str
    topic: str
    times_missed: int
    created_at: Optional[str] = None


class ProfileResponse(BaseModel):
    username: str
    xp: int
    level: int
    streak: int
    last_active: Optional[str]
    xp_next_level: int
    weak_points: List[WeakPointEntry] = []


# ---------------------------------------------------------------------------
# /weak-points/{username}
# ---------------------------------------------------------------------------

class WeakPointsResponse(BaseModel):
    weak_points: List[WeakPointEntry]


# ---------------------------------------------------------------------------
# /resolve-weak-point
# ---------------------------------------------------------------------------

class ResolveWeakPointRequest(BaseModel):
    username: str
    concept_tag: str


class ResolveWeakPointResponse(BaseModel):
    resolved: bool = True
