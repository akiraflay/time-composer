from flask import Flask
import os
from config import Config, db, cors
from api.routes.health import health_bp
from api.routes.enhance import enhance_bp
from api.routes.entries import entries_bp
from api.routes.export import export_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    db.init_app(app)
    cors.init_app(app, origins=Config.CORS_ORIGINS)
    
    app.register_blueprint(health_bp)
    app.register_blueprint(enhance_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(export_bp)
    
    return app

# Create app instance for compatibility with run.py
app = create_app()

if __name__ == '__main__':
    os.makedirs(Config.DATA_DIR, exist_ok=True)
    
    with app.app_context():
        db.create_all()
        print("Database initialized successfully")
    
    app.run(debug=True, host='0.0.0.0', port=5001)