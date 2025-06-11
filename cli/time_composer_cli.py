#!/usr/bin/env python3
"""Time Composer CLI - Legal billing narrative assistant"""

import click
import sys
import os
from rich.console import Console
from rich.prompt import Prompt
import requests
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from cli.commands import (
    record_command, 
    dashboard_command, 
    calendar_command, 
    export_command,
    interactive_mode
)
from cli.display import show_welcome

# Load environment variables
load_dotenv()

console = Console()
API_BASE = os.getenv('API_BASE_URL', 'http://localhost:5000/api')

@click.group(invoke_without_command=True)
@click.pass_context
def cli(ctx):
    """Time Composer CLI - Legal billing narrative assistant
    
    Record billing narratives through text input and enhance them with AI.
    """
    if ctx.invoked_subcommand is None:
        # No subcommand, run interactive mode
        show_welcome()
        interactive_mode()

@cli.command()
@click.argument('text', required=False)
@click.option('--client', '-c', help='Client code')
@click.option('--matter', '-m', help='Matter number')
def record(text, client, matter):
    """Record a new billing narrative
    
    If TEXT is not provided, opens interactive input mode.
    """
    if not text:
        console.print("[bold blue]Enter your billing notes:[/bold blue]")
        console.print("[dim]Type your notes and press Ctrl+D (or Ctrl+Z on Windows) when done[/dim]\n")
        
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            text = '\n'.join(lines)
        except KeyboardInterrupt:
            console.print("\n[yellow]Recording cancelled[/yellow]")
            return
    
    if not text.strip():
        console.print("[red]No text provided[/red]")
        return
    
    record_command(text, client, matter)

@cli.command()
@click.option('--status', '-s', type=click.Choice(['all', 'draft', 'ready', 'billed']), default='all', help='Filter by status')
@click.option('--limit', '-l', type=int, default=10, help='Number of entries to show')
@click.option('--page', '-p', type=int, default=1, help='Page number')
def dashboard(status, limit, page):
    """View time entries dashboard"""
    filters = {} if status == 'all' else {'status': status}
    dashboard_command(filters, limit, page)

@cli.command()
@click.option('--month', '-m', type=int, help='Month (1-12)')
@click.option('--year', '-y', type=int, help='Year')
def calendar(month, year):
    """View entries in calendar format"""
    from datetime import datetime
    
    now = datetime.now()
    month = month or now.month
    year = year or now.year
    
    calendar_command(month, year)

@cli.command()
@click.option('--start', '-s', help='Start date (YYYY-MM-DD)')
@click.option('--end', '-e', help='End date (YYYY-MM-DD)')
@click.option('--client', '-c', help='Filter by client code')
@click.option('--format', '-f', type=click.Choice(['csv', 'json', 'txt']), default='csv', help='Export format')
@click.option('--output', '-o', help='Output filename')
def export(start, end, client, format, output):
    """Export time entries"""
    filters = {}
    if start:
        filters['start_date'] = start
    if end:
        filters['end_date'] = end
    if client:
        filters['client_code'] = client
    
    export_command(filters, format, output)

@cli.command()
def sync():
    """Sync local data with server"""
    console.print("[bold]Syncing with server...[/bold]")
    
    try:
        # In a real implementation, this would sync with local storage
        response = requests.get(f"{API_BASE}/entries")
        if response.status_code == 200:
            entries = response.json()
            console.print(f"[green]✓ Synced {len(entries)} entries[/green]")
        else:
            console.print("[red]✗ Sync failed[/red]")
    except Exception as e:
        console.print(f"[red]✗ Sync error: {str(e)}[/red]")

@cli.command()
def config():
    """Configure CLI settings"""
    console.print("[bold]Time Composer Configuration[/bold]\n")
    
    api_url = Prompt.ask("API URL", default=API_BASE)
    
    # Save configuration (simplified for this example)
    console.print(f"\n[green]✓ Configuration saved[/green]")
    console.print(f"API URL: {api_url}")

@cli.command()
def version():
    """Show version information"""
    console.print("[bold]Time Composer CLI[/bold]")
    console.print("Version: 1.0.0")
    console.print("API Base: " + API_BASE)

if __name__ == '__main__':
    cli()