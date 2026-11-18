"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "ThulasiConnect"
    app_env: str = "development"
    app_debug: bool = True
    app_secret_key: str = "dev-only-set-in-env"
    jwt_secret_key: str = "dev-only-set-jwt-in-env"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    # Server & CORS
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    cors_allowed_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    # Database
    database_url: str = "postgresql+psycopg://postgres@127.0.0.1:5432/thulasiconnect_dev"

    # Ollama local LLM
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:1.5b"
    ollama_request_timeout_seconds: int = 45

    # Faster-Whisper local CPU INT8 STT (in-memory only)
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_cpu_threads: int = 4
    whisper_beam_size: int = 3
    whisper_vad_filter: bool = True
    whisper_download_root: str = "ai-services/models"

    # Audio storage prohibition guard (always False)
    audio_storage_enabled: bool = False

    # Default escalation thresholds (minutes overdue)
    escalation_branch_manager_overdue_minutes: int = 60
    escalation_zonal_manager_overdue_minutes: int = 240
    escalation_owner_overdue_minutes: int = 1440

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @property
    def resolved_whisper_download_root(self) -> str:
        p = Path(self.whisper_download_root)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        return str(p)


@lru_cache
def get_settings() -> Settings:
    return Settings()
