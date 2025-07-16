from typing import Dict, Any
from .base import BaseAgent
from prompts import REFINER_PROMPT

class RefinerAgent(BaseAgent):
    """Refine activities into professional billing narratives"""
    
    def get_prompt(self, entry: Dict[str, Any]) -> str:
        return REFINER_PROMPT.format(
            activity=entry['activity'],
            hours=entry.get('hours', 'unspecified')
        )

    def parse_response(self, response: str) -> Dict[str, Any]:
        return {
            'refined_narrative': response.strip()
        }