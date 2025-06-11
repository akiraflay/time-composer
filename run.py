#!/usr/bin/env python3
"""Quick start script for Time Composer"""

import os
import sys
import subprocess
import webbrowser
import time
from pathlib import Path

def check_requirements():
    """Check if all requirements are installed"""
    try:
        import flask
        import openai
        import click
        import rich
        print("✓ All Python dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists and has required variables"""
    env_file = Path(".env")
    if not env_file.exists():
        print("✗ .env file not found")
        print("Please create .env file with your OpenAI API key")
        return False
    
    with open(env_file) as f:
        content = f.read()
        if "OPENAI_API_KEY=" in content and "your-openai-api-key-here" not in content:
            print("✓ Environment file configured")
            return True
        else:
            print("✗ Please set your OpenAI API key in .env file")
            return False

def start_backend():
    """Start the Flask backend"""
    print("Starting Flask backend...")
    os.chdir("backend")
    
    # Initialize database
    subprocess.run([sys.executable, "-c", 
                   "from app import app, db; app.app_context().push(); db.create_all()"])
    
    # Start Flask app
    process = subprocess.Popen([sys.executable, "app.py"])
    os.chdir("..")
    return process

def start_frontend():
    """Start the frontend server"""
    print("Starting frontend server...")
    process = subprocess.Popen([
        sys.executable, "-m", "http.server", "8080", 
        "--directory", "frontend"
    ])
    return process

def main():
    """Main entry point"""
    print("🎯 Time Composer - Quick Start")
    print("=" * 40)
    
    # Check requirements
    if not check_requirements():
        return 1
    
    if not check_env_file():
        return 1
    
    # Create data directory
    Path("data").mkdir(exist_ok=True)
    print("✓ Data directory ready")
    
    try:
        # Start backend
        backend_process = start_backend()
        time.sleep(3)  # Give backend time to start
        
        # Start frontend
        frontend_process = start_frontend()
        time.sleep(2)  # Give frontend time to start
        
        print("\n🚀 Time Composer is running!")
        print("Backend API: http://localhost:5001")
        print("Frontend: http://localhost:8080")
        print("CLI: time-composer --help")
        print("\nPress Ctrl+C to stop all services")
        
        # Open browser
        webbrowser.open("http://localhost:8080")
        
        # Wait for interrupt
        try:
            backend_process.wait()
        except KeyboardInterrupt:
            print("\nShutting down...")
            backend_process.terminate()
            frontend_process.terminate()
            print("✓ All services stopped")
    
    except Exception as e:
        print(f"✗ Error starting services: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())