from typing import Dict, Any
from .grammar import GrammarAgent
from .separator import SeparatorAgent
from .refiner import RefinerAgent

class AgentPipeline:
    """Orchestrate the three-agent pipeline"""
    
    def __init__(self):
        self.grammar_agent = GrammarAgent()
        self.separator_agent = SeparatorAgent()
        self.refiner_agent = RefinerAgent()
    
    def process(self, raw_text: str) -> Dict[str, Any]:
        # Step 1: Clean grammar
        cleaned_result = self.grammar_agent.process(raw_text)
        cleaned_text = cleaned_result['cleaned']
        
        # Step 2: Separate entries
        separated_result = self.separator_agent.process(cleaned_text)
        entries = separated_result.get('entries', [])
        
        # Step 3: Refine each entry
        refined_narratives = []
        total_hours = 0.0
        
        for entry in entries:
            # Validate hours before processing
            hours = entry.get('hours', 0.0)
            
            # Ensure hours is a number
            try:
                hours = float(hours)
            except (ValueError, TypeError):
                print(f"Warning: Invalid hours value '{hours}' for entry, defaulting to 0.0")
                hours = 0.0
            
            # Validate reasonable hour range (0-24 hours per entry)
            if hours < 0:
                print(f"Warning: Negative hours ({hours}) detected, setting to 0.0")
                hours = 0.0
            elif hours > 24:
                print(f"Warning: Unreasonable hours ({hours}) detected for single entry, capping at 24.0")
                hours = 24.0
            
            # Log if hours seem unusual but acceptable
            if hours > 12:
                print(f"Notice: Large hour value ({hours}) for entry: {entry.get('activity', 'unknown')}")
            
            refined_result = self.refiner_agent.process(entry)
            refined_narratives.append({
                'text': refined_result['refined_narrative'],
                'hours': round(hours, 2),  # Round to 2 decimal places
                'original': entry['activity']
            })
            total_hours += hours
        
        return {
            'original': raw_text,
            'cleaned': cleaned_text,
            'narratives': refined_narratives,
            'total_hours': round(total_hours, 1)
        }