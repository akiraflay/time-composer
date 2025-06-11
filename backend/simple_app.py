#!/usr/bin/env python3
"""Simplified Flask app for Time Composer"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import sys
import os
import tempfile
import json
from datetime import datetime

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared.agents import AgentPipeline

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configure OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')

# Simple in-memory storage for now
entries_store = []
entry_id_counter = 1

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """Transcribe audio using OpenAI Whisper"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_file:
            audio_file.save(tmp_file.name)
            temp_path = tmp_file.name
        
        try:
            # Transcribe with Whisper
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            with open(temp_path, 'rb') as audio:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio
                )
            
            return jsonify({'text': transcript.text})
        
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        app.logger.error(f"Transcription error: {str(e)}")
        return jsonify({'error': f'Transcription failed: {str(e)}'}), 500

@app.route('/api/enhance', methods=['POST'])
def enhance():
    """Run text through agent pipeline"""
    global entry_id_counter, entries_store
    
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
        
        text = data.get('text', '')
        if not text.strip():
            return jsonify({'error': 'Empty text provided'}), 400
        
        # Initialize agent pipeline
        pipeline = AgentPipeline()
        
        # Process through agents
        result = pipeline.process(text)
        
        # Create entry
        entry = {
            'id': entry_id_counter,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'original_text': text,
            'cleaned_text': result['cleaned'],
            'narratives': result['narratives'],
            'total_hours': result['total_hours'],
            'status': 'draft',
            'client_code': None,
            'matter_number': None,
            'attorney_email': None,
            'attorney_name': None,
            'task_codes': [],
            'tags': []
        }
        
        entries_store.append(entry)
        entry_id_counter += 1
        
        return jsonify({
            'id': entry['id'],
            'result': result
        })
    
    except Exception as e:
        app.logger.error(f"Enhancement error: {str(e)}")
        return jsonify({'error': f'Enhancement failed: {str(e)}'}), 500

@app.route('/api/entries', methods=['GET'])
def get_entries():
    """Get all time entries"""
    try:
        return jsonify(entries_store)
    except Exception as e:
        app.logger.error(f"Error fetching entries: {str(e)}")
        return jsonify({'error': 'Failed to fetch entries'}), 500

@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    """Update a time entry"""
    try:
        data = request.get_json()
        
        # Find entry
        entry = next((e for e in entries_store if e['id'] == entry_id), None)
        if not entry:
            return jsonify({'error': 'Entry not found'}), 404
        
        # Update fields
        if 'client_code' in data:
            entry['client_code'] = data['client_code']
        if 'matter_number' in data:
            entry['matter_number'] = data['matter_number']
        if 'status' in data:
            entry['status'] = data['status']
        
        entry['updated_at'] = datetime.utcnow().isoformat()
        
        return jsonify(entry)
    
    except Exception as e:
        app.logger.error(f"Error updating entry: {str(e)}")
        return jsonify({'error': 'Failed to update entry'}), 500

@app.route('/api/export', methods=['POST'])
def export_entries():
    """Export entries as CSV"""
    try:
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Client Code', 'Matter Number', 'Hours', 
            'Narrative', 'Status'
        ])
        
        # Write data
        for entry in entries_store:
            for narrative in (entry.get('narratives') or []):
                writer.writerow([
                    entry.get('created_at', '')[:10],
                    entry.get('client_code', ''),
                    entry.get('matter_number', ''),
                    narrative.get('hours', 0.0),
                    narrative.get('text', ''),
                    entry.get('status', 'draft')
                ])
        
        # Return CSV content
        csv_content = output.getvalue()
        response = app.response_class(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=time_entries_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
        return response
    
    except Exception as e:
        app.logger.error(f"Error exporting entries: {str(e)}")
        return jsonify({'error': 'Failed to export entries'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🚀 Starting Time Composer API...")
    print(f"OpenAI API Key: {'Set' if os.getenv('OPENAI_API_KEY') else 'Missing'}")
    app.run(debug=True, host='0.0.0.0', port=5001)