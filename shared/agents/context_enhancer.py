from typing import Dict, Any
from .base import BaseAgent

class ContextEnhancerAgent(BaseAgent):
    """Agent for intelligently merging additional context into existing narratives"""
    
    def get_prompt(self, input_data: str) -> str:
        """Generate the enhancement prompt"""
        return f"""You are a legal writing assistant specializing in enhancing billing narratives.

{input_data}

Instructions:
1. IMPORTANT: You MUST incorporate the additional context into the narrative
2. The additional context contains new information that NEEDS to be added
3. Even if the change seems minor (like adding "and motion to dismiss"), include it
4. Preserve ALL original information while adding the new details
5. Make the integration natural and professional
6. Maintain legal billing language standards

Example:
Original Narrative: "Draft a memorandum for summary judgment concerning the driver's matter, expending 0.5 hours."
Additional Context: "and motion to dismiss"
Enhanced Narrative: "Draft a memorandum for summary judgment and motion to dismiss concerning the driver's matter, expending 0.5 hours."

Another Example:
Original Narrative: "Review contract terms for client"
Additional Context: "focusing on indemnification clauses and liability limits"
Enhanced Narrative: "Review contract terms for client, focusing on indemnification clauses and liability limits"

Provide ONLY the enhanced narrative text, nothing else. Do not include explanations or labels."""
    
    def parse_response(self, response: str) -> Dict[str, Any]:
        """Parse the enhanced narrative response"""
        return {
            'enhanced_narrative': response.strip()
        }