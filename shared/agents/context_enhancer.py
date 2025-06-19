from typing import Dict, Any
import logging
import re
from .base import BaseAgent

class ContextEnhancerAgent(BaseAgent):
    """Agent for intelligently merging additional context into existing narratives"""
    
    def __init__(self):
        super().__init__()
        self.logger = logging.getLogger(__name__)
    
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
        # Clean up the response
        enhanced_text = response.strip()
        
        # Remove any unwanted prefixes that the model might add
        enhanced_text = re.sub(r'^Enhanced Narrative:\s*', '', enhanced_text, flags=re.IGNORECASE)
        enhanced_text = re.sub(r'^Enhanced:\s*', '', enhanced_text, flags=re.IGNORECASE)
        
        return {
            'enhanced_narrative': enhanced_text
        }
    
    def process(self, input_data: str) -> Dict[str, Any]:
        """Process input with enhanced error handling"""
        try:
            self.logger.info(f"Processing context enhancement with input: {input_data[:100]}...")
            result = super().process(input_data)
            self.logger.info(f"Context enhancement successful: {result}")
            return result
        except Exception as e:
            self.logger.error(f"Context enhancement failed: {str(e)}", exc_info=True)
            
            # Try to extract the original narrative as fallback
            try:
                lines = input_data.strip().split('\n')
                for i, line in enumerate(lines):
                    if 'Original Narrative:' in line and i + 1 < len(lines):
                        return {'enhanced_narrative': lines[i + 1].strip()}
            except:
                pass
            
            raise Exception(f"Failed to enhance narrative: {str(e)}")