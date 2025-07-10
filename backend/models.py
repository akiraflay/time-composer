from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class TimeEntry(db.Model):
    """Model for time entry records"""
    __tablename__ = 'time_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Original and processed text
    original_text = db.Column(db.Text, nullable=False)
    cleaned_text = db.Column(db.Text)
    
    # Client and matter information
    client_code = db.Column(db.String(50))
    matter_number = db.Column(db.String(50))
    
    # Narrative data (stored as JSON)
    narratives = db.Column(db.JSON, default=list)
    
    # Time tracking
    total_hours = db.Column(db.Float, default=0.0)
    
    # Status tracking
    status = db.Column(db.String(20), default='draft')  # draft, ready, billed
    
    def to_dict(self):
        """Convert model to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'updated_at': self.updated_at.isoformat() + 'Z' if self.updated_at else None,
            'original_text': self.original_text,
            'cleaned_text': self.cleaned_text,
            'client_code': self.client_code,
            'matter_number': self.matter_number,
            'narratives': self.narratives or [],
            'total_hours': self.total_hours,
            'status': self.status
        }