import json
from typing import Dict, Any
from .base import BaseAgent
from prompts import SEPARATOR_PROMPT

class SeparatorAgent(BaseAgent):
    """Identify and separate distinct billing activities"""
    
    def expects_json_output(self) -> bool:
        """This agent expects JSON output"""
        return True
    
    def get_prompt(self, input_text: str) -> str:
        return SEPARATOR_PROMPT.format(input_text=input_text)

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