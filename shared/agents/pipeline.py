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
            refined_result = self.refiner_agent.process(entry)
            refined_narratives.append({
                'text': refined_result['refined_narrative'],
                'hours': entry.get('hours', 0.0),
                'original': entry['activity']
            })
            total_hours += entry.get('hours', 0.0)
        
        return {
            'original': raw_text,
            'cleaned': cleaned_text,
            'narratives': refined_narratives,
            'total_hours': round(total_hours, 1)
        }