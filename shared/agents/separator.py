import json
from typing import Dict, Any
from .base import BaseAgent

class SeparatorAgent(BaseAgent):
    """Identify and separate distinct billing activities"""
    
    def expects_json_output(self) -> bool:
        """This agent expects JSON output"""
        return True
    
    def get_prompt(self, cleaned_text: str) -> str:
        return f"""You are a legal billing expert. Analyze this text and separate distinct billable activities.

Text: {cleaned_text}

STRICT RULES:
- Only use information explicitly stated in the text
- Do NOT add details, names, or context not mentioned
- Keep activity descriptions factual and general
- Extract only time information that is clearly stated

TIME PARSING RULES:
- Convert all time to decimal hours
- 1 hour = 1.0
- 30 minutes = 0.5 hours
- 15 minutes = 0.25 hours
- 45 minutes = 0.75 hours
- 1 hour 30 minutes = 1.5 hours
- 2.5 hours = 2.5 (already in hours)
- If someone says "spent 30 minutes", that's 0.5 hours, NOT 30 hours

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

Examples:
- "spent 30 minutes working on a memo" → hours: 0.5
- "reviewed documents for 2 hours" → hours: 2.0
- "1.5 hour meeting" → hours: 1.5"""

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
            
            result = json.loads(response)
            
            # Validate entries have required fields
            if 'entries' not in result:
                raise ValueError("Response missing 'entries' field")
            
            for entry in result['entries']:
                if 'activity' not in entry:
                    raise ValueError("Entry missing 'activity' field")
                if 'hours' not in entry:
                    entry['hours'] = 0.0  # Default to 0 if missing
                    
            return result
            
        except json.JSONDecodeError as e:
            print(f"JSON parsing error in SeparatorAgent: {e}")
            print(f"Response was: {response[:200]}...")  # Log first 200 chars
            return {"entries": []}
        except Exception as e:
            print(f"Error in SeparatorAgent parse_response: {e}")
            return {"entries": []}