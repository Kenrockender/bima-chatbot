from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenRouter (OpenAI-compatible). Cache-friendly when the prompt prefix
    # is stable, which is the whole point of this app's "stuff all PDFs" mode.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_chat_model: str = "anthropic/claude-3.5-haiku-20241022"

    # Firebase / Firestore. The service account is the secret that lets the
    # backend verify ID tokens and own all Firestore reads/writes. Provide it
    # either as inline JSON (FIREBASE_SERVICE_ACCOUNT) or a path to a JSON file
    # (FIREBASE_SERVICE_ACCOUNT_FILE / GOOGLE_APPLICATION_CREDENTIALS).
    firebase_service_account: str = ""
    firebase_service_account_file: str = ""

    # Comma-separated allow-lists. admin_emails grants admin (PDF management);
    # allowed_email_domains restricts who may sign in at all (empty = any).
    admin_emails: str = ""
    allowed_email_domains: str = ""

    # Temp dir for PDF uploads while text is extracted (then deleted — the
    # extracted text lives in Firestore, not on disk).
    upload_dir: str = "./data/uploads"

    escalation_whatsapp: str = "+62 812-0000-0000"
    escalation_email: str = "hr-it@bcalife.co.id"

    cors_origins: str = "http://localhost:3000"

    seed_dir: str = ""

    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    def allowed_domain_set(self) -> set[str]:
        return {d.strip().lower().lstrip("@") for d in self.allowed_email_domains.split(",") if d.strip()}


settings = Settings()
