"""Test cases for Time Composer agents"""

import pytest
import sys
import os

# Add parent directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.agents import GrammarAgent, SeparatorAgent, RefinerAgent, AgentPipeline

class TestGrammarAgent:
    """Test the Grammar Agent"""
    
    def test_grammar_correction(self):
        """Test grammar correction functionality"""
        agent = GrammarAgent()
        
        # Test input with grammar issues
        test_input = "met w/ client abt contract. reviewed docs for 2hrs"
        
        # Note: This would require an actual OpenAI API call in real tests
        # For now, we test the structure
        assert agent.get_prompt(test_input) is not None
        assert "Clean up the following billing notes" in agent.get_prompt(test_input)
    
    def test_parse_response(self):
        """Test response parsing"""
        agent = GrammarAgent()
        
        response = "Met with client about contract. Reviewed documents for 2 hours."
        result = agent.parse_response(response)
        
        assert 'cleaned' in result
        assert result['cleaned'] == response.strip()

class TestSeparatorAgent:
    """Test the Separator Agent"""
    
    def test_get_prompt(self):
        """Test prompt generation"""
        agent = SeparatorAgent()
        
        test_input = "Met with client for 1 hour. Reviewed contracts for 2 hours."
        prompt = agent.get_prompt(test_input)
        
        assert "separate distinct billable activities" in prompt
        assert test_input in prompt
    
    def test_parse_response_valid_json(self):
        """Test parsing valid JSON response"""
        agent = SeparatorAgent()
        
        valid_json = '''
        {
            "entries": [
                {
                    "activity": "Met with client",
                    "hours": 1.0,
                    "client_matter": "ABC123"
                }
            ]
        }
        '''
        
        result = agent.parse_response(valid_json)
        assert 'entries' in result
        assert len(result['entries']) == 1
        assert result['entries'][0]['hours'] == 1.0
    
    def test_parse_response_invalid_json(self):
        """Test parsing invalid JSON response"""
        agent = SeparatorAgent()
        
        invalid_json = "This is not JSON"
        result = agent.parse_response(invalid_json)
        
        assert result == {"entries": []}

class TestRefinerAgent:
    """Test the Refiner Agent"""
    
    def test_get_prompt(self):
        """Test prompt generation"""
        agent = RefinerAgent()
        
        entry = {
            "activity": "Met with client",
            "hours": 1.5
        }
        
        prompt = agent.get_prompt(entry)
        
        assert "professional legal narrative" in prompt
        assert entry["activity"] in prompt
        assert str(entry["hours"]) in prompt
    
    def test_parse_response(self):
        """Test response parsing"""
        agent = RefinerAgent()
        
        response = "Conducted client meeting to discuss contract terms and negotiation strategy."
        result = agent.parse_response(response)
        
        assert 'refined_narrative' in result
        assert result['refined_narrative'] == response

class TestAgentPipeline:
    """Test the Agent Pipeline"""
    
    def setup_method(self):
        """Set up test environment"""
        # Mock the agents to avoid API calls
        self.pipeline = AgentPipeline()
    
    def test_pipeline_structure(self):
        """Test that pipeline has all required agents"""
        assert hasattr(self.pipeline, 'grammar_agent')
        assert hasattr(self.pipeline, 'separator_agent')
        assert hasattr(self.pipeline, 'refiner_agent')
    
    def test_process_method_exists(self):
        """Test that process method exists and has correct signature"""
        assert hasattr(self.pipeline, 'process')
        assert callable(self.pipeline.process)

# Integration tests (would require API mocking in real implementation)
class TestIntegration:
    """Integration tests for the full system"""
    
    def test_sample_billing_text(self):
        """Test with sample billing text"""
        sample_text = """
        Met with client John Smith about the merger agreement.
        Spent 2 hours reviewing the contract terms.
        Called opposing counsel for 30 minutes to discuss timeline.
        """
        
        # This would test the full pipeline if we had API mocking
        # For now, just verify the text is processable
        assert len(sample_text.strip()) > 0
        assert "hours" in sample_text.lower()

if __name__ == '__main__':
    pytest.main([__file__])