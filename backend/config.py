import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Azure OpenAI Configuration
    AZURE_OPENAI_API_KEY = os.getenv('AZURE_OPENAI_API_KEY')
    AZURE_OPENAI_ENDPOINT = os.getenv('AZURE_OPENAI_ENDPOINT')
    AZURE_OPENAI_API_VERSION = os.getenv('AZURE_OPENAI_API_VERSION')
    AZURE_OPENAI_GPT_DEPLOYMENT = os.getenv('AZURE_OPENAI_GPT_DEPLOYMENT')
    
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # CORS settings
    CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080']
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size


# Flask extension objects
from flask_cors import CORS

cors = CORS()