from flask import Blueprint, request, jsonify
from agents import AgentPipeline
from models import TimeEntry
from config import db
from .entries import create_entry

enhance_bp = Blueprint('enhance', __name__)

@enhance_bp.route('/api/enhance', methods=['POST'])
def enhance():
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400
        
        text = data.get('text', '')
        if not text.strip():
            return jsonify({'error': 'Empty text provided'}), 400
        
        pipeline = AgentPipeline()
        result = pipeline.process(text)
        
        entry = create_entry(text, result)
        
        return jsonify({
            'entry': entry.to_dict(),
            'total_narratives': len(result['narratives']),
            'total_hours': result['total_hours'],
            'original_text': text,
            'cleaned_text': result['cleaned']
        })
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Enhancement failed: {str(e)}'}), 500