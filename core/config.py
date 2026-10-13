import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME = "site2chat API"
    VERSION = "1.0"
    API_V1_PREFIX = "/api/v1"
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

    ADMIN_API_TOKEN = os.getenv("ADMIN_API_TOKEN", "")
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
    OPENROUTER_KEY_ENCRYPTION_KEY = os.getenv(
        "OPENROUTER_KEY_ENCRYPTION_KEY", ""
    ).strip()


settings = Settings()
