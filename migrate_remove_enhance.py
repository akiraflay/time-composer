#!/usr/bin/env python3
"""
Migration script to remove enhancement metadata from existing time entries.
This preserves the current narrative text while removing enhancement tracking.
"""

import os
import sys
import json
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app import app, db
from models import TimeEntry


def migrate_entries():
    """Clean enhancement metadata from all time entries"""
    
    with app.app_context():
        # Get all entries
        entries = TimeEntry.query.all()
        
        migrated_count = 0
        
        for entry in entries:
            if entry.narratives:
                modified = False
                cleaned_narratives = []
                
                for narrative in entry.narratives:
                    # Check if narrative has enhancement metadata
                    if isinstance(narrative, dict) and 'metadata' in narrative:
                        metadata = narrative.get('metadata', {})
                        
                        # Remove enhancement-related fields
                        if any(key in metadata for key in ['enhanced', 'original_text', 'enhancement_context', 'enhanced_at']):
                            # Create cleaned narrative without enhancement metadata
                            cleaned_metadata = {k: v for k, v in metadata.items() 
                                              if k not in ['enhanced', 'original_text', 'enhancement_context', 'enhanced_at']}
                            
                            cleaned_narrative = {
                                'text': narrative.get('text', ''),
                                'hours': narrative.get('hours', 0),
                                'metadata': cleaned_metadata if cleaned_metadata else {}
                            }
                            
                            # Remove empty metadata dict
                            if not cleaned_narrative['metadata']:
                                del cleaned_narrative['metadata']
                                
                            cleaned_narratives.append(cleaned_narrative)
                            modified = True
                        else:
                            cleaned_narratives.append(narrative)
                    else:
                        cleaned_narratives.append(narrative)
                
                if modified:
                    entry.narratives = cleaned_narratives
                    migrated_count += 1
        
        if migrated_count > 0:
            # Backup current database first
            backup_file = f"data/time_composer_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            os.system(f"cp data/time_composer.db {backup_file}")
            print(f"Created backup at: {backup_file}")
            
            # Commit changes
            db.session.commit()
            print(f"Successfully migrated {migrated_count} entries")
        else:
            print("No entries needed migration")
        
        # Show sample of migrated data
        if migrated_count > 0:
            sample_entry = TimeEntry.query.filter(TimeEntry.narratives != None).first()
            if sample_entry:
                print("\nSample migrated entry narratives:")
                print(json.dumps(sample_entry.narratives, indent=2))


if __name__ == "__main__":
    print("Starting migration to remove enhancement metadata...")
    
    # Confirm with user
    response = input("\nThis will remove all enhancement metadata from the database. Continue? (yes/no): ")
    if response.lower() != 'yes':
        print("Migration cancelled")
        sys.exit(0)
    
    try:
        migrate_entries()
        print("\nMigration completed successfully!")
    except Exception as e:
        print(f"\nError during migration: {e}")
        sys.exit(1)