import os
import logging
from flask import Flask
from config import Config
from auth import init_users_table
from routes import register_blueprints


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Suppress noisy werkzeug request logs
    logging.getLogger("werkzeug").setLevel(logging.ERROR)

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Bootstrap DB + seed admin
    with app.app_context():
        init_users_table()

    # Register all route blueprints
    register_blueprints(app)

    return app


if __name__ == "__main__":
    app = create_app()
    print("\n  WLDS-9 Online")
    print("  Scanner  →  http://127.0.0.1:5000")
    print("  History  →  http://127.0.0.1:5000/history")
    print("  Press CTRL+C to quit\n")
    app.run(debug=False)