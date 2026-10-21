from urllib.parse import urlparse
import aiohttp
from app.core.config import settings

async def download_pdf(url: str) -> bytes:
    parsed = urlparse(url)
    allowed = {h.strip().lower() for h in settings.DOWNLOAD_ALLOWED_HOSTS.split(",") if h.strip()}
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.hostname.lower() not in allowed:
        raise ValueError("Download host is not allowed")
    if parsed.username or parsed.password or parsed.port not in (None, 80, 443):
        raise ValueError("Invalid download URL")
    limit = settings.MAX_DOWNLOAD_MB * 1024 * 1024
    data = bytearray()
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=60), trust_env=False) as session:
        async with session.get(url, allow_redirects=False) as response:
            if response.status != 200:
                raise ValueError("Download failed")
            async for chunk in response.content.iter_chunked(65536):
                if len(data) + len(chunk) > limit:
                    raise ValueError("Download too large")
                data.extend(chunk)
    return bytes(data)
