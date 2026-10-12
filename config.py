import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME = "site2chat API"
    VERSION = "1.0"
    API_V1_PREFIX = "/api/v1"
    ENVIRONMENT = "development"
    DEBUG = False

settings = Settings()
