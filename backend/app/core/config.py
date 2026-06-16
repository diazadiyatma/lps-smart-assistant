from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    APP_NAME: str = Field(default="LPS Smart-Assistant and Intelligent 3T Calculator")
    APP_ENV: str = Field(default="local")
    DEBUG: bool = Field(default=True)
    PORT: int = Field(default=8000)
    HOST: str = Field(default="0.0.0.0")

    SUPABASE_URL: str = Field(default="")
    SUPABASE_KEY: str = Field(default="")
    GEMINI_API_KEY: str = Field(default="")
    OCR_SPACE_KEY: str = Field(default="")

settings = Settings()
