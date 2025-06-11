import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    
    # Database configuration with absolute path - fixed for backend directory execution
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
    DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
    
    # Ensure data directory exists
    os.makedirs(DATA_DIR, exist_ok=True)
    
    DATABASE_PATH = os.path.join(DATA_DIR, 'time_composer.db')
    # Force absolute path for SQLite URI - ignore env variable if it's relative
    ABSOLUTE_DB_PATH = os.path.abspath(DATABASE_PATH)
    env_db_url = os.getenv('DATABASE_URL')
    if env_db_url and not env_db_url.startswith('sqlite:////'):
        # Environment has relative path, use our absolute path instead
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{ABSOLUTE_DB_PATH}'
    else:
        SQLALCHEMY_DATABASE_URI = env_db_url or f'sqlite:///{ABSOLUTE_DB_PATH}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    
    # CORS settings
    CORS_ORIGINS = ['http://localhost:8080', 'http://localhost:3000', 'http://127.0.0.1:8080']
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size