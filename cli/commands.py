"""Command implementations for Time Composer CLI"""

import requests
import json
import csv
import os
from datetime import datetime
from rich.console import Console
from rich.prompt import Prompt, Confirm

from .display import (
    show_entry_results,
    show_entries_table,
    show_calendar,
    show_export_preview,
    show_progress,
    show_error,
    show_success,
    show_info
)

console = Console()
API_BASE = os.getenv('API_BASE_URL', 'http://localhost:5000/api')

def record_command(text, client=None, matter=None):
    """Process and record a new billing narrative"""
    try:
        # Show progress
        console.print("\n[bold green]Processing your narrative...[/bold green]")
        
        # Call enhance API
        response = requests.post(
            f"{API_BASE}/enhance",
            json={'text': text},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            result = data.get('result', {})
            entry_id = data.get('id')
            
            # Display results
            show_entry_results(result)
            
            # Ask for metadata if not provided
            if not client:
                client = Prompt.ask("\nClient code (optional)", default="")
            if not matter:
                matter = Prompt.ask("Matter number (optional)", default="")
            
            # Update entry with metadata if provided
            if (client or matter) and entry_id:
                update_data = {}
                if client:
                    update_data['client_code'] = client
                if matter:
                    update_data['matter_number'] = matter
                
                update_response = requests.put(
                    f"{API_BASE}/entries/{entry_id}",
                    json=update_data
                )
                
                if update_response.status_code == 200:
                    show_success("Entry saved with metadata")
                else:
                    show_error("Failed to update metadata")
            else:
                show_success("Entry saved")
        else:
            show_error(f"API error: {response.status_code}")
            
    except requests.exceptions.Timeout:
        show_error("Request timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        show_error("Cannot connect to API. Is the server running?")
    except Exception as e:
        show_error(f"Unexpected error: {str(e)}")

def dashboard_command(filters=None, limit=10, page=1):
    """Display time entries dashboard"""
    try:
        # Build query parameters
        params = {}
        if filters:
            params.update(filters)
        
        # Fetch entries
        response = requests.get(f"{API_BASE}/entries", params=params)
        
        if response.status_code == 200:
            entries = response.json()
            show_entries_table(entries, page, limit)
        else:
            show_error(f"Failed to fetch entries: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        show_error("Cannot connect to API. Is the server running?")
    except Exception as e:
        show_error(f"Unexpected error: {str(e)}")

def calendar_command(month, year):
    """Display entries in calendar format"""
    try:
        # Fetch all entries for the month
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        
        params = {
            'start_date': start_date,
            'end_date': end_date
        }
        
        response = requests.get(f"{API_BASE}/entries", params=params)
        
        if response.status_code == 200:
            entries = response.json()
            show_calendar(entries, month, year)
        else:
            show_error(f"Failed to fetch entries: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        show_error("Cannot connect to API. Is the server running?")
    except Exception as e:
        show_error(f"Unexpected error: {str(e)}")

def export_command(filters=None, format_type='csv', output=None):
    """Export time entries"""
    try:
        # Fetch entries with filters
        params = filters or {}
        response = requests.get(f"{API_BASE}/entries", params=params)
        
        if response.status_code != 200:
            show_error(f"Failed to fetch entries: {response.status_code}")
            return
        
        entries = response.json()
        
        if not entries:
            show_info("No entries found to export")
            return
        
        # Show preview
        show_export_preview(entries, format_type)
        
        if not Confirm.ask("Proceed with export?"):
            console.print("[yellow]Export cancelled[/yellow]")
            return
        
        # Determine output filename
        if not output:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output = f"time_entries_{timestamp}.{format_type}"
        
        # Export based on format
        if format_type == 'csv':
            export_csv(entries, output)
        elif format_type == 'json':
            export_json(entries, output)
        elif format_type == 'txt':
            export_txt(entries, output)
        
        show_success(f"Exported to {output}")
        
    except Exception as e:
        show_error(f"Export failed: {str(e)}")

def export_csv(entries, filename):
    """Export entries as CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        
        # Header
        writer.writerow([
            'Date', 'Client Code', 'Matter Number', 
            'Hours', 'Narrative', 'Status'
        ])
        
        # Data
        for entry in entries:
            date = entry.get('created_at', '')[:10]
            for narrative in entry.get('narratives', []):
                writer.writerow([
                    date,
                    entry.get('client_code', ''),
                    entry.get('matter_number', ''),
                    narrative.get('hours', 0.0),
                    narrative.get('text', ''),
                    entry.get('status', 'draft')
                ])

def export_json(entries, filename):
    """Export entries as JSON"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

def export_txt(entries, filename):
    """Export entries as formatted text"""
    with open(filename, 'w', encoding='utf-8') as f:
        for entry in entries:
            date = entry.get('created_at', '')[:10]
            client = entry.get('client_code', 'No Client')
            matter = entry.get('matter_number', '')
            
            f.write(f"Date: {date}\n")
            f.write(f"Client: {client}\n")
            if matter:
                f.write(f"Matter: {matter}\n")
            f.write("-" * 50 + "\n")
            
            for narrative in entry.get('narratives', []):
                hours = narrative.get('hours', 0.0)
                text = narrative.get('text', '')
                f.write(f"{hours:.1f} hours: {text}\n")
            
            f.write("\n")

def interactive_mode():
    """Interactive mode for CLI"""
    console.print("\n[bold]Welcome to Time Composer Interactive Mode[/bold]")
    console.print("Type 'help' for available commands or 'exit' to quit.\n")
    
    commands = {
        'record': 'Record a new time entry',
        'list': 'List recent entries',
        'calendar': 'View calendar',
        'export': 'Export entries',
        'help': 'Show this help',
        'exit': 'Exit the program'
    }
    
    while True:
        try:
            command = Prompt.ask("\n[bold blue]time-composer[/bold blue]").lower().strip()
            
            if command == 'exit' or command == 'quit':
                console.print("[yellow]Goodbye![/yellow]")
                break
                
            elif command == 'help':
                console.print("\n[bold]Available Commands:[/bold]")
                for cmd, desc in commands.items():
                    console.print(f"  {cmd:<10} - {desc}")
                    
            elif command == 'record':
                console.print("[bold]Record new entry[/bold]")
                text = Prompt.ask("Enter billing narrative")
                if text:
                    record_command(text)
                    
            elif command == 'list':
                dashboard_command()
                
            elif command == 'calendar':
                now = datetime.now()
                calendar_command(now.month, now.year)
                
            elif command == 'export':
                export_command()
                
            elif command == '':
                continue
                
            else:
                console.print(f"[red]Unknown command: {command}[/red]")
                console.print("Type 'help' for available commands")
                
        except KeyboardInterrupt:
            console.print("\n[yellow]Use 'exit' to quit[/yellow]")
        except Exception as e:
            show_error(f"Error: {str(e)}")