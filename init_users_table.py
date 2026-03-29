"""
Initialize the database with users table
"""
import sqlite3
from pathlib import Path
import time

# Database path
DB_PATH = Path("d:/AI Document Intelligence System/data/intelligence.db")

print(f"📊 Database location: {DB_PATH}\n")

# Connect to database
conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row

try:
    # Create users table
    print("🔧 Creating users table...")
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT UNIQUE NOT NULL,
            password_hash   TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'analyst',
            email           TEXT UNIQUE NOT NULL,
            created_at      REAL NOT NULL
        )
    """)

    conn.commit()
    print("✅ Users table created successfully!\n")
    
    # Verify table was created
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchall()
    
    if tables:
        print("✅ Verification successful - 'users' table exists!")
        
        # Check for existing users
        users = conn.execute("SELECT * FROM users").fetchall()
        if users:
            print(f"📊 Found {len(users)} existing user(s)\n")
        else:
            print("ℹ️  No users registered yet\n")
            
        print("=" * 80)
        print("🎉 Database is ready for authentication!")
        print("=" * 80)
        print("\nNext steps:")
        print("1. Start your backend: python main.py")
        print("2. Start your frontend: cd frontend-enterprise && npm run dev")
        print("3. Go to: http://localhost:3000/register")
        print("4. Create your first user account!\n")
    else:
        print("❌ Table creation failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    conn.close()
