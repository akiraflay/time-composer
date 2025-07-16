from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import csv
import io

export_narratives_bp = Blueprint('export_narratives', __name__)

@export_narratives_bp.route('/api/export/narratives', methods=['POST'])
def export_narratives():
    """Export narratives to CSV format without storing in database"""
    try:
        data = request.get_json()
        narratives = data.get('narratives', [])
        export_format = data.get('format', 'csv')
        
        if not narratives:
            return jsonify({'error': 'No narratives provided'}), 400
        
        if export_format != 'csv':
            return jsonify({'error': 'Only CSV format is currently supported'}), 400
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Client Code', 'Matter Number', 'Hours', 
            'Narrative', 'Task Code', 'Status'
        ])
        
        # Write narrative data
        for narrative in narratives:
            # Extract date from createdAt or use current date
            created_at = narrative.get('createdAt', datetime.utcnow().isoformat())
            try:
                date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                date_str = date_obj.strftime('%Y-%m-%d')
            except:
                date_str = datetime.utcnow().strftime('%Y-%m-%d')
            
            writer.writerow([
                date_str,
                narrative.get('clientCode', ''),
                narrative.get('matterNumber', ''),
                narrative.get('hours', 0.0),
                narrative.get('narrative', ''),
                narrative.get('taskCode', ''),
                narrative.get('status', 'draft')
            ])
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Create response with CSV file
        response = current_app.response_class(
            csv_content,
            mimetype='text/csv',
            headers={
                'Content-Disposition': f'attachment; filename=time_entries_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
        )
        
        return response
    
    except Exception as e:
        return jsonify({'error': f'Failed to export narratives: {str(e)}'}), 500