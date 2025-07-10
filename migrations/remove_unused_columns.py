#!/usr/bin/env python3
"""
Migration script to remove unused columns from the time_entries table.
Removes: attorney_email, attorney_name, task_codes, tags
"""

import sqlite3
import sys
import os
from datetime import datetime

def migrate():
    """Remove unused columns from time_entries table"""
    
    # Get database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'time_composer.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    # Create backup
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"Creating backup at {backup_path}")
    
    try:
        import shutil
        shutil.copy2(db_path, backup_path)
    except Exception as e:
        print(f"Failed to create backup: {e}")
        return False
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(time_entries)")
        columns = {row[1] for row in cursor.fetchall()}
        
        columns_to_drop = ['attorney_email', 'attorney_name', 'task_codes', 'tags']
        existing_columns_to_drop = [col for col in columns_to_drop if col in columns]
        
        if not existing_columns_to_drop:
            print("No columns to drop - migration may have already been applied")
            return True
        
        print(f"Columns to drop: {existing_columns_to_drop}")
        
        # SQLite doesn't support DROP COLUMN directly, so we need to:
        # 1. Create a new table without the columns
        # 2. Copy data from old table
        # 3. Drop old table
        # 4. Rename new table
        
        # Get current table schema
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='time_entries'")
        create_sql = cursor.fetchone()[0]
        
        # Create new table without the unwanted columns
        cursor.execute("""
            CREATE TABLE time_entries_new (
                id INTEGER PRIMARY KEY,
                created_at DATETIME NOT NULL,
                updated_at DATETIME,
                original_text TEXT NOT NULL,
                cleaned_text TEXT,
                client_code VARCHAR(50),
                matter_number VARCHAR(50),
                narratives JSON,
                total_hours FLOAT,
                status VARCHAR(20)
            )
        """)
        
        # Copy data from old table to new table
        cursor.execute("""
            INSERT INTO time_entries_new 
            (id, created_at, updated_at, original_text, cleaned_text, 
             client_code, matter_number, narratives, total_hours, status)
            SELECT id, created_at, updated_at, original_text, cleaned_text,
                   client_code, matter_number, narratives, total_hours, status
            FROM time_entries
        """)
        
        # Drop old table
        cursor.execute("DROP TABLE time_entries")
        
        # Rename new table
        cursor.execute("ALTER TABLE time_entries_new RENAME TO time_entries")
        
        # Commit changes
        conn.commit()
        print("Migration completed successfully")
        
        # Verify
        cursor.execute("PRAGMA table_info(time_entries)")
        new_columns = {row[1] for row in cursor.fetchall()}
        print(f"Current columns: {new_columns}")
        
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)