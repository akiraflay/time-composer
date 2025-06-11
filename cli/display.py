"""Display utilities for Time Composer CLI"""

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.layout import Layout
from rich.progress import Progress, SpinnerColumn, TextColumn
import time

console = Console()

def show_welcome():
    """Show animated welcome banner"""
    banner_lines = [
        "╔╦╗┬┌┬┐┌─┐  ╔═╗┌─┐┌┬┐┌─┐┌─┐┌─┐┌─┐┬─┐",
        " ║ ││││├┤   ║  │ ││││├─┘│ │└─┐├┤ ├┬┘",
        " ╩ ┴┴ ┴└─┘  ╚═╝└─┘┴ ┴┴  └─┘└─┘└─┘┴└─",
        "",
        "      Legal Billing Narrative Assistant"
    ]
    
    console.clear()
    
    for i, line in enumerate(banner_lines):
        if i < 3:
            console.print(line, style="bold cyan", justify="center")
        else:
            console.print(line, style="dim", justify="center")
        time.sleep(0.05)
    
    console.print()

def show_entry_results(result):
    """Display enhanced narrative results"""
    console.print("\n[bold green]✨ Processing Complete![/bold green]\n")
    
    # Original text panel
    if result.get('original'):
        console.print(Panel(
            result['original'],
            title="[bold]Original Text[/bold]",
            border_style="dim",
            padding=(1, 2)
        ))
    
    # Cleaned text panel
    if result.get('cleaned'):
        console.print(Panel(
            result['cleaned'],
            title="[bold]Cleaned Text[/bold]",
            border_style="blue",
            padding=(1, 2)
        ))
    
    # Narratives table
    if result.get('narratives'):
        table = Table(title="Enhanced Narratives", show_header=True, header_style="bold")
        table.add_column("Entry", style="cyan", width=6)
        table.add_column("Hours", style="magenta", width=8)
        table.add_column("Narrative", style="green", no_wrap=False)
        
        for i, narrative in enumerate(result['narratives'], 1):
            table.add_row(
                f"#{i}",
                f"{narrative.get('hours', 0.0):.1f}",
                narrative.get('text', '')
            )
        
        console.print(table)
    
    # Total hours
    total_hours = result.get('total_hours', 0.0)
    console.print(f"\n[bold]Total Hours:[/bold] {total_hours:.1f}")

def show_entries_table(entries, page=1, limit=10):
    """Display entries in a formatted table"""
    if not entries:
        console.print("[yellow]No entries found[/yellow]")
        return
    
    # Calculate pagination
    total = len(entries)
    start = (page - 1) * limit
    end = min(start + limit, total)
    page_entries = entries[start:end]
    
    # Create table
    table = Table(
        title=f"Time Entries (Page {page} of {(total + limit - 1) // limit})",
        show_header=True,
        header_style="bold"
    )
    
    table.add_column("ID", style="dim", width=6)
    table.add_column("Date", style="cyan")
    table.add_column("Client", style="magenta")
    table.add_column("Hours", style="green", justify="right")
    table.add_column("Status", style="yellow")
    table.add_column("Narratives", style="white", no_wrap=False, max_width=50)
    
    for entry in page_entries:
        # Format date
        date_str = entry.get('created_at', '')[:10] if entry.get('created_at') else 'N/A'
        
        # Format narratives preview
        narratives = entry.get('narratives', [])
        if narratives:
            narrative_preview = narratives[0].get('text', '')[:50] + '...'
            if len(narratives) > 1:
                narrative_preview += f" (+{len(narratives)-1} more)"
        else:
            narrative_preview = "No narratives"
        
        # Status color
        status = entry.get('status', 'draft')
        status_colored = {
            'draft': '[yellow]draft[/yellow]',
            'ready': '[green]ready[/green]',
            'billed': '[blue]billed[/blue]'
        }.get(status, status)
        
        table.add_row(
            str(entry.get('id', '')),
            date_str,
            entry.get('client_code', 'N/A'),
            f"{entry.get('total_hours', 0.0):.1f}",
            status_colored,
            narrative_preview
        )
    
    console.print(table)
    
    # Show pagination info
    if total > limit:
        console.print(f"\nShowing {start + 1}-{end} of {total} entries")
        console.print("[dim]Use --page to navigate[/dim]")

def show_calendar(entries, month, year):
    """Display entries in calendar format"""
    import calendar
    from datetime import datetime
    
    # Create calendar
    cal = calendar.monthcalendar(year, month)
    month_name = calendar.month_name[month]
    
    console.print(f"\n[bold]{month_name} {year}[/bold]\n")
    
    # Day headers
    headers = "Sun  Mon  Tue  Wed  Thu  Fri  Sat"
    console.print(headers, style="bold")
    console.print("-" * len(headers))
    
    # Group entries by day
    entries_by_day = {}
    for entry in entries:
        try:
            entry_date = datetime.fromisoformat(entry.get('created_at', ''))
            if entry_date.month == month and entry_date.year == year:
                day = entry_date.day
                if day not in entries_by_day:
                    entries_by_day[day] = []
                entries_by_day[day].append(entry)
        except:
            continue
    
    # Display calendar
    for week in cal:
        week_str = ""
        for day in week:
            if day == 0:
                week_str += "     "
            else:
                day_str = f"{day:2d}"
                if day in entries_by_day:
                    # Highlight days with entries
                    hours = sum(e.get('total_hours', 0) for e in entries_by_day[day])
                    if hours > 0:
                        day_str = f"[bold green]{day_str}[/bold green]"
                week_str += f"{day_str}   "
        console.print(week_str)
    
    # Summary
    console.print("\n[bold]Summary:[/bold]")
    for day in sorted(entries_by_day.keys()):
        day_entries = entries_by_day[day]
        total_hours = sum(e.get('total_hours', 0) for e in day_entries)
        console.print(f"  {month}/{day}: {len(day_entries)} entries, {total_hours:.1f} hours")

def show_export_preview(entries, format_type):
    """Show export preview"""
    if not entries:
        console.print("[yellow]No entries to export[/yellow]")
        return
    
    total_hours = sum(e.get('total_hours', 0) for e in entries)
    
    panel = Panel(
        f"[bold]Export Preview[/bold]\n\n"
        f"Entries: {len(entries)}\n"
        f"Total Hours: {total_hours:.1f}\n"
        f"Format: {format_type.upper()}\n\n"
        f"[dim]Press Enter to confirm export[/dim]",
        border_style="green"
    )
    
    console.print(panel)

def show_progress(text="Processing..."):
    """Show progress spinner"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(text, total=None)
        time.sleep(2)  # Simulate work
        progress.update(task, completed=100)

def show_error(message):
    """Show error message"""
    console.print(f"[bold red]✗ Error:[/bold red] {message}")

def show_success(message):
    """Show success message"""
    console.print(f"[bold green]✓ Success:[/bold green] {message}")

def show_info(message):
    """Show info message"""
    console.print(f"[bold blue]ℹ Info:[/bold blue] {message}")