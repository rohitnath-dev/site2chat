import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

url = os.getenv("DATABASE_URL")
if not url:
    raise RuntimeError("DATABASE_URL missing in .env")

engine = create_engine(url, pool_pre_ping=True)

with engine.connect() as connection:
    result = connection.execute(text("SELECT version()"))
    print("Database connected successfully!")
    print(result.scalar())
