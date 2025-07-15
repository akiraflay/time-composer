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


## Architecture Overview

Time Composer is a speech-first AI agent for legal billing narratives with three main components:

### 1. Backend (Flask API)
- **Flask app factory pattern** (`backend/app.py`) - minimal app initialization
- **Core endpoints**: 
  - `/health` - Health check
  - `/api/enhance` - AI text enhancement
  - `/api/entries` - List all entries (GET), individual entry CRUD (GET/PUT/DELETE with ID)
  - `/api/export` - CSV export
- **Database**: SQLite with TimeEntry model storing:
  - Original and cleaned text
  - Client code and matter number
  - Narratives (JSON field with activities, hours, client/matter per narrative)
  - Total hours and status (draft, ready, billed)
- **Azure OpenAI integration**: GPT for text processing via two-agent pipeline

### 2. Two-Agent Processing Pipeline (`backend/agents/`)
The AI processing uses a streamlined two-agent architecture:

1. **SeparatorAgent**: Cleans up text (spelling, grammar, abbreviations) AND identifies distinct billable activities with time allocations
2. **RefinerAgent**: Transforms activities into professional billing narratives without adding invented details

Pipeline orchestrated by `AgentPipeline` class in `backend/agents/pipeline.py`.

### 3. Frontend
- **Web Interface**: Vanilla JavaScript with Web Speech API, IndexedDB offline storage
- **Shared State**: Frontend uses the same Flask backend and SQLite database

## Key Configuration

### Environment Variables (.env)
- `AZURE_OPENAI_API_KEY`: Required for AI processing
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_VERSION`: API version (e.g., "2024-02-01")
- `AZURE_OPENAI_GPT_DEPLOYMENT`: Deployment name for GPT model
- `SECRET_KEY`: Flask secret key
- `DATABASE_URL`: SQLite database path (defaults to `data/time_composer.db`)

### Important File Paths
- Database: `data/time_composer.db` (auto-created)
- Config: `backend/config.py` 
- Models: `backend/models.py` (TimeEntry with JSON fields for narratives/metadata)

## Development Notes

- **Database**: Uses SQLAlchemy with JSON fields for complex data (narratives, task_codes, tags)
- **CORS**: Configured for local development (frontend on :8080, backend on :5001)
- **Offline-first**: Frontend uses IndexedDB for local storage with sync capabilities
- **Agent Base Class**: All agents inherit from `backend/agents/base.py`
- **Error Handling**: Comprehensive error handling with proper HTTP status codes and logging

## Backend Structure

The backend follows a modular Flask blueprint architecture:

```
backend/
├── api/
│   └── routes/
│       ├── health.py      # Health check endpoint
│       ├── enhance.py     # AI enhancement endpoint  
│       ├── entries.py     # Time entry CRUD operations
│       └── export.py      # CSV export functionality
├── agents/                # AI processing pipeline
│   ├── base.py           # Abstract base agent class
│   ├── separator.py      # Text cleanup & activity separation agent
│   ├── refiner.py        # Narrative refinement agent
│   └── pipeline.py       # Agent orchestration
├── app.py                # Flask app factory (minimal)
├── config.py             # Configuration settings & Flask extensions
├── models.py             # SQLAlchemy models
└── prompts.py            # Centralized AI prompts for easy editing
```

## Customizing AI Prompts

All AI prompts are centralized in `backend/prompts.py` for easy customization:

- **SEPARATOR_PROMPT**: Controls how text is cleaned and activities are identified
- **REFINER_PROMPT**: Controls how activities are transformed into professional narratives

To modify AI behavior:
1. Edit the prompts in `backend/prompts.py`
2. Restart the backend server
3. Test with sample inputs

Tips for prompt engineering:
- Test changes with various input complexities
- Keep instructions clear and specific
- Use examples to show desired behavior
- Avoid conflicting instructions

## Frontend Features

### AI Assistant Interface
- **Inline Editing**: Direct editing of hours and narrative text in the list view
  - Click any editable field to modify (hours, narrative text, client code, matter number)
  - Real-time validation and total hours recalculation
  - Keyboard navigation support (Tab/Enter to save and move to next field)
- **Edit Modal**: Bulk editing interface for comprehensive entry modifications
- **Client/Matter Fields**: Each narrative can have individual client codes and matter numbers
- **Mobile Support**: Touch-friendly interface with dropdown menus for actions
- **Offline-First**: IndexedDB storage with background sync when online