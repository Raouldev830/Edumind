"""
MindLoop database layer.

Manages SQLite storage for user profiles (XP, level, streak),
quiz history, and weak-point tracking.
"""

import sqlite3
import os
from datetime import datetime, date

# Resolve DB path relative to this script, not the CWD
DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(DB_DIR, "edumind.db")


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------

def init_db():
    """Initializes the SQLite database tables if they don't exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Users Table (Stores gamification stats)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak INTEGER DEFAULT 0,
            last_active_date TEXT
        )
    ''')

    # 2. Quiz History Table (Stores past performance)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quiz_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            topic TEXT NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            xp_earned INTEGER NOT NULL,
            timestamp TEXT NOT NULL
        )
    ''')

    # 3. Weak Points Table (Tracks concepts the student struggles with)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weak_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            concept_tag TEXT NOT NULL,
            topic TEXT NOT NULL,
            times_missed INTEGER DEFAULT 1,
            resolved INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    # Create a default sandbox user for testing if the table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (username, xp, level, streak, last_active_date) VALUES (?, ?, ?, ?, ?)",
            ("StudentPro", 0, 1, 1, str(date.today())),
        )

    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# User Profile
# ---------------------------------------------------------------------------

def get_user_stats(username: str):
    """Fetches a student's profile, XP, Level, and Streak details."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT username, xp, level, streak, last_active_date FROM users WHERE username = ?",
        (username,),
    )
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "username": row[0],
            "xp": row[1],
            "level": row[2],
            "streak": row[3],
            "last_active": row[4],
            "xp_next_level": row[2] * 200,  # Level 1 needs 200XP, Level 2 needs 400XP, etc.
        }
    return None


# ---------------------------------------------------------------------------
# Progress / Gamification
# ---------------------------------------------------------------------------

def update_student_progress(
    username: str,
    activity_type: str,
    quiz_score: int = 0,
    quiz_total: int = 0,
    topic: str = "",
):
    """Updates user tracking, calculates dynamic XP, handles streaks, and checks for level-ups."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # 1. Calculate XP payouts
    xp_gained = 0
    if activity_type == "read_explanation":
        xp_gained = 25  # Reading a breakdown gives a flat base payout
    elif activity_type == "complete_quiz":
        base_quiz_xp = 30
        points_per_correct_answer = 15
        xp_gained = base_quiz_xp + (quiz_score * points_per_correct_answer)

        # Perfect score jackpot bonus!
        if quiz_score == quiz_total and quiz_total > 0:
            xp_gained += 50

    # 2. Update/Verify user daily streak
    today = str(date.today())
    cursor.execute(
        "SELECT streak, last_active_date, xp, level FROM users WHERE username = ?",
        (username,),
    )
    user = cursor.fetchone()

    if not user:
        # Auto-create the user if they don't exist yet
        cursor.execute(
            "INSERT INTO users (username, xp, level, streak, last_active_date) VALUES (?, ?, ?, ?, ?)",
            (username, 0, 1, 1, today),
        )
        conn.commit()
        current_streak, last_active, current_xp, current_level = 1, today, 0, 1
    else:
        current_streak, last_active, current_xp, current_level = user

    if last_active != today:
        try:
            last_date = datetime.strptime(last_active, "%Y-%m-%d").date()
            days_passed = (date.today() - last_date).days
            if days_passed == 1:
                current_streak += 1  # Kept the fire alive!
            elif days_passed > 1:
                current_streak = 1  # Streak broke, resetting to day 1
        except (ValueError, TypeError):
            current_streak = 1

    # 3. Apply new XP total and compute Level upgrades
    new_xp = current_xp + xp_gained
    new_level = current_level

    # Level formula: Each level requires (current_level * 200) cumulative XP
    while new_xp >= (new_level * 200):
        new_xp -= new_level * 200
        new_level += 1

    # 4. Save calculations back to database
    cursor.execute(
        """
        UPDATE users
        SET xp = ?, level = ?, streak = ?, last_active_date = ?
        WHERE username = ?
        """,
        (new_xp, new_level, current_streak, today, username),
    )

    # 5. If it was a quiz, append it to the long-term dashboard log
    if activity_type == "complete_quiz":
        cursor.execute(
            """
            INSERT INTO quiz_history (username, topic, score, total, xp_earned, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                username,
                topic,
                quiz_score,
                quiz_total,
                xp_gained,
                datetime.now().strftime("%Y-%m-%d %H:%M"),
            ),
        )

    conn.commit()
    conn.close()

    return {
        "xp_earned": xp_gained,
        "new_total_xp": new_xp,
        "current_level": new_level,
        "current_streak": current_streak,
        "level_up_occurred": new_level > current_level,
    }


# ---------------------------------------------------------------------------
# Weak Points
# ---------------------------------------------------------------------------

def add_weak_points(username: str, weak_points_list: list, topic: str):
    """
    Record or increment weak-point entries for a student.

    For each concept_tag: if an unresolved row already exists, increment
    times_missed.  Otherwise insert a fresh row.
    """
    if not weak_points_list:
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    now = datetime.now().isoformat()

    for concept_tag in weak_points_list:
        concept_tag = concept_tag.strip()
        if not concept_tag:
            continue

        cursor.execute(
            "SELECT id, times_missed FROM weak_points WHERE username = ? AND concept_tag = ? AND resolved = 0",
            (username, concept_tag),
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                "UPDATE weak_points SET times_missed = ?, updated_at = ?, topic = ? WHERE id = ?",
                (existing[1] + 1, now, topic, existing[0]),
            )
        else:
            cursor.execute(
                """
                INSERT INTO weak_points (username, concept_tag, topic, times_missed, resolved, created_at, updated_at)
                VALUES (?, ?, ?, 1, 0, ?, ?)
                """,
                (username, concept_tag, topic, now, now),
            )

    conn.commit()
    conn.close()


def get_active_weak_points(username: str) -> list:
    """Return all unresolved weak points for a student."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT concept_tag, topic, times_missed, created_at FROM weak_points WHERE username = ? AND resolved = 0",
        (username,),
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "concept_tag": r[0],
            "topic": r[1],
            "times_missed": r[2],
            "created_at": r[3],
        }
        for r in rows
    ]


def resolve_weak_point(username: str, concept_tag: str):
    """Mark a weak-point concept as resolved for a student."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE weak_points SET resolved = 1, updated_at = ? WHERE username = ? AND concept_tag = ? AND resolved = 0",
        (datetime.now().isoformat(), username, concept_tag),
    )
    conn.commit()
    conn.close()


def get_quiz_history(username: str, limit: int = 10) -> list:
    """Return recent quiz history for a student."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT topic, score, total, xp_earned, timestamp FROM quiz_history WHERE username = ? ORDER BY timestamp DESC LIMIT ?",
        (username, limit),
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "topic": r[0],
            "score": r[1],
            "total": r[2],
            "xp_earned": r[3],
            "timestamp": r[4],
        }
        for r in rows
    ]