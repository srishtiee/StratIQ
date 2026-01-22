from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def fetch_one(query) -> dict | None:
    # supabase-py 2.x .maybe_single() returns None (not a response wrapper) on 0 rows,
    # which makes `.data` access crash. Use limit(1) and read the first row instead.
    res = query.limit(1).execute()
    return res.data[0] if res.data else None
