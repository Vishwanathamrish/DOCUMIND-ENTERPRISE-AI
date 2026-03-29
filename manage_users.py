"""
Complete User Management Tool
- View all users
- Edit user roles
- Delete users
- Reset passwords
"""
import sqlite3
from pathlib import Path
import sys
import time
from app.auth import hash_password, verify_password

# Database path - ACTUAL application database
DB_PATH = Path("d:/AI Document Intelligence System/data/data/intelligence.db")

def print_header(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def show_users(conn):
    """Display all users in a formatted table"""
    users = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    
    if not users:
        print("\n⚠️  No users found in database.")
        return []
    
    print(f"\n📊 Total Users: {len(users)}\n")
    print(f"{'ID':<4} {'Username':<20} {'Role':<15} {'Created (timestamp)'}")
    print("-" * 80)
    for user in users:
        print(f"{user['id']:<4} {user['username']:<20} {user['role']:<15} {user['created_at']:.0f}")
    
    return users

def main():
    print_header("🔐 User Management System")
    
    if not DB_PATH.exists():
        print(f"\n❌ Database not found at {DB_PATH}")
        sys.exit(1)
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    try:
        while True:
            print("\n" + "=" * 80)
            print("  Management Options:")
            print("=" * 80)
            print("1. 👥 View All Users")
            print("2. ✏️  Edit User Role")
            print("3. 🔑 Reset User Password")
            print("4. ❌ Delete User")
            print("5. 📊 User Statistics")
            print("6. 🚪 Exit")
            
            choice = input("\nEnter choice (1-6): ").strip()
            
            # ===== VIEW ALL USERS =====
            if choice == "1":
                print_header("All Users")
                users = show_users(conn)
                
                if users:
                    print("\n💡 Tip: Use option 2 to change roles or option 3 to reset passwords")
            
            # ===== EDIT USER ROLE =====
            elif choice == "2":
                print_header("Edit User Role")
                users = show_users(conn)
                
                if not users:
                    continue
                
                username = input("\nEnter username to edit: ").strip()
                user = conn.execute(
                    "SELECT * FROM users WHERE username = ?", (username,)
                ).fetchone()
                
                if not user:
                    print(f"❌ User '{username}' not found!")
                    continue
                
                print(f"\nCurrent user info:")
                print(f"  Username: {user['username']}")
                print(f"  Current role: {user['role']}")
                
                print("\nAvailable roles:")
                print("  1. admin (full access)")
                print("  2. analyst (standard user)")
                print("  3. viewer (read-only)")
                
                role_choice = input("\nSelect new role (1/2/3): ").strip()
                role_map = {"1": "admin", "2": "analyst", "3": "viewer"}
                
                if role_choice not in role_map:
                    print("❌ Invalid role selection!")
                    continue
                
                new_role = role_map[role_choice]
                
                confirm = input(f"\nConfirm changing {user['username']}'s role to '{new_role}'? (y/n): ").strip().lower()
                if confirm != 'y':
                    print("❌ Change cancelled.")
                    continue
                
                conn.execute(
                    "UPDATE users SET role = ? WHERE username = ?",
                    (new_role, username)
                )
                conn.commit()
                print(f"\n✅ SUCCESS! {user['username']}'s role updated to '{new_role}'")
            
            # ===== RESET PASSWORD =====
            elif choice == "3":
                print_header("Reset User Password")
                users = show_users(conn)
                
                if not users:
                    continue
                
                username = input("\nEnter username: ").strip()
                user = conn.execute(
                    "SELECT * FROM users WHERE username = ?", (username,)
                ).fetchone()
                
                if not user:
                    print(f"❌ User '{username}' not found!")
                    continue
                
                print(f"\nUser: {user['username']} (Current role: {user['role']})")
                
                new_password = input("Enter NEW password (min 6 chars): ").strip()
                if len(new_password) < 6:
                    print("❌ Password must be at least 6 characters!")
                    continue
                
                confirm = input(f"\nConfirm resetting password for {user['username']}? (y/n): ").strip().lower()
                if confirm != 'y':
                    print("❌ Reset cancelled.")
                    continue
                
                hashed = hash_password(new_password)
                conn.execute(
                    "UPDATE users SET password_hash = ? WHERE username = ?",
                    (hashed, username)
                )
                conn.commit()
                print(f"\n✅ SUCCESS! Password reset for {user['username']}")
                print(f"   New password: {new_password}")
                print(f"⚠️  Share this securely with the user!")
            
            # ===== DELETE USER =====
            elif choice == "4":
                print_header("Delete User")
                users = show_users(conn)
                
                if not users:
                    continue
                
                username = input("\nEnter username to DELETE: ").strip()
                user = conn.execute(
                    "SELECT * FROM users WHERE username = ?", (username,)
                ).fetchone()
                
                if not user:
                    print(f"❌ User '{username}' not found!")
                    continue
                
                print(f"\n⚠️  WARNING: This will PERMANENTLY delete user:")
                print(f"   Username: {user['username']}")
                print(f"   Role: {user['role']}")
                print(f"   ID: {user['id']}")
                
                confirm = input("\nType 'DELETE' to confirm (or anything else to cancel): ").strip()
                if confirm != 'DELETE':
                    print("❌ Deletion cancelled.")
                    continue
                
                conn.execute("DELETE FROM users WHERE username = ?", (username,))
                conn.commit()
                print(f"\n✅ User '{username}' has been DELETED permanently!")
            
            # ===== USER STATISTICS =====
            elif choice == "5":
                print_header("User Statistics")
                
                total = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
                admins = conn.execute("SELECT COUNT(*) as c FROM users WHERE role='admin'").fetchone()["c"]
                analysts = conn.execute("SELECT COUNT(*) as c FROM users WHERE role='analyst'").fetchone()["c"]
                viewers = conn.execute("SELECT COUNT(*) as c FROM users WHERE role='viewer'").fetchone()["c"]
                
                print(f"\n📊 Overview:")
                print(f"   Total users: {total}")
                print(f"   🔴 Admins: {admins}")
                print(f"   🟡 Analysts: {analysts}")
                print(f"   🟢 Viewers: {viewers}")
                
                # Get newest user
                newest = conn.execute(
                    "SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 1"
                ).fetchone()
                if newest:
                    print(f"\n🆕 Newest user: {newest['username']}")
                
                # Get oldest user
                oldest = conn.execute(
                    "SELECT username, created_at FROM users ORDER BY created_at ASC LIMIT 1"
                ).fetchone()
                if oldest:
                    print(f"👴 Oldest user: {oldest['username']}")
                
                print("\n📈 Role Distribution:")
                if total > 0:
                    print(f"   Admin: {(admins/total*100):.1f}%")
                    print(f"   Analyst: {(analysts/total*100):.1f}%")
                    print(f"   Viewer: {(viewers/total*100):.1f}%")
            
            # ===== EXIT =====
            elif choice == "6":
                print("\n👋 Goodbye!\n")
                break
            
            else:
                print("\n❌ Invalid choice! Please enter 1-6.")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
