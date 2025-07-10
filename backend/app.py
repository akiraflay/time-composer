from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import sys
import os
import csv
import io
import traceback

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared.agents import AgentPipeline

from config import Config
from models import db, TimeEntry

app = Flask(__name__)
app.config.from_object(Config)

# Initialize extensions
db.init_app(app)
CORS(app, origins=Config.CORS_ORIGINS)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/enhance', methods=['POST'])
def enhance():
    """Run text through agent pipeline"""
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
        
        # Create a single entry with all narratives from this session
        entry = TimeEntry(
            original_text=text,
            cleaned_text=result['cleaned'],
            narratives=result['narratives'],  # All narratives in one entry
            total_hours=result['total_hours']
        )
        db.session.add(entry)
        db.session.commit()
        
        return jsonify({
            'entry': entry.to_dict(),
            'total_narratives': len(result['narratives']),
            'total_hours': result['total_hours'],
            'original_text': text,
            'cleaned_text': result['cleaned']
        })
    
    except Exception as e:
        app.logger.error(f"Enhancement error: {str(e)}")
        print(f"Enhancement error: {str(e)}")  # Debug output
        db.session.rollback()
        return jsonify({'error': f'Enhancement failed: {str(e)}'}), 500

@app.route('/api/entries', methods=['GET'])
def get_entries():
    """Get all time entries with optional filtering"""
    try:
        # Get query parameters
        status = request.args.get('status')
        client_code = request.args.get('client_code')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query
        query = TimeEntry.query
        
        if status:
            query = query.filter_by(status=status)
        if client_code:
            query = query.filter_by(client_code=client_code)
        if start_date:
            start = datetime.fromisoformat(start_date)
            query = query.filter(TimeEntry.created_at >= start)
        if end_date:
            end = datetime.fromisoformat(end_date)
            query = query.filter(TimeEntry.created_at <= end)
        
        # Execute query
        entries = query.order_by(TimeEntry.created_at.desc()).all()
        
        return jsonify([entry.to_dict() for entry in entries])
    
    except Exception as e:
        app.logger.error(f"Error fetching entries: {str(e)}")
        return jsonify({'error': 'Failed to fetch entries'}), 500

@app.route('/api/entries/<int:entry_id>', methods=['GET'])
def get_entry(entry_id):
    """Get a specific time entry"""
    entry = TimeEntry.query.get_or_404(entry_id)
    return jsonify(entry.to_dict())

@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    """Update a time entry"""
    try:
        entry = TimeEntry.query.get_or_404(entry_id)
        data = request.get_json()
        
        # Update fields
        if 'client_code' in data:
            entry.client_code = data['client_code']
        if 'matter_number' in data:
            entry.matter_number = data['matter_number']
        if 'narratives' in data:
            # Ensure each narrative can have its own date
            for narrative in data['narratives']:
                if 'date' not in narrative and 'created_at' in data:
                    # If no date is specified for narrative, inherit from entry
                    narrative['date'] = data['created_at']
            entry.narratives = data['narratives']
        if 'total_hours' in data:
            entry.total_hours = data['total_hours']
        if 'status' in data:
            entry.status = data['status']
        if 'original_text' in data:
            entry.original_text = data['original_text']
        if 'cleaned_text' in data:
            entry.cleaned_text = data['cleaned_text']
        if 'created_at' in data:
            # Parse the ISO format datetime string
            entry.created_at = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        
        entry.updated_at = datetime.utcnow()
        
        db.session.commit()
        return jsonify(entry.to_dict())
    
    except Exception as e:
        app.logger.error(f"Error updating entry: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to update entry'}), 500

@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a time entry"""
    try:
        entry = TimeEntry.query.get_or_404(entry_id)
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})
    
    except Exception as e:
        app.logger.error(f"Error deleting entry: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to delete entry'}), 500

@app.route('/api/entries/<int:entry_id>/enhance-context', methods=['POST'])
def enhance_context(entry_id):
    """Enhance a specific narrative with additional context"""
    try:
        entry = TimeEntry.query.get_or_404(entry_id)
        data = request.get_json()
        
        app.logger.info(f"Enhance context request for entry {entry_id}: {data}")
        
        narrative_index = data.get('narrative_index')
        original_narrative = data.get('original_narrative')
        additional_context = data.get('additional_context')
        
        if narrative_index is None or not additional_context:
            return jsonify({'error': 'Missing narrative index or context'}), 400
        
        # Ensure narrative_index is an integer
        narrative_index = int(narrative_index)
        
        # Log entry structure for debugging
        app.logger.info(f"Entry narratives: {entry.narratives}")
        app.logger.info(f"Narrative index: {narrative_index}, Type: {type(narrative_index)}")
        
        if not entry.narratives or narrative_index >= len(entry.narratives):
            return jsonify({'error': f'Invalid narrative index: {narrative_index}, entry has {len(entry.narratives) if entry.narratives else 0} narratives'}), 400
        
        # Import context enhancer
        from shared.agents.context_enhancer import ContextEnhancerAgent
        
        # Validate inputs
        if not original_narrative:
            return jsonify({'error': 'Original narrative is empty'}), 400
        
        if not additional_context.strip():
            return jsonify({'error': 'Additional context is empty'}), 400
        
        # Format the input for the agent
        input_text = f"""Original Narrative:
{original_narrative}

Additional Context:
{additional_context}"""
        
        app.logger.info(f"Context enhancer input: {input_text}")
        
        # Process enhancement
        try:
            enhancer = ContextEnhancerAgent()
            result = enhancer.process(input_text)
        except Exception as agent_error:
            app.logger.error(f"Agent processing error: {str(agent_error)}")
            return jsonify({'error': f'AI processing failed: {str(agent_error)}'}), 500
        
        # Validate the result
        if not result or 'enhanced_narrative' not in result:
            app.logger.error("Agent returned invalid result")
            return jsonify({'error': 'AI processing returned invalid result'}), 500
        
        # Log the enhancement for debugging
        app.logger.info(f"Context Enhancement Debug:")
        app.logger.info(f"  Original: {original_narrative}")
        app.logger.info(f"  Context: {additional_context}")
        app.logger.info(f"  Enhanced: {result.get('enhanced_narrative', 'NO RESULT')}")
        
        # Create a new list to ensure proper updating
        updated_narratives = list(entry.narratives)
        
        # Update the specific narrative
        enhanced_text = result.get('enhanced_narrative', original_narrative)
        updated_narratives[narrative_index]['text'] = enhanced_text
        
        # Add metadata to track enhancement
        if 'metadata' not in updated_narratives[narrative_index]:
            updated_narratives[narrative_index]['metadata'] = {}
        
        updated_narratives[narrative_index]['metadata']['enhanced'] = True
        updated_narratives[narrative_index]['metadata']['original_text'] = original_narrative
        updated_narratives[narrative_index]['metadata']['enhancement_context'] = additional_context
        updated_narratives[narrative_index]['metadata']['enhanced_at'] = datetime.utcnow().isoformat()
        
        # Assign back to entry
        entry.narratives = updated_narratives
        
        # Mark entry as updated
        entry.updated_at = datetime.utcnow()
        
        # Force SQLAlchemy to recognize the change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(entry, 'narratives')
        
        # Save changes
        db.session.commit()
        
        app.logger.info(f"Successfully enhanced narrative {narrative_index} for entry {entry_id}")
        
        return jsonify({
            'success': True,
            'entry': entry.to_dict(),
            'enhanced_narrative': result['enhanced_narrative']
        })
    
    except ValueError as e:
        app.logger.error(f"Validation error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f"Error enhancing context: {str(e)}")
        app.logger.error(f"Traceback: {traceback.format_exc()}")
        db.session.rollback()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/export', methods=['POST'])
def export_entries():
    """Export entries as CSV"""
    try:
        data = request.get_json()
        entry_ids = data.get('entry_ids', [])
        
        # Get entries
        if entry_ids:
            entries = TimeEntry.query.filter(TimeEntry.id.in_(entry_ids)).all()
        else:
            entries = TimeEntry.query.all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Client Code', 'Matter Number', 'Hours', 
            'Narrative', 'Task Code', 'Status'
        ])
        
        # Write data
        for entry in entries:
            for narrative in (entry.narratives or []):
                # Use narrative date if available, otherwise use entry date
                if 'date' in narrative:
                    date_str = datetime.fromisoformat(narrative['date'].replace('Z', '+00:00')).strftime('%Y-%m-%d')
                else:
                    date_str = entry.created_at.strftime('%Y-%m-%d')
                    
                writer.writerow([
                    date_str,
                    narrative.get('client_code', entry.client_code) or '',
                    narrative.get('matter_number', entry.matter_number) or '',
                    narrative.get('hours', 0.0),
                    narrative.get('text', ''),
                    narrative.get('task_code', ''),
                    narrative.get('status', entry.status)
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
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

def init_db():
    """Initialize the database"""
    with app.app_context():
        db.create_all()
        print("Database initialized successfully")

if __name__ == '__main__':
    # Ensure data directory exists
    os.makedirs(Config.DATA_DIR, exist_ok=True)
    
    # Initialize database
    init_db()
    
    # Run the app on port 5001 (avoids macOS AirPlay conflict)
    app.run(debug=True, host='0.0.0.0', port=5001)