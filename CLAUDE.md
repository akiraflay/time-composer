# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Environment Setup
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install CLI tool in development mode
pip install -e .
```

### Running the Application
```bash
# Quick start (runs both backend and frontend)
python run.py

# Manual start - Backend only
python backend/app.py

# Manual start - Frontend only (separate terminal)
python -m http.server 8080 --directory frontend
```

### Testing
```bash
# Run tests
pytest tests/

# Run specific test file
pytest tests/test_agents.py

# Validate project structure
python validate.py
```

### CLI Usage
```bash
# Record new entry
time-composer record "Met with client about contract negotiations"

# View dashboard
time-composer dashboard

# Export entries
time-composer export --output billing.csv
```

## Architecture Overview

Time Composer is a speech-first AI agent for legal billing narratives with three main components:

### 1. Backend (Flask API)
- **Flask server** (`backend/app.py`) with SQLAlchemy models
- **Core endpoints**: `/api/transcribe`, `/api/enhance`, `/api/entries`, `/api/export`
- **Database**: SQLite with TimeEntry model storing original text, cleaned text, narratives, and metadata
- **OpenAI integration**: Whisper for transcription, GPT for text processing

### 2. Three-Agent Processing Pipeline (`shared/agents/`)
The AI processing uses a sequential three-agent architecture:

1. **GrammarAgent**: Fixes spelling, grammar, expands abbreviations
2. **SeparatorAgent**: Identifies distinct billable activities and time allocations  
3. **RefinerAgent**: Transforms activities into professional billing narratives

Pipeline orchestrated by `AgentPipeline` class in `shared/agents/pipeline.py`.

### 3. Multi-Interface Frontend
- **Web Interface**: Vanilla JavaScript with Web Speech API, IndexedDB offline storage
- **CLI Tool**: Click-based CLI with Rich terminal UI (`cli/`)
- **Shared State**: All interfaces use the same Flask backend and SQLite database

## Key Configuration

### Environment Variables (.env)
- `OPENAI_API_KEY`: Required for AI processing
- `SECRET_KEY`: Flask secret key
- `DATABASE_URL`: SQLite database path (defaults to `data/time_composer.db`)

### Important File Paths
- Database: `data/time_composer.db` (auto-created)
- Config: `backend/config.py` 
- Models: `backend/models.py` (TimeEntry with JSON fields for narratives/metadata)

## Development Notes

- **Database**: Uses SQLAlchemy with JSON fields for complex data (narratives, task_codes, tags)
- **CORS**: Configured for local development (frontend on :8080, backend on :5000)
- **Offline-first**: Frontend uses IndexedDB for local storage with sync capabilities
- **CLI Entry Point**: `time-composer` command defined in setup.py
- **Agent Base Class**: All agents inherit from `shared/agents/base.py`
- **Error Handling**: Comprehensive error handling with proper HTTP status codes and logging