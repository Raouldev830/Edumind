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
    """Send a prompt pair to DeepSeek and return parsed JSON.  Retries once."""
    try:
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        # Simple fallback retry if the first call glitches
        print(f"API Error encountered: {e}. Retrying once...")
        try:
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
            )
            return json.loads(response.choices[0].message.content)
        except Exception as final_error:
            print(f"Final failure: {final_error}")
            return {"error": "Failed to communicate with AI helper. Try again shortly."}


# ---------------------------------------------------------------------------
# System-prompt factories
# ---------------------------------------------------------------------------

_EXPLAIN_SYSTEM = {
    "deep": (
        "You are an expert university professor. Explain complex concepts "
        "thoroughly with analogies, real-world examples, and clear structure. "
        "Use markdown formatting for readability. "
        "Return a JSON object with keys: "
        "'title' (string), 'explanation' (string, markdown), "
        "'key_takeaways' (array of short bullet-point strings)."
    ),
    "cram": (
        "You are an exam prep specialist. Give compressed, high-yield, "
        "exam-critical facts only. No fluff, no lengthy analogies. "
        "Use bullet points and bold for scanability. "
        "Return a JSON object with keys: "
        "'title' (string), 'explanation' (string, markdown), "
        "'key_takeaways' (array of short bullet-point strings)."
    ),
}

_QUIZ_SYSTEM = {
    "deep": (
        "You are an automated evaluation tool. Generate conceptual "
        "multiple-choice questions that test deep understanding — "
        "application, analysis, and reasoning — not just recall. "
        "Each question MUST include a 'concept_tag' field: a short label "
        "identifying what concept the question tests. "
        "CRITICAL: 'options' MUST be a JSON OBJECT with keys A, B, C, D — "
        "NOT an array. Example: {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}. "
        "Return a JSON object: "
        "{\"questions\": [{\"id\": 1, \"question\": \"...\", "
        "\"options\": {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}, "
        "\"correct_answer\": \"A\", \"concept_tag\": \"...\"}]}"
    ),
    "cram": (
        "You are a rapid-fire exam coach. Generate rapid-recall, "
        "fact-based multiple-choice questions focusing on definitions, "
        "formulas, key facts, and direct recall. "
        "Each question MUST include a 'concept_tag' field: a short label "
        "identifying what concept the question tests. "
        "CRITICAL: 'options' MUST be a JSON OBJECT with keys A, B, C, D — "
        "NOT an array. Example: {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}. "
        "Return a JSON object: "
        "{\"questions\": [{\"id\": 1, \"question\": \"...\", "
        "\"options\": {\"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\"}, "
        "\"correct_answer\": \"A\", \"concept_tag\": \"...\"}]}"
    ),
}

_EVALUATE_SYSTEM = (
    "You are an academic grader. Compare the user's answers against the "
    "original quiz questions and their correct answers. "
    "Return a JSON object with these exact keys: "
    "'score' (INTEGER — number of correct answers), "
    "'total_questions' (INTEGER — total number of questions), "
    "'passed' (BOOLEAN — true if score >= 50%%), "
    "'weak_points' (ARRAY of concept_tag STRINGS from questions the student got wrong), "
    "'feedback' (STRING — brief encouraging feedback on their performance)."
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
        f"Generate exactly {num_questions} multiple-choice quiz questions "
        f"based on this study material:\n\n{context_text}"
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