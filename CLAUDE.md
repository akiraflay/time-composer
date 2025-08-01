# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Architecture Changes (Migration from SQLite to IndexedDB)

The application has been migrated from a backend SQLite database to frontend-only IndexedDB storage:
- **Problem Solved**: Multiple narratives were stored together in single database records, causing export/duplicate coupling
- **Solution**: Each narrative is now an independent IndexedDB record with unique ID
- **Benefits**: No sync complexity, true offline-first, individual narrative operations
- **Backend Role**: Now stateless - only provides AI enhancement services, no data storage

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
  - `/api/health` - Health check
  - `/api/enhance` - AI text enhancement (returns processed narratives without storage)
  - `/api/export/narratives` - CSV export for narratives
- **No Database**: Backend is stateless, only provides AI processing services
- **Azure OpenAI integration**: GPT for text processing via two-agent pipeline

### 2. Two-Agent Processing Pipeline (`backend/agents/`)
The AI processing uses a streamlined two-agent architecture:

1. **SeparatorAgent**: Cleans up text (spelling, grammar, abbreviations) AND identifies distinct billable activities with time allocations
2. **RefinerAgent**: Transforms activities into professional billing narratives without adding invented details

Pipeline orchestrated by `AgentPipeline` class in `backend/agents/pipeline.py`.

### 3. Frontend
- **Web Interface**: Vanilla JavaScript with Web Speech API
- **Local Storage**: IndexedDB for all data persistence (no backend database)
- **Individual Narratives**: Each narrative stored as separate record with unique ID
- **No Sync Required**: Frontend-only data storage eliminates sync complexity

## Key Configuration

### Environment Variables (.env)
- `AZURE_OPENAI_API_KEY`: Required for AI processing
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_VERSION`: API version (e.g., "2024-02-01")
- `AZURE_OPENAI_GPT_DEPLOYMENT`: Deployment name for GPT model
- `SECRET_KEY`: Flask secret key

### Important File Paths
- Config: `backend/config.py` 
- IndexedDB: Browser storage (no file path needed)
- Frontend Database: `frontend/js/database.js` (IndexedDB operations)

## Development Notes

- **Frontend Storage**: IndexedDB stores individual narratives as separate records
- **CORS**: Configured for local development (frontend on :8080, backend on :5001)
- **Offline-first**: All data stored locally in IndexedDB, no backend persistence
- **Agent Base Class**: All agents inherit from `backend/agents/base.py`
- **Error Handling**: Comprehensive error handling with proper HTTP status codes and logging
- **Speech Recognition**: Web Speech API with simplified flow (no auto-restart)

## Backend Structure

The backend follows a modular Flask blueprint architecture:

```
backend/
├── api/
│   └── routes/
│       ├── health.py           # Health check endpoint
│       ├── enhance.py          # AI enhancement endpoint (stateless)
│       └── export_narratives.py # CSV export for narratives
├── agents/                     # AI processing pipeline
│   ├── base.py                # Abstract base agent class
│   ├── separator.py           # Text cleanup & activity separation agent
│   ├── refiner.py             # Narrative refinement agent
│   └── pipeline.py            # Agent orchestration
├── app.py                     # Flask app factory (minimal, no DB)
├── config.py                  # Configuration settings
└── prompts.py                 # Centralized AI prompts for easy editing
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
- **Speech-First Design**: Click "Add Entry" to start voice recording
  - Automatic microphone activation (with permission)
  - Real-time transcription display
  - No automatic restart on silence - recording ends naturally
- **Individual Narrative Storage**: Each narrative saved as separate IndexedDB record
  - Unique ID per narrative prevents coupling issues
  - Independent export/duplicate operations per narrative
  - No grouping problems when created together
- **Inline Editing**: Direct editing of hours and narrative text in the list view
  - Click any editable field to modify (hours, narrative text, client code, matter number)
  - Real-time validation and total hours recalculation
  - Keyboard navigation support (Tab/Enter to save and move to next field)
- **Client/Matter Fields**: Each narrative can have individual client codes and matter numbers
- **Mobile Support**: Touch-friendly interface with dropdown menus for actions
- **Frontend-Only Storage**: All data in IndexedDB, no backend database or sync needed