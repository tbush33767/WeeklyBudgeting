#!/usr/bin/env python3
"""
Start both frontend and backend servers for the Weekly Budgeting app.
"""

import subprocess
import os
import signal
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR = os.path.join(PROJECT_ROOT, "client")
SERVER_DIR = os.path.join(PROJECT_ROOT, "server")

processes = []

def cleanup(signum=None, frame=None):
    """Terminate all child processes on exit."""
    print("\n🛑 Shutting down servers...")
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    print("✅ All servers stopped.")
    sys.exit(0)

def install_dependencies(directory, name):
    """Install npm dependencies if node_modules doesn't exist."""
    node_modules = os.path.join(directory, "node_modules")
    if not os.path.exists(node_modules):
        print(f"📥 Installing {name} dependencies...")
        result = subprocess.run(
            ["npm", "install"],
            cwd=directory,
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"❌ Failed to install {name} dependencies:")
            print(result.stderr)
            sys.exit(1)
        print(f"✅ {name} dependencies installed.")
    else:
        print(f"✅ {name} dependencies already installed.")

def main():
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Install dependencies if needed
    print("🔍 Checking dependencies...\n")
    install_dependencies(SERVER_DIR, "Backend")
    install_dependencies(CLIENT_DIR, "Frontend")
    print()

    print("🚀 Starting Weekly Budgeting servers...\n")

    # Start backend server
    print("📦 Starting backend server (Express)...")
    backend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=SERVER_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    processes.append(backend_proc)
    print(f"   Backend running (PID: {backend_proc.pid})")

    # Start frontend server
    print("⚛️  Starting frontend server (Vite)...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=CLIENT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    processes.append(frontend_proc)
    print(f"   Frontend running (PID: {frontend_proc.pid})")

    print("\n" + "=" * 50)
    print("✅ Both servers are running!")
    print("   Frontend: http://localhost:5173")
    print("   Backend:  http://localhost:3000")
    print("=" * 50)
    print("\nPress Ctrl+C to stop both servers.\n")

    # Stream output from both processes
    while True:
        for proc in processes:
            if proc.stdout:
                line = proc.stdout.readline()
                if line:
                    prefix = "🖥️  [backend]" if proc == backend_proc else "🌐 [frontend]"
                    print(f"{prefix} {line}", end="")
        
        # Check if any process has died
        for proc in processes:
            if proc.poll() is not None:
                print(f"\n⚠️  A server process exited with code {proc.returncode}")
                cleanup()

if __name__ == "__main__":
    main()

