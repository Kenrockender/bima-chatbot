from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_password: str = "changeme"

    # OpenRouter (OpenAI-compatible). Cache-friendly when the prompt prefix
    # is stable, which is the whole point of this app's "stuff all PDFs" mode.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_chat_model: str = "deepseek/deepseek-chat"

    sqlite_path: str = "./data/bima.db"
    upload_dir: str = "./data/uploads"

    escalation_whatsapp: str = "+62 812-0000-0000"
    escalation_email: str = "hr-it@bcalife.co.id"

    cors_origins: str = "http://localhost:3000"

    seed_dir: str = ""


settings = Settings()
