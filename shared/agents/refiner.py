from typing import Dict, Any
from .base import BaseAgent

class RefinerAgent(BaseAgent):
    """Refine activities into professional billing narratives"""
    
    def get_prompt(self, entry: Dict[str, Any]) -> str:
        return f"""Convert this billing activity into a professional legal narrative.

Activity: {entry['activity']}
Time: {entry.get('hours', 'unspecified')} hours

STRICT REQUIREMENTS:
- MUST start with a present tense verb (e.g., "Review", "Draft", "Analyze", "Prepare", "Attend")
- Uses active voice throughout
- Uses professional legal terminology
- Is 1-2 sentences long
- CRITICAL: Only use information from the activity description - DO NOT add details, names, specifics, or context not stated
- Keep it general and factual based only on what was provided

Examples: "Review documents for case preparation" NOT "Review contract provisions regarding indemnification clauses"

Output only the refined narrative, no explanations."""

    def parse_response(self, response: str) -> Dict[str, Any]:
        return {
            'refined_narrative': response.strip()
        }