import subprocess
import os
import sys

os.chdir(r'c:\src\portfolio-engineering\portfolio-engineering')

cmd = [
    'node',
    '--test',
    '--experimental-strip-types',
    r'apps\frontend\src\sessionState.test.ts'
]

print("=== RUNNING TEST ===")
print(f"Command: {' '.join(cmd)}")
print(f"Working Directory: {os.getcwd()}")
print()

try:
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=60
    )
    
    print("=== EXIT CODE ===")
    print(result.returncode)
    print()
    
    print("=== STDOUT OUTPUT ===")
    print(result.stdout)
    print()
    
    print("=== STDERR OUTPUT ===")
    print(result.stderr)
    print()
    
except subprocess.TimeoutExpired:
    print("ERROR: Command timed out after 60 seconds")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
