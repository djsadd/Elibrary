import redis
from app.core.config import settings
r = redis.from_url(settings.REDIS_URL, decode_responses=True)

def revoke_refresh(jti: str, exp: int):
    ttl = max(exp - __import__("time").time(), 0)
    r.setex(f"refresh:revoked:{jti}", int(ttl), "1")

def is_revoked(jti: str) -> bool:
    return r.exists(f"refresh:revoked:{jti}") == 1
