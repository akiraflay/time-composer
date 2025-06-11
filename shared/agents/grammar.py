from typing import Dict, Any
from .base import BaseAgent

class GrammarAgent(BaseAgent):
    """Clean up grammar, spelling, and structure"""
    
    def get_prompt(self, input_data: str) -> str:
        return f"""You are a legal writing assistant focused on grammar and clarity.
        
Clean up the following billing notes:
- Fix spelling and grammar errors only
- Expand only standard abbreviations (re: -> regarding, w/ -> with, abt -> about)
- NEVER add names, details, or context not explicitly stated
- NEVER infer what activities involved - keep descriptions general
- Maintain all factual content and time references exactly as stated
- Do not add or remove any substantive information

Input: {input_data}

Output the cleaned text only, no explanations."""

    def parse_response(self, response: str) -> Dict[str, Any]:
        return {
            'cleaned': response.strip()
        }