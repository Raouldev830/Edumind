"""
MindLoop backend entrypoint.
Run locally with: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import database
from routes import router

# 1. Initialize app
app = FastAPI(title="MindLoop API", version="0.2.0")

# 2. Setup Database (creates tables + default user if needed)
database.init_db()

# 3. Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Include all routes
app.include_router(router)

print("🚀 MindLoop API v0.2.0 started — adaptive study coach ready.")