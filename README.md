# Time Composer

A speech-first AI agent for legal billing narratives. Time Composer helps legal professionals create accurate, detailed billing entries through voice recording and AI-powered narrative enhancement.

## Executive Summary

Time Composer is an innovative AI-powered tool designed specifically for legal professionals to streamline the creation of billing narratives. By combining voice recording technology with advanced natural language processing, it transforms informal spoken notes into professional, detailed billing entries suitable for client invoicing.

### Key Benefits
- **Time Savings**: Reduces billing narrative creation time by up to 70%
- **Accuracy**: AI-enhanced grammar and formatting ensures professional quality
- **Flexibility**: Multiple interfaces (web, CLI) to suit different workflows
- **Compliance**: Generates detailed, client-ready billing descriptions

## Features

- **Voice Recording**: Record billing narratives using your microphone with real-time transcription
- **AI Enhancement**: Three-agent pipeline (Grammar, Separator, Refiner) processes raw notes into professional narratives
- **Multi-Platform**: Web interface, CLI tool, and API all sharing the same backend
- **Offline-First**: IndexedDB local storage with SQLite sync
- **Export Options**: CSV export compatible with major billing systems
- **Time Tracking**: Automatic time allocation parsing from voice notes
- **Activity Tagging**: Intelligent categorization of billable activities

## System Architecture

### Overview
Time Composer uses a microservices-inspired architecture with three main components:

1. **Backend API Server** (Flask/Python)
   - RESTful API endpoints for all operations
   - OpenAI integration for transcription and text processing
   - SQLite database for persistent storage
   - CORS-enabled for cross-origin requests

2. **Frontend Applications**
   - **Web Interface**: Single-page application with offline capabilities
   - **CLI Tool**: Terminal-based interface for power users
   - Both interfaces communicate with the same backend API

3. **AI Agent Pipeline**
   - Sequential processing through three specialized agents
   - Each agent focuses on a specific aspect of text enhancement
   - Modular design allows for easy updates and improvements

### Data Flow
```
Voice Input → Whisper API → Grammar Agent → Separator Agent → Refiner Agent → Database → Export
```

## Tech Stack

- **Backend**: Flask 3.0+, SQLAlchemy 2.0+, OpenAI API
- **Frontend**: Vanilla JavaScript (ES6+), Web Speech API, IndexedDB
- **CLI**: Click 8.0+, Rich terminal UI
- **Database**: SQLite with JSON field support
- **AI/ML**: OpenAI Whisper (transcription), GPT-4 (text processing)

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- OpenAI API key with access to Whisper and GPT-4
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access for voice recording
- 100MB free disk space for database

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd time-composer
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Verify Python version
python --version  # Should be 3.8+
```

### 3. Install Dependencies

```bash
# Install Python packages
pip install -r requirements.txt

# Install CLI tool in development mode
pip install -e .

# Verify installation
time-composer --version
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file and add your OpenAI API key
# OPENAI_API_KEY=sk-...your-key-here...
```

**Important**: Never commit your `.env` file to version control. The OpenAI API key should remain confidential.

## Running the Application

### Option 1: Quick Start (Recommended)
```bash
# Run both backend and frontend with one command
python run.py
# Backend runs on http://localhost:5001
# Frontend runs on http://localhost:8080
```

### Option 2: Manual Start

1. **Start the Backend API**:
```bash
python backend/app.py
# API server starts on http://localhost:5001
```

2. **Start the Frontend** (in a new terminal):
```bash
python -m http.server 8080 --directory frontend
# Open http://localhost:8080 in your browser
```

### Using the CLI

```bash
# Record a new entry with voice
time-composer record

# Record with text input
time-composer record "Met with client regarding contract negotiations - 2.5 hours"

# View recent entries
time-composer dashboard

# Export entries for date range
time-composer export --start 2024-01-01 --end 2024-01-31 --output january_billing.csv
```

## Project Structure

```
time-composer/
├── backend/               # Flask API server
│   ├── app.py            # Main Flask application
│   ├── models.py         # SQLAlchemy database models
│   ├── config.py         # Configuration settings
│   └── utils.py          # Utility functions
├── frontend/             # Web interface
│   ├── index.html        # Main application page
│   ├── js/
│   │   ├── app.js        # Main application logic
│   │   ├── database.js   # IndexedDB management
│   │   └── sync.js       # Offline sync logic
│   └── css/              # Stylesheets
├── cli/                  # Command-line interface
│   ├── __init__.py
│   ├── commands.py       # CLI command definitions
│   └── utils.py          # CLI utilities
├── shared/               # Shared components
│   └── agents/           # AI agent pipeline
│       ├── base.py       # Base agent class
│       ├── grammar.py    # Grammar correction agent
│       ├── separator.py  # Activity separation agent
│       ├── refiner.py    # Narrative refinement agent
│       └── pipeline.py   # Agent orchestration
├── data/                 # Database storage
│   └── time_composer.db  # SQLite database (auto-created)
├── tests/                # Test suite
│   ├── test_agents.py    # Agent pipeline tests
│   ├── test_api.py       # API endpoint tests
│   └── test_cli.py       # CLI command tests
├── requirements.txt      # Python dependencies
├── setup.py             # CLI tool installation
├── .env.example         # Environment template
├── CLAUDE.md            # AI assistant instructions
└── README.md            # This file
```

## API Documentation

### Authentication
Currently, the API does not require authentication for local use. For production deployment, implement appropriate authentication mechanisms.

### Endpoints

#### `POST /api/transcribe`
Transcribe audio file to text using OpenAI Whisper.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Audio file (webm, mp3, wav)

**Response:**
```json
{
  "text": "Transcribed text content"
}
```

#### `POST /api/enhance`
Process text through the AI agent pipeline.

**Request:**
```json
{
  "text": "Raw billing note text"
}
```

**Response:**
```json
{
  "cleaned_text": "Grammar-corrected text",
  "narratives": [
    {
      "activity": "Client meeting",
      "time": 2.5,
      "description": "Professional billing narrative"
    }
  ],
  "task_codes": ["MEETING", "CONTRACT"],
  "tags": ["client-communication", "negotiations"]
}
```

#### `GET /api/entries`
Retrieve all time entries with optional filtering.

**Query Parameters:**
- `start_date`: ISO date string (YYYY-MM-DD)
- `end_date`: ISO date string (YYYY-MM-DD)
- `status`: Entry status filter

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "original_text": "Original input",
      "cleaned_text": "Cleaned version",
      "narratives": [...],
      "created_at": "2024-01-15T10:30:00",
      "entry_date": "2024-01-15"
    }
  ]
}
```

#### `PUT /api/entries/<id>`
Update an existing time entry.

#### `POST /api/export`
Export entries as CSV file.

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
OPENAI_API_KEY=sk-...your-key-here...

# Optional
SECRET_KEY=your-flask-secret-key
DATABASE_URL=sqlite:///data/time_composer.db
```

### Database Schema

The application uses a single `time_entries` table with the following key fields:
- `id`: Primary key
- `original_text`: Raw input text
- `cleaned_text`: Grammar-corrected text
- `narratives`: JSON array of billing narratives
- `metadata`: JSON object with additional data
- `task_codes`: JSON array of task codes
- `tags`: JSON array of tags
- `created_at`: Timestamp of creation
- `entry_date`: Date of the billable work

## Security Considerations

1. **API Keys**: 
   - Store OpenAI API key in environment variables only
   - Never commit API keys to version control
   - Rotate keys regularly

2. **Database**:
   - SQLite database is stored locally
   - Contains potentially sensitive client information
   - Ensure proper file permissions (chmod 600)

3. **Network**:
   - API runs on localhost only by default
   - CORS configured for local development
   - Implement HTTPS for production deployment

4. **Data Privacy**:
   - Audio files are sent to OpenAI for transcription
   - Text is processed by OpenAI GPT models
   - Consider data retention policies

## Testing

Run the test suite:

```bash
# Run all tests
pytest tests/

# Run specific test module
pytest tests/test_agents.py -v

# Run with coverage
pytest --cov=backend --cov=shared tests/
```

## Troubleshooting

### Common Issues

1. **"ModuleNotFoundError"**
   - Ensure virtual environment is activated
   - Run `pip install -r requirements.txt`

2. **"OpenAI API key not found"**
   - Check `.env` file exists and contains valid key
   - Verify key starts with "sk-"

3. **"Port already in use"**
   - Backend default port: 5001
   - Frontend default port: 8080
   - Kill existing processes or use different ports

4. **"Microphone not working"**
   - Check browser permissions for microphone access
   - Ensure HTTPS connection (or localhost)

5. **"Database locked"**
   - Ensure only one instance of the backend is running
   - Check file permissions on `data/time_composer.db`

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
export FLASK_ENV=development
export FLASK_DEBUG=1

# Run with debug output
python backend/app.py
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for Whisper and GPT-4 APIs
- Flask and SQLAlchemy communities
- Legal professionals who provided feedback