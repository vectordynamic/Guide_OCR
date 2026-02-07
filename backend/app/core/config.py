"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "Smart Textbook Digitization Engine"
    API_V1_STR: str = "/api/v1"
    
    # MongoDB
    MONGODB_URL: str
    DATABASE_NAME: str = "digital_library"
    
    # R2/S3 Storage
    R2_ACCOUNT_ID: str
    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_BUCKET_NAME: str
    R2_PUBLIC_DOMAIN: str
    
    # Gemini Configuration
    GEMINI_API_KEY: str
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
