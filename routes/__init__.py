from .auth_routes    import auth_bp
from .main_routes    import main_bp
from .analyze_routes import analyze_bp
from .logs_routes    import logs_bp


def register_blueprints(app) -> None:
    """Register all route blueprints with the Flask app."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(analyze_bp)
    app.register_blueprint(logs_bp)