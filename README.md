# Edumind

An adaptive study coach built for the Prometheus July AI Challenge (17-18 July 2026).

Paste any topic or note. MindLoop explains it, quizzes you on it, detects exactly which
concept you got wrong, and re-explains that concept differently — then re-tests it. The
loop, not a single explanation or quiz, is the product.

## Why this exists

University students revising alone — without access to a tutor — waste time re-reading
material broadly instead of targeting what they actually don't understand. Edumind's
AI tracks the specific concept behind each wrong answer and adapts its teaching to that
gap, rather than repeating a generic explanation.

## Tech stack

- **Backend:** FastAPI (Python)
- **AI:** DeepSeek (`deepseek-chat`), OpenAI-compatible API
- **Frontend:** HTML/CSS/JavaScript
- **Storage:** in-memory / session state (no database — out of scope for a 2-day build)

## Project structure

```
mindloop/
├── backend/
│   ├── main.py          # FastAPI app entrypoint
│   ├── routes.py         # HTTP routes (explain, quiz, evaluate, reexplain)
│   ├── llm_service.py     # DeepSeek API calls and prompt logic
│   ├── schemas.py         # Pydantic request/response models
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── mock-data.js       # sample data matching the API contract, used during dev
└── README.md
```

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # then paste your DeepSeek key into .env
uvicorn main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs` once running.

### Frontend

Open `frontend/index.html` directly in a browser, or serve it with:

```bash
cd frontend
python -m http.server 5500
```

By default the frontend runs against mock data (`USE_MOCK = true` in `script.js`).
Set it to `false` once the backend is running locally to use real API calls.

## API endpoints

| Endpoint      | Method | Purpose                                              |
|---------------|--------|-------------------------------------------------------|
| `/explain`    | POST   | Explain a topic, adapted to known weak points         |
| `/quiz`       | POST   | Generate a structured quiz on the explained content    |
| `/evaluate`   | POST   | Score answers, identify which concepts were missed     |
| `/reexplain`  | POST   | Re-explain a specific missed concept, differently       |
| `/health`     | GET    | Basic server health check                              |

## Team

- Backend + system integration: Nchafac Evden
- Frontend: Bleriot yonita, Sandrine Nange
- LLM / prompt engineering: Ntui Raoul

## What's out of scope for this build

Persistence across sessions, accounts, multi-subject dashboards, payment tiers, and
school licensing are deliberately not built for this hackathon — the two-day scope is
one working adaptive loop, demonstrated end to end.
