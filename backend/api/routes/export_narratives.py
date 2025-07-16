from flask import Blueprint, request, jsonify, current_app
from datetime import datetime
import csv
import io

export_narratives_bp = Blueprint('export_narratives', __name__)

@export_narratives_bp.route('/api/export/narratives', methods=['POST'])
def export_narratives():
    """Export narratives to CSV format in InTapp Import format"""
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
        
        # Write InTapp format header rows
        # Row 1: Activity for: (leave name blank)
        writer.writerow(['Activity for: '])
        
        # Row 2: Empty row
        writer.writerow([])
        
        # Row 3: Column headers
        writer.writerow([
            'Activity Type',    # A3 - leave entries blank
            'Narrative',        # B3 - use narrative field
            'Client ID',        # C3 - use clientCode field
            'Client Name',      # D3 - leave entries blank
            'Matter ID',        # E3 - use matterNumber field
            'Matter Name',      # F3 - leave entries blank
            'Duration',         # G3 - convert hours to minutes
            'Time',             # H3 - format as "M/D/YY h:mm AM/PM"
            'Comments',         # I3 - leave entries blank
            'Notes'             # J3 - leave entries blank
        ])
        
        # Write narrative data
        for narrative in narratives:
            # Extract date from createdAt or use current date
            created_at = narrative.get('createdAt', datetime.utcnow().isoformat())
            try:
                date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except:
                date_obj = datetime.utcnow()
            
            # Format time as "M/D/YY h:mm AM/PM" with internal quotes
            time_str = f'"{date_obj.strftime("%-m/%-d/%y %-I:%M %p")}"'
            
            # Convert decimal hours to minutes using lower bound
            # 0.1 = 6 min, 0.2 = 12 min, 0.3 = 18 min, etc.
            hours = float(narrative.get('hours', 0.0))
            minutes = int(hours * 60)
            duration_str = f"{minutes} min"
            
            writer.writerow([
                '',                                     # Activity Type - blank
                narrative.get('narrative', ''),         # Narrative
                narrative.get('clientCode', ''),        # Client ID
                '',                                     # Client Name - blank
                narrative.get('matterNumber', ''),      # Matter ID
                '',                                     # Matter Name - blank
                duration_str,                           # Duration
                time_str,                               # Time with quotes
                '',                                     # Comments - blank
                ''                                      # Notes - blank
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