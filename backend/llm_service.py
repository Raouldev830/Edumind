"""
MindLoop LLM service layer.

All DeepSeek API interactions live here.  Every public function accepts a
``mode`` parameter ("deep" or "cram") that switches the system prompt
personality between thorough professor and rapid-fire exam coach.
"""

import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# Force load .env from the current folder
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path=env_path)

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)


# ---------------------------------------------------------------------------
# Internal helper — single-retry wrapper around the DeepSeek chat endpoint
# ---------------------------------------------------------------------------

def _call_deepseek(system_prompt: str, user_prompt: str) -> dict:
    """Send a prompt pair to DeepSeek and return parsed JSON. Retries with cleanup."""
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                timeout=45.0,
            )
            raw_content = response.choices[0].message.content.strip()
            # If wrapped in markdown code fence (` ```json ... ` ```), clean it
            if raw_content.startswith("```"):
                lines = raw_content.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_content = "\n".join(lines).strip()
            return json.loads(raw_content)
        except Exception as e:
            print(f"API Attempt {attempt + 1} Error: {e}")
            if attempt == 1:
                return {"error": f"AI Service Error ({type(e).__name__}): {str(e)[:150]}. Please try again."}


# ---------------------------------------------------------------------------
# System-prompt factories
# ---------------------------------------------------------------------------

_EXPLAIN_SYSTEM = {
    "deep": (
        "You are an expert university professor. Explain complex concepts "
        "thoroughly with analogies, real-world examples, and clear structure. "
        "Use markdown formatting for readability. "
        "IMPORTANT: Even if the user asks to generate flashcards, summaries, or code examples, "
        "format your response inside the 'explanation' string (e.g. as markdown flashcard tables or sections) "
        "and MUST return a valid JSON object with keys: "
        "'title' (string), 'explanation' (string, markdown), "
        "'key_takeaways' (array of short bullet-point strings)."
    ),
    "cram": (
        "You are an exam prep specialist. Give compressed, high-yield, "
        "exam-critical facts only. No fluff, no lengthy analogies. "
        "Use bullet points and bold for scanability. "
        "IMPORTANT: Even if the user asks for flashcards or summaries, format them inside 'explanation' "
        "and MUST return a valid JSON object with keys: "
        "'title' (string), 'explanation' (string, markdown), "
        "'key_takeaways' (array of short bullet-point strings)."
    ),
}

_QUIZ_SYSTEM = {
    "deep": (
        "You are an intelligent evaluation tool that generates a MIX of question types "
        "based on the subject matter.\n\n"
        "RULES FOR QUESTION TYPE SELECTION:\n"
        "- For THEORY topics (biology, history, literature, definitions): generate 'mcq' questions.\n"
        "- For MATH/PHYSICS topics (calculus, algebra, equations, derivations, kinematics, circuits, "
        "thermodynamics, electromagnetic fields): generate 'structural' questions that require "
        "the student to SHOW THEIR WORK — solve equations, derive formulas, or compute values step by step.\n"
        "- For CODING/CS topics (algorithms, data structures, Python, JavaScript, system design): "
        "generate 'code' questions that ask the student to write a function, debug code, or explain "
        "what a code snippet does.\n"
        "- You MAY mix types within the same quiz if the material covers both theory AND math/code.\n\n"
        "QUESTION FORMAT BY TYPE:\n"
        "1. MCQ: {\"id\": N, \"type\": \"mcq\", \"question\": \"...\", "
        "\"options\": {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}, "
        "\"correct_answer\": \"B\", \"concept_tag\": \"...\"}\n"
        "2. STRUCTURAL: {\"id\": N, \"type\": \"structural\", \"question\": \"Derive/Solve/Calculate ...\", "
        "\"correct_answer\": \"Full worked solution with steps\", \"concept_tag\": \"...\", "
        "\"hint\": \"Optional formula hint\"}\n"
        "3. CODE: {\"id\": N, \"type\": \"code\", \"question\": \"Write a function that ...\", "
        "\"correct_answer\": \"def example(): ...\", \"concept_tag\": \"...\", "
        "\"hint\": \"Optional approach hint\"}\n\n"
        "IMPORTANT: For MCQ, 'options' MUST be a JSON OBJECT {\"A\": ..., \"B\": ..., \"C\": ..., \"D\": ...}. "
        "For structural and code, do NOT include 'options'.\n"
        "Return a JSON object: {\"questions\": [...]}"
    ),
    "cram": (
        "You are a rapid-fire exam coach that generates a MIX of question types "
        "based on the subject matter.\n\n"
        "RULES FOR QUESTION TYPE SELECTION:\n"
        "- For THEORY topics: generate 'mcq' questions focused on recall.\n"
        "- For MATH/PHYSICS topics: generate 'structural' questions — shorter calculations, "
        "formula application, quick derivations. Keep them exam-style and concise.\n"
        "- For CODING/CS topics: generate 'code' questions — short function writing, "
        "output prediction, or bug fixing.\n\n"
        "QUESTION FORMAT BY TYPE:\n"
        "1. MCQ: {\"id\": N, \"type\": \"mcq\", \"question\": \"...\", "
        "\"options\": {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}, "
        "\"correct_answer\": \"B\", \"concept_tag\": \"...\"}\n"
        "2. STRUCTURAL: {\"id\": N, \"type\": \"structural\", \"question\": \"Calculate/Solve ...\", "
        "\"correct_answer\": \"Worked solution\", \"concept_tag\": \"...\", "
        "\"hint\": \"Formula hint\"}\n"
        "3. CODE: {\"id\": N, \"type\": \"code\", \"question\": \"Write a function ...\", "
        "\"correct_answer\": \"def example(): ...\", \"concept_tag\": \"...\", "
        "\"hint\": \"Approach hint\"}\n\n"
        "IMPORTANT: For MCQ, 'options' MUST be a JSON OBJECT. "
        "For structural and code, do NOT include 'options'.\n"
        "Return a JSON object: {\"questions\": [...]}"
    ),
}

_EVALUATE_SYSTEM = (
    "You are an expert academic grader capable of evaluating BOTH multiple-choice "
    "AND free-text/structural/code answers.\n\n"
    "For each question:\n"
    "- If type is 'mcq': check if the user's letter (A/B/C/D) matches correct_answer exactly.\n"
    "- If type is 'structural': compare the student's worked solution against the model answer. "
    "Award credit if the student demonstrates correct methodology and arrives at the right answer, "
    "even if their notation or phrasing differs. Partial credit counts as INCORRECT for scoring "
    "but mention partial understanding in feedback.\n"
    "- If type is 'code': check if the student's code would produce the correct output or "
    "implements the correct algorithm. Minor syntax issues or different variable names are OK "
    "if the logic is correct.\n\n"
    "Return a JSON object with these exact keys: "
    "'score' (INTEGER — number of correct answers), "
    "'total_questions' (INTEGER — total number of questions), "
    "'passed' (BOOLEAN — true if score >= 50%%), "
    "'weak_points' (ARRAY of concept_tag STRINGS from questions the student got wrong), "
    "'feedback' (STRING — detailed feedback covering each question type, mentioning which "
    "structural/code answers were close and what was missing), "
    "'per_question_feedback' (ARRAY of objects with 'id', 'correct' (bool), "
    "and 'comment' (string explaining why right/wrong) for each question)."
)

_REEXPLAIN_SYSTEM = {
    "deep": (
        "You are an adaptive tutor. The student struggled with specific "
        "concepts during their quiz. Re-explain the topic, focusing "
        "directly on fixing their weak points. Use a DIFFERENT analogy "
        "and a worked example. Do NOT repeat the original explanation. "
        "Return a JSON object with keys: "
        "'title' (string), 're_explanation' (string, markdown), "
        "'reassurance' (string — encouraging sign-off)."
    ),
    "cram": (
        "You are a last-minute exam coach. The student missed key concepts. "
        "Give a compressed alternative angle on those concepts — different "
        "mnemonics, different framing — in exam-ready bullet form. "
        "Return a JSON object with keys: "
        "'title' (string), 're_explanation' (string, markdown), "
        "'reassurance' (string — encouraging sign-off)."
    ),
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_explanation(topic: str, mode: str = "deep", weak_points: list | None = None) -> dict:
    """Generate a topic explanation in the requested mode."""
    system = _EXPLAIN_SYSTEM.get(mode, _EXPLAIN_SYSTEM["deep"])
    user = f"Explain this topic in depth: {topic}"

    if weak_points:
        user += (
            f"\n\nNote: this student previously struggled with: "
            f"{', '.join(weak_points)}. Pay extra attention to those areas."
        )

    return _call_deepseek(system, user)


def get_quiz(context_text: str, mode: str = "deep", num_questions: int = 4) -> dict:
    """Generate quiz questions from the provided study material."""
    system = _QUIZ_SYSTEM.get(mode, _QUIZ_SYSTEM["deep"])
    user = (
        f"Generate exactly {num_questions} questions based on this study material.\n"
        f"CRITICAL RULES:\n"
        f"1. Analyze whether the material involves mathematics, equations, physics, numerical calculation, or derivations.\n"
        f"   - If YES (e.g. quadratic equations, inclined plane, kinematics, calculus), you MUST generate 'structural' questions requiring step-by-step worked calculations. Do NOT generate MCQ for math problems.\n"
        f"2. If the material involves programming/CS, generate 'code' questions.\n"
        f"3. Only use 'mcq' for theoretical/conceptual definitions.\n\n"
        f"Study Material:\n\n{context_text}"
    )
    return _call_deepseek(system, user)


def evaluate_answers(quiz_data: list, user_answers: dict) -> dict:
    """Grade the user's answers and identify weak points."""
    user = (
        f"Original Quiz Data: {json.dumps(quiz_data)}\n\n"
        f"User Answers Submitted: {json.dumps(user_answers)}"
    )
    return _call_deepseek(_EVALUATE_SYSTEM, user)


def get_reexplanation(
    topic: str,
    original_explanation: str,
    weak_points: list,
    mode: str = "deep",
) -> dict:
    """Re-explain a topic focusing on the student's weak points."""
    system = _REEXPLAIN_SYSTEM.get(mode, _REEXPLAIN_SYSTEM["deep"])
    user = (
        f"Topic: {topic}\n"
        f"Original Explanation: {original_explanation}\n"
        f"Concepts they got wrong: {json.dumps(weak_points)}"
    )
    return _call_deepseek(system, user)