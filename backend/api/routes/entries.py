from flask import Blueprint, request, jsonify
from datetime import datetime
from typing import List, Optional, Dict, Any
from models import TimeEntry
from config import db

entries_bp = Blueprint('entries', __name__)

@entries_bp.route('/api/entries', methods=['GET'])
def get_entries():
    try:
        status = request.args.get('status')
        client_code = request.args.get('client_code')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
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
        
        entries = query.order_by(TimeEntry.created_at.desc()).all()
        return jsonify([entry.to_dict() for entry in entries])
    
    except Exception as e:
        return jsonify({'error': 'Failed to fetch entries'}), 500

@entries_bp.route('/api/entries/<int:entry_id>', methods=['GET'])
def get_entry(entry_id):
    entry = TimeEntry.query.get_or_404(entry_id)
    return jsonify(entry.to_dict())

@entries_bp.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    try:
        entry = TimeEntry.query.get_or_404(entry_id)
        data = request.get_json()
        
        if 'client_code' in data:
            entry.client_code = data['client_code']
        if 'matter_number' in data:
            entry.matter_number = data['matter_number']
        if 'narratives' in data:
            for narrative in data['narratives']:
                if 'date' not in narrative and 'created_at' in data:
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
            entry.created_at = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        
        entry.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(entry.to_dict())
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update entry'}), 500

@entries_bp.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    try:
        entry = TimeEntry.query.get_or_404(entry_id)
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete entry'}), 500

def create_entry(text: str, result: Dict[str, Any]) -> TimeEntry:
    entry = TimeEntry(
        original_text=text,
        cleaned_text=result['cleaned'],
        narratives=result['narratives'],
        total_hours=result['total_hours']
    )
    db.session.add(entry)
    db.session.commit()
    return entry