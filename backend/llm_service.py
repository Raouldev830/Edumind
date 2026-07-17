"""
LLM SERVICE LAYER — owned by Person C (LLM / prompt engineering).

Rule for the team: only Person C edits this file, to avoid merge conflicts.
Backend (routes.py) only ever calls these four functions and never talks
to the DeepSeek API directly.

Every function must:
  1. Return data matching the schema in schemas.py (not raw strings).
  2. Handle a failed/malformed response with ONE retry, then raise a
     clear exception that routes.py can catch and turn into a friendly
     error for the user.
  3. Force the model to reply with JSON only — see SYSTEM_PROMPT below.
"""
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 1. Force Python to find the .env file in the exact same folder as this code
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path=env_path)

# 2. Check if the key is actually there before giving it to OpenAI
api_key = os.getenv("DEEPSEEK_API_KEY")

if not api_key:
    raise ValueError(
        f"\n\n🚨 [MINDLOOP ERROR] DEEPSEEK_API_KEY is missing!\n"
        f"👉 We looked for your '.env' file here: {env_path}\n"
        f"👉 Please make sure a file named '.env' exists in that folder and has this exact line:\n"
        f"   DEEPSEEK_API_KEY=your_actual_key_here\n"
    )

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com",
)

SYSTEM_PROMPT = (
    "You are an adaptive study coach for university students. "
    "Always reply with valid JSON only. No prose outside the JSON object. "
    "Be precise and concise, and adjust your explanation style based on "
    "any weak_points or previous_explanation context provided."
)

# ... leave the rest of your functions (_call_deepseek, etc.) exactly as they are ...

def _call_deepseek(user_prompt: str) -> dict:
    """
    Shared helper: sends one request, parses JSON, retries once on failure.
    Person C: this is the one place API-call mechanics live. Don't duplicate
    this logic in every function below — call this instead.
    """
    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
            )
            raw = response.choices[0].message.content
            return json.loads(raw)
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 1:
                raise RuntimeError(f"LLM call failed after retry: {e}")
            continue


def generate_explanation(content: str, weak_points: list[str]) -> dict:
    """
    TODO (Person C): build the prompt, call _call_deepseek, return a dict
    matching ExplainResponse: {"explanation": str, "level": str}
    """
    prompt = (
        f"Explain the following content clearly.\n"
        f"Content: {content}\n"
        f"Known weak points to pay extra attention to: {weak_points}\n"
        f'Reply as JSON: {{"explanation": "...", "level": "beginner|intermediate|technical"}}'
    )
    return _call_deepseek(prompt)


def generate_quiz(content: str, difficulty: str, num_questions: int) -> dict:
    """
    TODO (Person C): return a dict matching QuizResponse:
    {"questions": [{"question", "options", "answer", "concept_tag"}, ...]}
    concept_tag is critical — it's what lets /evaluate map a wrong answer
    back to a specific concept for re-teaching.
    """
    prompt = (
        f"Generate {num_questions} multiple-choice questions at {difficulty} level "
        f"based on this content: {content}\n"
        f'Reply as JSON: {{"questions": [{{"question": "...", "options": ["A","B","C","D"], '
        f'"answer": "...", "concept_tag": "short label"}}]}}'
    )
    return _call_deepseek(prompt)


def generate_reexplanation(concept_tag: str, original_content: str, previous_explanation: str) -> dict:
    """
    TODO (Person C): must genuinely explain DIFFERENTLY, not reword the same
    explanation. Consider prompting for a different teaching approach
    (analogy, worked example, step-by-step breakdown) than whatever the
    first explanation used.
    Return dict matching ReexplainResponse: {"explanation": str}
    """
    prompt = (
        f"The student did not understand this concept: {concept_tag}\n"
        f"Original content: {original_content}\n"
        f"Previous explanation that did not work: {previous_explanation}\n"
        f"Explain it again using a genuinely different approach (different analogy, "
        f"example, or structure than the previous explanation).\n"
        f'Reply as JSON: {{"explanation": "..."}}'
    )
    return _call_deepseek(prompt)
