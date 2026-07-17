import sqlite3
from datetime import datetime, date

DB_FILE = "edumind.db"

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
    
    # Create a default sandbox user for testing if the table is empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (username, xp, level, streak, last_active_date) VALUES (?, ?, ?, ?, ?)",
            ("StudentPro", 0, 1, 1, str(date.today()))
        )
        
    conn.commit()
    conn.close()

def get_user_stats(username: str):
    """Fetches a student's profile, XP, Level, and Streak details."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT username, xp, level, streak, last_active_date FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "username": row[0],
            "xp": row[1],
            "level": row[2],
            "streak": row[3],
            "last_active": row[4],
            "xp_next_level": row[2] * 200 # Level 1 needs 200XP, Level 2 needs 400XP, etc.
        }
    return None

def update_student_progress(username: str, activity_type: str, quiz_score: int = 0, quiz_total: int = 0, topic: str = ""):
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
    cursor.execute("SELECT streak, last_active_date, xp, level FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return {"error": "User not found"}
        
    current_streak, last_active, current_xp, current_level = user
    
    if last_active != today:
        try:
            last_date = datetime.strptime(last_active, "%Y-%m-%d").date()
            days_passed = (date.today() - last_date).days
            if days_passed == 1:
                current_streak += 1 # Kept the fire alive!
            elif days_passed > 1:
                current_streak = 1  # Streak broke, resetting to day 1
        except (ValueError, TypeError):
            current_streak = 1

    # 3. Apply new XP total and compute Level upgrades
    new_xp = current_xp + xp_gained
    new_level = current_level
    
    # Level formula: Each level requires (current_level * 200) cumulative XP
    while new_xp >= (new_level * 200):
        new_xp -= (new_level * 200)
        new_level += 1

    # 4. Save calculations back to database
    cursor.execute('''
        UPDATE users 
        SET xp = ?, level = ?, streak = ?, last_active_date = ? 
        WHERE username = ?
    ''', (new_xp, new_level, current_streak, today, username))
    
    # 5. If it was a quiz, append it to the long-term dashboard log
    if activity_type == "complete_quiz":
        cursor.execute('''
            INSERT INTO quiz_history (username, topic, score, total, xp_earned, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (username, topic, quiz_score, quiz_total, xp_gained, datetime.now().strftime("%Y-%m-%d %H:%M")))
        
    conn.commit()
    conn.close()
    
    return {
        "xp_earned": xp_gained,
        "new_total_xp": new_xp,
        "current_level": new_level,
        "current_streak": current_streak,
        "level_up_occurred": new_level > current_level
    }