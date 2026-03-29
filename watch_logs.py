"""
Real-time log watcher for password reset requests
"""

import time
from pathlib import Path

log_path = Path("logs/app.log")

print("🔍 Watching for password reset requests...")
print(f"Log file: {log_path.absolute()}")
print("\nWaiting for requests... (Press Ctrl+C to stop)")

# Get initial position
with open(log_path, 'r', encoding='utf-8') as f:
    f.seek(0, 2)  # Go to end
    last_position = f.tell()

try:
    while True:
        with open(log_path, 'r', encoding='utf-8') as f:
            f.seek(last_position)
            new_lines = f.readlines()
            last_position = f.tell()
            
        for line in new_lines:
            if any(keyword in line.lower() for keyword in ['forgot', 'password', 'reset', 'email']):
                print(f"\n{line.strip()}")
                
        time.sleep(1)
        
except KeyboardInterrupt:
    print("\n\nStopped watching logs.")
