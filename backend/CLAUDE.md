# Backend CLAUDE.md

This file provides guidance to Claude Code when working with the Time Composer backend.

## Backend Overview

The backend is a Flask-based REST API that serves as the core processing engine for Time Composer. It handles audio transcription, AI agent processing, database operations, and serves both the web frontend and CLI tool.

## Key Files and Their Purposes

### Core Application Files
- **app.py**: Main Flask application with all API endpoints
- **models.py**: SQLAlchemy database models (primarily TimeEntry)
- **config.py**: Configuration management with environment variables
- **extensions.py**: Flask extensions initialization (SQLAlchemy, CORS)

### API Endpoints

#### Audio Processing
- `POST /api/transcribe`: Accepts audio file, returns transcribed text via OpenAI Whisper
- `POST /api/enhance`: Processes text through the 3-agent pipeline

#### Data Management
- `GET /api/entries`: Retrieve time entries with optional date filtering
- `POST /api/entries`: Create new time entry
- `PUT /api/entries/<id>`: Update existing entry
- `DELETE /api/entries/<id>`: Delete entry
- `POST /api/entries/<id>/enhance-context`: Add context to existing narrative

#### Export
- `POST /api/export`: Export entries as CSV with date range filtering

## Database Schema

### TimeEntry Model
```python
- id: Integer (Primary Key)
- date: Date
- original_text: Text (Raw input)
- cleaned_text: Text (After grammar correction)
- narratives: JSON (Array of refined narratives)
- client_code: String
- matter_number: String
- total_hours: Float
- attorney_name: String
- task_codes: JSON (Array)
- tags: JSON (Array)
- metadata: JSON (Additional data)
- created_at: DateTime
- updated_at: DateTime
```

## Important Patterns

### Error Handling
All endpoints use consistent error responses:
```python
return jsonify({'error': 'Error message'}), status_code
```

### CORS Configuration
CORS is enabled for local development (frontend on :8080, backend on :5001)

### JSON Field Handling
The model uses JSON fields for complex data structures:
- `narratives`: Array of narrative objects with text and hours
- `task_codes`: Array of billing codes
- `tags`: Array of descriptive tags
- `metadata`: Flexible storage for additional data

### Agent Integration
The backend integrates with the shared agent pipeline:
```python
from shared.agents.pipeline import AgentPipeline
pipeline = AgentPipeline()
result = pipeline.process(text)
```

## Development Guidelines

### Adding New Endpoints
1. Define route in app.py
2. Implement request validation
3. Add proper error handling
4. Return consistent JSON responses
5. Update CORS if needed for new methods

### Database Migrations
When modifying models:
1. Update models.py
2. The app uses `db.create_all()` on startup
3. For production, consider using Flask-Migrate

### Testing Endpoints
```bash
# Test transcription
curl -X POST http://localhost:5001/api/transcribe \
  -F "audio=@recording.wav"

# Test enhancement
curl -X POST http://localhost:5001/api/enhance \
  -H "Content-Type: application/json" \
  -d '{"text": "met with client about contract"}'

# Get entries
curl http://localhost:5001/api/entries
```

### Environment Variables
Required in .env:
- `OPENAI_API_KEY`: For Whisper and GPT-4 access
- `SECRET_KEY`: Flask session key
- `DATABASE_URL`: SQLite path (optional, defaults to data/time_composer.db)

### Common Issues

1. **CORS Errors**: Check CORS configuration matches frontend URL
2. **Database Locked**: SQLite can lock with concurrent access - consider connection pooling
3. **Large Audio Files**: Implement file size limits and chunking for transcription
4. **API Rate Limits**: Handle OpenAI rate limits with retries

## Code Style

- Use Flask best practices (blueprints for larger apps)
- Validate all input data
- Use SQLAlchemy query methods over raw SQL
- Return appropriate HTTP status codes
- Log errors for debugging
- Keep endpoints focused on single responsibilities