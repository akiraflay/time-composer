#!/usr/bin/env python3
"""Validation script for Time Composer project structure"""

import os
import sys
from pathlib import Path

def check_file_exists(filepath, description=""):
    """Check if a file exists"""
    if Path(filepath).exists():
        print(f"✓ {filepath} {description}")
        return True
    else:
        print(f"✗ {filepath} {description}")
        return False

def validate_project_structure():
    """Validate the project structure"""
    print("🔍 Validating Time Composer Project Structure")
    print("=" * 50)
    
    all_good = True
    
    # Core files
    files_to_check = [
        ("README.md", "- Project documentation"),
        ("requirements.txt", "- Python dependencies"),
        (".env", "- Environment configuration"),
        (".gitignore", "- Git ignore rules"),
        ("setup.py", "- Package setup"),
        ("run.py", "- Quick start script"),
        
        # Backend files
        ("backend/app.py", "- Flask API server"),
        ("backend/config.py", "- Configuration"),
        ("backend/models.py", "- Database models"),
        ("backend/gunicorn_config.py", "- Production server config"),
        
        # Frontend files
        ("frontend/index.html", "- Main web interface"),
        ("frontend/css/styles.css", "- Styling"),
        ("frontend/js/app.js", "- Main application logic"),
        ("frontend/js/api.js", "- API client"),
        ("frontend/js/database.js", "- IndexedDB operations"),
        ("frontend/js/recording.js", "- Audio recording"),
        ("frontend/js/sync.js", "- Data synchronization"),
        ("frontend/assets/favicon.svg", "- Website icon"),
        
        # Agent architecture (now in backend)
        ("backend/agents/__init__.py", "- Agents package"),
        ("backend/agents/base.py", "- Base agent class"),
        ("backend/agents/grammar.py", "- Grammar correction agent"),
        ("backend/agents/separator.py", "- Entry separation agent"),
        ("backend/agents/refiner.py", "- Narrative refinement agent"),
        ("backend/agents/pipeline.py", "- Agent orchestration"),
        
        # Tests
        ("tests/__init__.py", "- Test package"),
        ("tests/test_agents.py", "- Agent tests"),
    ]
    
    for filepath, description in files_to_check:
        if not check_file_exists(filepath, description):
            all_good = False
    
    # Check directories
    directories = [
        "backend", "frontend", "tests", "data",
        "frontend/css", "frontend/js", "frontend/assets", "backend/agents"
    ]
    
    print("\n📁 Checking directories:")
    for directory in directories:
        if Path(directory).is_dir():
            print(f"✓ {directory}/")
        else:
            print(f"✗ {directory}/")
            all_good = False
    
    # Check content of key files
    print("\n📝 Checking file contents:")
    
    # Check .env has API key
    if Path(".env").exists():
        with open(".env") as f:
            content = f.read()
            if "AZURE_OPENAI_API_KEY=" in content and len(content.split("AZURE_OPENAI_API_KEY=")[1].split("\n")[0].strip()) > 10:
                print("✓ .env contains Azure OpenAI API key")
            else:
                print("✗ .env missing valid Azure OpenAI API key")
                all_good = False
    
    # Check requirements.txt has key dependencies
    if Path("requirements.txt").exists():
        with open("requirements.txt") as f:
            content = f.read()
            required_deps = ["flask", "openai"]
            missing_deps = [dep for dep in required_deps if dep not in content.lower()]
            if not missing_deps:
                print("✓ requirements.txt contains all key dependencies")
            else:
                print(f"✗ requirements.txt missing: {missing_deps}")
                all_good = False
    
    print("\n" + "=" * 50)
    if all_good:
        print("🎉 All validation checks passed!")
        print("\nNext steps:")
        print("1. Create a virtual environment: python3 -m venv venv")
        print("2. Activate it: source venv/bin/activate")
        print("3. Install dependencies: pip install -r requirements.txt")
        print("4. Run the application: python run.py")
        return 0
    else:
        print("❌ Some validation checks failed!")
        print("Please check the missing files/directories above.")
        return 1

if __name__ == "__main__":
    sys.exit(validate_project_structure())