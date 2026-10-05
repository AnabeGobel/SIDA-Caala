from functools import lru_cache

from supabase import Client, create_client
from app.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configuradas no .env")

    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)