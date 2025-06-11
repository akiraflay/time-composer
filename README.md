# Time Composer

A speech-first AI agent for legal billing narratives. Time Composer helps legal professionals create accurate, detailed billing entries through voice recording and AI-powered narrative enhancement.

## Features

- **Voice Recording**: Record billing narratives using your microphone with real-time transcription
- **AI Enhancement**: Three-agent pipeline (Grammar, Separator, Refiner) processes raw notes into professional narratives
- **Multi-Platform**: Web interface, CLI tool, and API all sharing the same backend
- **Offline-First**: IndexedDB local storage with SQLite sync
- **Export Options**: CSV export for billing systems

## Tech Stack

- **Backend**: Flask, SQLAlchemy, OpenAI API
- **Frontend**: Vanilla JavaScript, Web Speech API, IndexedDB
- **CLI**: Click, Rich terminal UI
- **Database**: SQLite

## Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd time-composer

# Install Python dependencies
pip install -r requirements.txt

# Install CLI tool
pip install -e .

# Set up environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### Running the Application

1. **Start the Backend API**:
```bash
python backend/app.py
```

2. **Open the Web Interface**:
```bash
# In a new terminal
python -m http.server 8080 --directory frontend
# Open http://localhost:8080 in your browser
```

3. **Use the CLI**:
```bash
# Record a new entry
time-composer record "Met with client regarding contract negotiations"

# View dashboard
time-composer dashboard

# Export entries
time-composer export --output billing_entries.csv
```

## Project Structure

```
time-composer/
├── backend/          # Flask API server
├── frontend/         # Vanilla JS web interface
├── cli/             # Command-line interface
├── shared/          # Shared agent architecture
├── data/            # SQLite database
└── tests/           # Test suite
```

## API Endpoints

- `POST /api/transcribe` - Transcribe audio using Whisper
- `POST /api/enhance` - Process text through AI agents
- `GET /api/entries` - Get all time entries
- `PUT /api/entries/<id>` - Update a time entry
- `POST /api/export` - Export entries as CSV

## Agent Pipeline

1. **Grammar Agent**: Fixes spelling, grammar, and expands abbreviations
2. **Separator Agent**: Identifies distinct billable activities and time allocations
3. **Refiner Agent**: Transforms activities into professional billing narratives

## License

MIT