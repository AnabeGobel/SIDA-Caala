import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do ficheiro .env
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    _supabase_url = urlsplit(os.getenv("SUPABASE_URL", ""))
    SUPABASE_URL: str = urlunsplit(
        (_supabase_url.scheme, _supabase_url.netloc, "", "", "")
    )
    SUPABASE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    _model_path = Path(os.getenv("MODEL_PATH", "models/best.pt"))
    MODEL_PATH: str = str(
        _model_path if _model_path.is_absolute() else (BASE_DIR / _model_path).resolve()
    )
    _secondary_model_path = Path(
        os.getenv("SECONDARY_MODEL_PATH", "models/best2.pt")
    )
    SECONDARY_MODEL_PATH: str = str(
        _secondary_model_path
        if _secondary_model_path.is_absolute()
        else (BASE_DIR / _secondary_model_path).resolve()
    )
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:8080",
    )
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080").rstrip("/")

settings = Settings()