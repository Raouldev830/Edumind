"""
Pydantic models for MindLoop.

These define the exact JSON shape every endpoint accepts and returns.
Frontend (Person B) builds against these shapes from hour one, using
mocked data, before the backend logic is finished. Do not change a
field name here without telling the whole team — it breaks the contract.
"""

from pydantic import BaseModel
from typing import List, Optional


# ---------- /explain ----------

class ExplainRequest(BaseModel):
    content: str                       # the pasted topic/note text
    weak_points: Optional[List[str]] = []  # concept tags the student struggled with before


class ExplainResponse(BaseModel):
    explanation: str
    level: str                         # e.g. "beginner", "intermediate", "technical"


# ---------- /quiz ----------

class QuizRequest(BaseModel):
    content: str                       # the explained content to quiz on
    difficulty: str = "intermediate"
    num_questions: int = 4


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer: str
    concept_tag: str                   # short label identifying what this question tests


class QuizResponse(BaseModel):
    questions: List[QuizQuestion]


# ---------- /evaluate ----------

class SubmittedAnswer(BaseModel):
    question: str
    selected: str
    concept_tag: str


class EvaluateRequest(BaseModel):
    answers: List[SubmittedAnswer]
    correct_answers: List[QuizQuestion]  # original questions with correct answers, to check against


class MissedConcept(BaseModel):
    concept_tag: str
    question: str


class EvaluateResponse(BaseModel):
    score: int
    total: int
    missed_concepts: List[MissedConcept]


# ---------- /reexplain ----------

class ReexplainRequest(BaseModel):
    concept_tag: str
    original_content: str              # source material, so it can re-explain in context
    previous_explanation: str          # so the model avoids repeating itself


class ReexplainResponse(BaseModel):
    explanation: str
