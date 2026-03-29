"""
Create or promote a user to admin role
"""
import sqlite3
from pathlib import Path
import sys
from app.auth import hash_password

# Database path - ACTUAL application database
DB_PATH = Path("d:/AI Document Intelligence System/data/data/intelligence.db")

print("=" * 80)
print("🔐 Admin User Management Tool")
print("=" * 80)

if not DB_PATH.exists():
    print(f"\n❌ Database not found at {DB_PATH}")
    print("Please run the application first to create the database.")
    sys.exit(1)

conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row

try:
    # Check if users table exists
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).fetchall()
    
    if not tables:
        print("\n❌ 'users' table doesn't exist yet.")
        print("Please register at least one user first via /register page.")
        sys.exit(1)
    
    # Show existing users
    users = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    
    print(f"\n📊 Existing Users ({len(users)} total):\n")
    print(f"{'ID':<4} {'Username':<20} {'Role':<15} {'Created'}")
    print("-" * 80)
    for user in users:
        created_str = f"{user['created_at']:.0f}"
        print(f"{user['id']:<4} {user['username']:<20} {user['role']:<15} {created_str}")
    
    print("\n" + "=" * 80)
    print("Choose an option:")
    print("1. Create NEW admin user")
    print("2. Promote existing user to admin")
    print("3. Exit")
    
    choice = input("\nEnter choice (1/2/3): ").strip()
    
    if choice == "1":
        # Create new admin
        print("\n--- Create New Admin User ---")
        username = input("Enter username (min 3 chars): ").strip()
        password = input("Enter password (min 6 chars): ").strip()
        
        if len(username) < 3:
            print("❌ Username must be at least 3 characters!")
            sys.exit(1)
        
        if len(password) < 6:
            print("❌ Password must be at least 6 characters!")
            sys.exit(1)
        
        # Check if username already exists
        existing = conn.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        
        if existing:
            print(f"❌ Username '{username}' is already taken!")
            sys.exit(1)
        
        # Insert new admin user
        import time
        conn.execute(
            """INSERT INTO users (username, password_hash, role, created_at) 
               VALUES (?, ?, ?, ?)""",
            (username, hash_password(password), "admin", time.time())
        )
        conn.commit()
        
        print(f"\n✅ SUCCESS! Admin user '{username}' created!")
        print(f"   Username: {username}")
        print(f"   Password: {password}")
        print(f"   Role: admin")
        print(f"\n👉 Login at: http://localhost:3000/login")
    
    elif choice == "2":
        # Promote existing user
        print("\n--- Promote User to Admin ---")
        username = input("Enter username to promote: ").strip()
        
        # Check if user exists
        user = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        
        if not user:
            print(f"❌ User '{username}' not found!")
            sys.exit(1)
        
        if user['role'] == 'admin':
            print(f"⚠️  User '{username}' is already an admin!")
            sys.exit(1)
        
        # Confirm promotion
        confirm = input(f"Promote '{username}' from '{user['role']}' to 'admin'? (y/n): ").strip().lower()
        
        if confirm != 'y':
            print("❌ Promotion cancelled.")
            sys.exit(0)
        
        # Update role
        conn.execute(
            "UPDATE users SET role = 'admin' WHERE username = ?",
            (username,)
        )
        conn.commit()
        
        print(f"\n✅ SUCCESS! '{username}' is now an ADMIN!")
        print(f"   Username: {username}")
        print(f"   Previous role: {user['role']}")
        print(f"   New role: admin")
        print(f"   Password: (unchanged)")
        print(f"\n👉 Login with existing password at: http://localhost:3000/login")
    
    elif choice == "3":
        print("\n👋 Exiting...")
        sys.exit(0)
    
    else:
        print("\n❌ Invalid choice! Please run again and choose 1, 2, or 3.")
        sys.exit(1)

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    conn.close()
