from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import csv
import io
from typing import List, Optional
from models import TimeEntry

export_bp = Blueprint('export', __name__)

@export_bp.route('/api/export', methods=['POST'])
def export_entries():
    try:
        data = request.get_json()
        entry_ids = data.get('entry_ids', [])
        
        if entry_ids:
            entries = TimeEntry.query.filter(TimeEntry.id.in_(entry_ids)).all()
        else:
            entries = TimeEntry.query.all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow([
            'Date', 'Client Code', 'Matter Number', 'Hours', 
            'Narrative', 'Task Code', 'Status'
        ])
        
        for entry in entries:
            for narrative in (entry.narratives or []):
                if 'date' in narrative:
                    date_str = datetime.fromisoformat(
                        narrative['date'].replace('Z', '+00:00')
                    ).strftime('%Y-%m-%d')
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
        
        csv_content = output.getvalue()
        
        response = current_app.response_class(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=time_entries_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
        return response
    
    except Exception as e:
        return jsonify({'error': 'Failed to export entries'}), 500