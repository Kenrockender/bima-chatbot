from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # OpenRouter (OpenAI-compatible). Cache-friendly when the prompt prefix
    # is stable, which is the whole point of this app's "stuff all PDFs" mode.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    # Haiku 4.5 is meaningfully smarter than 3.5 at the same price tier — a free
    # quality upgrade for both roleplay and JSON-structured tasks.
    openrouter_chat_model: str = "anthropic/claude-haiku-4.5"

    # Optional per-task overrides. Empty = reuse openrouter_chat_model, so the
    # default stays single-model (cheap). Set these only if you want a smarter
    # model for the live coach / end-of-session evaluation specifically.
    openrouter_coach_model: str = ""
    openrouter_eval_model: str = ""

    def coach_model_name(self) -> str:
        return self.openrouter_coach_model.strip() or self.openrouter_chat_model

    def eval_model_name(self) -> str:
        return self.openrouter_eval_model.strip() or self.openrouter_chat_model

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

    # Server-side speech-to-text (for iOS/Safari where Web Speech API is
    # unavailable). Uses Groq's free Whisper endpoint by default; set
    # stt_api_key to enable. Leave empty to disable the /transcribe endpoint.
    stt_api_key: str = ""
    stt_base_url: str = "https://api.groq.com/openai/v1"
    stt_model: str = "whisper-large-v3"

    # ElevenLabs text-to-speech. When elevenlabs_api_key is set, the backend
    # serves natural ElevenLabs audio via /api/training/tts and the frontend
    # uses it in place of the robotic browser voice. Leave empty to disable
    # (frontend falls back to the Web Speech API). Cost is per-character, so
    # turbo v2.5 (cheap + low latency, supports Indonesian) is the default.
    elevenlabs_api_key: str = ""
    elevenlabs_base_url: str = "https://api.elevenlabs.io/v1"
    elevenlabs_model: str = "eleven_turbo_v2_5"
    # Two multilingual voices so the customer voice matches the persona's
    # gender. Defaults are stock ElevenLabs voices (Rachel / Adam); override
    # per deployment to taste.
    elevenlabs_voice_female: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel
    elevenlabs_voice_male: str = "pNInz6obpgDQGcFmaJgB"    # Adam

    def elevenlabs_voice_for(self, gender: str) -> str:
        return self.elevenlabs_voice_male if (gender or "").lower().startswith("m") else self.elevenlabs_voice_female

    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    def allowed_domain_set(self) -> set[str]:
        return {d.strip().lower().lstrip("@") for d in self.allowed_email_domains.split(",") if d.strip()}


settings = Settings()
