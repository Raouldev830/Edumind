"""
MindLoop backend entrypoint.

Run locally with:
    uvicorn main:app --reload --port 8000

Then check http://localhost:8000/docs for the interactive API explorer —
useful for testing endpoints before the frontend is connected.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database  # Gamification tracker database module
from routes import router

app = FastAPI(title="MindLoop API", version="0.1.0")

# Fire up the SQLite tables and create the default user on startup
database.init_db()

# Allow the frontend (running on a different port during dev) to call this API.
# Tighten this before submission if you deploy publicly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)