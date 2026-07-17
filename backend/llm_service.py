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

# Helper function to send prompts to DeepSeek with a single built-in retry mechanism
def _call_deepseek(system_prompt: str, user_prompt: str) -> dict:
    try:
        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"}  # Forces DeepSeek to return clean JSON
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
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as final_error:
            print(f"Final failure: {final_error}")
            return {"error": "Failed to communicate with AI helper. Try again shortly."}

# --- Core Features Engine ---

def get_explanation(topic: str) -> dict:
    system = "You are an expert university professor. Explain complex concepts cleanly. Return a JSON object with keys: 'title', 'explanation' (markdown format), and 'key_takeaways' (list of strings)."
    user = f"Explain this topic in depth: {topic}"
    return _call_deepseek(system, user)

def get_quiz(context_text: str) -> dict:
    system = (
        "You are an automated evaluation tool. Generate exactly 4 multiple-choice quiz questions based on the provided text. "
        "Return a JSON object containing a 'quiz' array. Each item in the array must look exactly like this: "
        "{ 'id': 1, 'question': '...', 'options': ['A', 'B', 'C', 'D'], 'correct_answer': '...' }"
    )
    user = f"Generate a quiz based on this study material:\n\n{context_text}"
    return _call_deepseek(system, user)

def evaluate_answers(quiz_data: list, user_answers: dict) -> dict:
    system = (
        "You are an academic grader. Compare the user's answers against the original quiz questions. "
        "Analyze what concepts they missed. Return a JSON object with keys: 'score' (string, e.g., '3/4'), "
        "'passed' (boolean), 'weak_points' (list of specific topics they misunderstood), and 'feedback' (string)."
    )
    user = f"Original Quiz Data: {json.dumps(quiz_data)}\n\nUser Answers Submitted: {json.dumps(user_answers)}"
    return _call_deepseek(system, user)

def get_reexplanation(topic: str, original_explanation: str, weak_points: list) -> dict:
    system = (
        "You are an adaptive tutor. The student struggled with specific concepts during their quiz. "
        "Re-explain the topic, focusing directly on fixing their weak points. Avoid repeating yourself; use a different analogy. "
        "Return a JSON object with keys: 'title', 're_explanation' (markdown format focused on weak points), and 'reassurance' (encouraging sign-off)."
    )
    user = f"Topic: {topic}\nOriginal Explanation: {original_explanation}\nConcepts they got wrong: {json.dumps(weak_points)}"
    return _call_deepseek(system, user)