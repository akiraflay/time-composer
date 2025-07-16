# Time Composer

A speech-first AI agent for legal billing narratives. Time Composer helps legal professionals create accurate, detailed billing entries through voice recording and AI-powered narrative processing.

## Executive Summary

Time Composer is an innovative AI-powered tool designed specifically for legal professionals to streamline the creation of billing narratives. By combining voice recording technology with advanced natural language processing, it transforms informal spoken notes into professional, detailed billing entries suitable for client invoicing.

### Key Benefits
- **Time Savings**: Reduces billing narrative creation time by up to 70%
- **Accuracy**: AI-processed grammar and formatting ensures professional quality
- **Flexibility**: Web interface with modern UI for easy access
- **Compliance**: Generates detailed, client-ready billing descriptions

## Features

- **Voice Recording**: Record billing narratives using your microphone with real-time transcription
- **AI Processing**: Two-agent pipeline (Separator, Refiner) processes raw notes into professional narratives
- **Multi-Platform**: Web interface and API sharing the same backend
- **Offline-First**: IndexedDB local storage (no backend database)
- **Export Options**: CSV export compatible with major billing systems
- **Time Tracking**: Automatic time allocation parsing from voice notes
- **Activity Tagging**: Intelligent categorization of billable activities

## System Architecture

### Overview
Time Composer uses a microservices-inspired architecture with three main components:

1. **Backend API Server** (Flask/Python)
   - RESTful API endpoints for AI enhancement and export
   - Azure OpenAI integration for text processing
   - Stateless design (no database)
   - CORS-enabled for cross-origin requests

2. **Frontend Application**
   - **Web Interface**: Single-page application with offline capabilities
   - Communicates with the backend API via REST

3. **AI Agent Pipeline**
   - Sequential processing through two specialized agents
   - Separator: Cleans text and identifies billable activities
   - Refiner: Transforms activities into professional narratives
   - Modular design allows for easy updates and improvements

### Data Flow
```
Voice Input → Web Speech API → Frontend (IndexedDB) → Backend API → Separator Agent → Refiner Agent → Enhanced Text
```

## Tech Stack

- **Backend**: Flask 3.0+, Azure OpenAI API
- **Frontend**: Vanilla JavaScript (ES6+), Web Speech API, IndexedDB
- **Database**: IndexedDB (frontend-only, no backend database)
- **AI/ML**: Web Speech API (transcription), Azure OpenAI GPT (text processing)

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Azure OpenAI API key with GPT deployment
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access for voice recording

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
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file and add your Azure OpenAI credentials
# AZURE_OPENAI_API_KEY=your-key-here
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# AZURE_OPENAI_API_VERSION=2024-02-01
# AZURE_OPENAI_GPT_DEPLOYMENT=your-deployment-name
```

**Important**: Never commit your `.env` file to version control. The Azure OpenAI API key should remain confidential.

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


## Project Structure

```
time-composer/
├── backend/               # Flask API server
│   ├── app.py            # Main Flask application
│   ├── config.py         # Configuration settings
│   ├── prompts.py        # AI prompt templates
│   ├── api/              # API routes
│   │   └── routes/       # Route modules
│   └── agents/           # AI agent pipeline
│       ├── base.py       # Base agent class
│       ├── separator.py  # Text cleanup & activity separation agent
│       ├── refiner.py    # Narrative refinement agent
│       └── pipeline.py   # Agent orchestration
├── frontend/             # Web interface
│   ├── index.html        # Main application page
│   ├── js/
│   │   ├── app.js        # Main application logic
│   │   └── database.js   # IndexedDB management
│   └── css/              # Stylesheets
├── tests/                # Test suite
│   ├── test_agents.py    # Agent pipeline tests
│   └── test_api.py       # API endpoint tests
├── requirements.txt      # Python dependencies
├── setup.py             # Package setup
├── .env.example         # Environment template
├── CLAUDE.md            # AI assistant instructions
└── README.md            # This file
```

## API Documentation

### Authentication
Currently, the API does not require authentication for local use. For production deployment, implement appropriate authentication mechanisms.

### Endpoints

#### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

#### `POST /api/enhance`
Process text through the AI agent pipeline. This is a stateless endpoint that returns enhanced text without storing any data.

**Request:**
```json
{
  "text": "Raw billing note text"
}
```

**Response:**
```json
{
  "narratives": [
    {
      "activity": "Client meeting regarding contract negotiations",
      "time": 2.5,
      "description": "Attended meeting with client to discuss contract terms and negotiate key provisions including liability limitations and payment schedules"
    }
  ]
}
```

#### `POST /api/export/narratives`
Export narratives as CSV file. Frontend sends the narratives to be exported.

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_GPT_DEPLOYMENT=your-deployment-name

# Optional
SECRET_KEY=your-flask-secret-key
```

### Frontend Storage (IndexedDB)

The application uses IndexedDB for all data persistence with the following structure:
- Each narrative is stored as an individual record
- Fields include: id, timestamp, transcription, narratives (array), client_code, matter_number
- No backend database - all data stored locally in the browser
- Export functionality reads from IndexedDB and sends to backend for CSV generation

## Security Considerations

1. **API Keys**: 
   - Store Azure OpenAI API key in environment variables only
   - Never commit API keys to version control
   - Rotate keys regularly

2. **Data Storage**:
   - All data stored locally in browser IndexedDB
   - No backend database or server-side storage
   - Data persists only in user's browser

3. **Network**:
   - API runs on localhost only by default
   - CORS configured for local development
   - Implement HTTPS for production deployment

4. **Data Privacy**:
   - Voice transcription happens locally via Web Speech API
   - Text is processed by Azure OpenAI GPT models
   - No data is stored on backend servers

## Testing

Run the test suite:

```bash
# Run all tests
pytest tests/

# Run specific test module
pytest tests/test_agents.py -v

# Run with coverage
pytest --cov=backend tests/
```

## Troubleshooting

### Common Issues

1. **"ModuleNotFoundError"**
   - Ensure virtual environment is activated
   - Run `pip install -r requirements.txt`

2. **"Azure OpenAI API key not found"**
   - Check `.env` file exists and contains valid credentials
   - Verify all Azure OpenAI environment variables are set

3. **"Port already in use"**
   - Backend default port: 5001
   - Frontend default port: 8080
   - Kill existing processes or use different ports

4. **"Microphone not working"**
   - Check browser permissions for microphone access
   - Ensure HTTPS connection (or localhost)
   - Web Speech API requires Chrome, Edge, or Safari

5. **"IndexedDB not available"**
   - Check browser supports IndexedDB
   - Clear browser cache if database errors occur
   - Use browser dev tools to inspect IndexedDB content

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

- Azure OpenAI for GPT API services
- Flask community
- Legal professionals who provided feedback
- Web Speech API contributors