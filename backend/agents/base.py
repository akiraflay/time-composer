from abc import ABC, abstractmethod
from openai import AzureOpenAI
from typing import Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

class BaseAgent(ABC):
    """Base class for all processing agents"""
    
    def __init__(self, model=None):
        # Use Azure deployment name
        self.model = model or os.getenv('AZURE_OPENAI_GPT_DEPLOYMENT', 'gpt-4.1')
        
        # Get Azure configuration
        api_key = os.getenv('AZURE_OPENAI_API_KEY')
        endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        api_version = os.getenv('AZURE_OPENAI_API_VERSION')
        
        if not api_key:
            raise ValueError("AZURE_OPENAI_API_KEY environment variable is required")
        if not endpoint:
            raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is required")
            
        self.client = AzureOpenAI(
            api_key=api_key,
            azure_endpoint=endpoint,
            api_version=api_version
        )
    
    @abstractmethod
    def get_prompt(self, input_data: str) -> str:
        """Generate agent-specific prompt"""
        pass
    
    def process(self, input_data: str) -> Dict[str, Any]:
        """Process input through the agent"""
        prompt = self.get_prompt(input_data)
        
        # Check if this agent expects JSON output
        expects_json = hasattr(self, 'expects_json_output') and self.expects_json_output()
        
        # Prepare API call parameters
        params = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
        
        # Add response_format for JSON if needed
        if expects_json:
            params["response_format"] = {"type": "json_object"}
        
        response = self.client.chat.completions.create(**params)
        content = response.choices[0].message.content
        
        return self.parse_response(content)
    
    def expects_json_output(self) -> bool:
        """Override in subclasses that expect JSON responses"""
        return False
    
    @abstractmethod
    def parse_response(self, response: str) -> Dict[str, Any]:
        """Parse the agent's response"""
        pass