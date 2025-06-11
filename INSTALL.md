# Time Composer Installation Guide

## Quick Start

1. **Validate Installation**:
   ```bash
   python3 validate.py
   ```

2. **Set up Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Application**:
   ```bash
   python run.py
   ```

The application will automatically:
- Start the Flask backend on `http://localhost:5000`
- Start the frontend server on `http://localhost:8080`
- Open your browser to the web interface

## Manual Setup

### Backend API

1. **Start the Flask API**:
   ```bash
   cd backend
   python app.py
   ```

2. **Or use Gunicorn for production**:
   ```bash
   gunicorn -c gunicorn_config.py app:app
   ```

### Frontend Web Interface

1. **Serve the frontend**:
   ```bash
   python -m http.server 8080 --directory frontend
   ```

2. **Open in browser**: `http://localhost:8080`

### CLI Tool

1. **Install CLI globally**:
   ```bash
   pip install -e .
   ```

2. **Use the CLI**:
   ```bash
   # Interactive mode
   time-composer

   # Direct commands
   time-composer record "Met with client for 2 hours"
   time-composer dashboard
   time-composer export --start 2024-01-01 --end 2024-01-31
   ```

## Environment Configuration

The `.env` file contains your OpenAI API key and other settings:

```env
OPENAI_API_KEY=your-api-key-here
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///data/time_composer.db
```

## Features Overview

### Web Interface
- **Real-time Speech Recognition**: Uses browser Web Speech API for live transcription
- **Audio Recording**: Records high-quality audio for Whisper transcription
- **Hybrid Approach**: Combines real-time feedback with accurate AI transcription
- **Offline Support**: IndexedDB storage with server synchronization
- **Export Options**: CSV export for billing systems

### CLI Tool
- **Interactive Mode**: Run `time-composer` for guided experience
- **Direct Commands**: Process text directly from command line
- **Rich Terminal UI**: Beautiful formatted output with tables and progress indicators
- **Export Capabilities**: Multiple format support (CSV, JSON, TXT)

### AI Agent Pipeline
1. **Grammar Agent**: Fixes spelling, grammar, and expands abbreviations
2. **Separator Agent**: Identifies distinct billable activities and time allocations
3. **Refiner Agent**: Transforms activities into professional billing narratives

## API Endpoints

- `POST /api/transcribe` - Transcribe audio using Whisper
- `POST /api/enhance` - Process text through AI agents
- `GET /api/entries` - Get all time entries (with optional filters)
- `PUT /api/entries/<id>` - Update a time entry
- `DELETE /api/entries/<id>` - Delete a time entry
- `POST /api/export` - Export entries as CSV

## Browser Requirements

- **Chrome/Edge**: Full support including Web Speech API
- **Firefox**: Audio recording only (no real-time transcription)
- **Safari**: Audio recording only (no real-time transcription)

## Troubleshooting

### Common Issues

1. **"Module not found" errors**: Make sure virtual environment is activated and dependencies installed
2. **API connection failed**: Ensure Flask backend is running on port 5000
3. **No microphone access**: Grant browser permissions for microphone access
4. **OpenAI API errors**: Check your API key in `.env` file

### Debug Mode

Run with debug logging:
```bash
export FLASK_DEBUG=1
python backend/app.py
```

## System Requirements

- Python 3.8+
- Modern web browser with microphone support
- OpenAI API key
- 100MB disk space

## Security Notes

- API keys are stored in `.env` file (not committed to git)
- All data stored locally in SQLite database
- No data sent to external services except OpenAI API
- HTTPS recommended for production deployment