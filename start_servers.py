#!/usr/bin/env python3
"""
Start both frontend and backend servers for the Weekly Budgeting app.
"""

import subprocess
import os
import signal
import sys
import socket

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
CLIENT_DIR = os.path.join(PROJECT_ROOT, "client")
SERVER_DIR = os.path.join(PROJECT_ROOT, "server")

# Default ports
DEFAULT_BACKEND_PORT = 3001
DEFAULT_FRONTEND_PORT = 5173

processes = []

def is_port_available(port):
    """Check if a port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False

def find_available_port(start_port, max_attempts=100):
    """Find an available port starting from start_port."""
    for offset in range(max_attempts):
        port = start_port + offset
        if is_port_available(port):
            return port
    raise RuntimeError(f"Could not find an available port starting from {start_port}")

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

    # Find available ports
    print("🔌 Checking port availability...")
    backend_port = DEFAULT_BACKEND_PORT
    if not is_port_available(backend_port):
        print(f"   ⚠️  Port {backend_port} is in use, finding alternative...")
        backend_port = find_available_port(backend_port)
        print(f"   ✅ Using backend port: {backend_port}")
    else:
        print(f"   ✅ Backend port {backend_port} is available")
    
    frontend_port = DEFAULT_FRONTEND_PORT
    if not is_port_available(frontend_port):
        print(f"   ⚠️  Port {frontend_port} is in use, finding alternative...")
        frontend_port = find_available_port(frontend_port)
        print(f"   ✅ Using frontend port: {frontend_port}")
    else:
        print(f"   ✅ Frontend port {frontend_port} is available")
    print()

    print("🚀 Starting Weekly Budgeting servers...\n")

    # Start backend server with port environment variable
    print(f"📦 Starting backend server (Express) on port {backend_port}...")
    backend_env = os.environ.copy()
    backend_env['PORT'] = str(backend_port)
    backend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=SERVER_DIR,
        env=backend_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    processes.append(backend_proc)
    print(f"   Backend running (PID: {backend_proc.pid})")

    # Start frontend server with port and backend port environment variables
    print(f"⚛️  Starting frontend server (Vite) on port {frontend_port}...")
    frontend_env = os.environ.copy()
    frontend_env['VITE_API_PORT'] = str(backend_port)  # Pass backend port to Vite
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev", "--", "--port", str(frontend_port)],
        cwd=CLIENT_DIR,
        env=frontend_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    processes.append(frontend_proc)
    print(f"   Frontend running (PID: {frontend_proc.pid})")

    print("\n" + "=" * 50)
    print("✅ Both servers are running!")
    print(f"   Frontend: http://localhost:{frontend_port}")
    print(f"   Backend:  http://localhost:{backend_port}")
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

