import os
import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


@pytest.mark.skipif(not DATABASE_URL, reason="DATABASE_URL not configured")
def test_database_connection():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        assert result.scalar() == 1

