import json
from typing import Dict, Any
from .base import BaseAgent

class SeparatorAgent(BaseAgent):
    """Identify and separate distinct billing activities"""
    
    def get_prompt(self, cleaned_text: str) -> str:
        return f"""You are a legal billing expert. Analyze this text and separate distinct billable activities.

Text: {cleaned_text}

STRICT RULES:
- Only use information explicitly stated in the text
- Do NOT add details, names, or context not mentioned
- Keep activity descriptions factual and general
- Extract only time information that is clearly stated

Output as JSON:
{{
    "entries": [
        {{
            "activity": "description of work exactly as stated",
            "hours": 0.0,
            "client_matter": "only if explicitly mentioned"
        }}
    ]
}}

Be precise with time extraction (0.1 hour increments)."""

    def parse_response(self, response: str) -> Dict[str, Any]:
        try:
            # Remove markdown code blocks if present
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()
            
            return json.loads(response)
        except Exception as e:
            return {"entries": []}