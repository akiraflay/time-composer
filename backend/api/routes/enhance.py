from flask import Blueprint, request, jsonify
from agents import AgentPipeline
import uuid

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
        
        # Generate a group ID for narratives from this session
        group_id = str(uuid.uuid4())
        
        # Format narratives for frontend consumption
        narratives = []
        for narrative in result.get('narratives', []):
            narratives.append({
                'text': narrative.get('text', ''),
                'hours': narrative.get('hours', 0.0),
                'clientCode': None,  # To be filled by user
                'matterNumber': None,  # To be filled by user
                'original': narrative.get('original', '')
            })
        
        return jsonify({
            'groupId': group_id,
            'originalText': text,
            'cleanedText': result['cleaned'],
            'narratives': narratives,
            'totalHours': result['total_hours']
        })
    
    except Exception as e:
        return jsonify({'error': f'Enhancement failed: {str(e)}'}), 500