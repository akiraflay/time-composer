from abc import ABC, abstractmethod
from openai import OpenAI
from typing import Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()

class BaseAgent(ABC):
    """Base class for all processing agents"""
    
    def __init__(self, model="gpt-4-turbo-preview"):
        self.model = model
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        self.client = OpenAI(api_key=api_key)
    
    @abstractmethod
    def get_prompt(self, input_data: str) -> str:
        """Generate agent-specific prompt"""
        pass
    
    def process(self, input_data: str) -> Dict[str, Any]:
        """Process input through the agent"""
        prompt = self.get_prompt(input_data)
        
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )
        content = response.choices[0].message.content
        
        return self.parse_response(content)
    
    @abstractmethod
    def parse_response(self, response: str) -> Dict[str, Any]:
        """Parse the agent's response"""
        pass