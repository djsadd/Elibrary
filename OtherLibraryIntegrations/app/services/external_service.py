import requests
from app.core.config import settings
from app.core.logging import logger


class ExternalLibraryService:
    """Сервис для взаимодействия с внешней библиотекой lib.tau-edu.kz"""

    def __init__(self):
        self.url = f"{settings.LIB_TAU_SCHEME}://{settings.LIB_TAU_HOST}:{settings.LIB_TAU_PORT}/get_posts"
        self.auth = (settings.LIB_TAU_USER, settings.LIB_TAU_PASSWORD)

    def fetch_books(self):
        """Получение списка PDF с внешней библиотеки"""
        if settings.LIB_TAU_SCHEME != "https" or not all(self.auth):
            raise RuntimeError("Configure HTTPS and integration credentials")
        try:
            resp = requests.get(self.url, auth=self.auth, timeout=30, allow_redirects=False)
            resp.raise_for_status()
            return resp.json().get("pdf_list", [])
        except requests.RequestException as e:
            logger.error(f"Failed to fetch books from external library: {e}")
            return []


class ExternalLibraryServiceSubjects:
    """Сервис для взаимодействия с внешней библиотекой lib.tau-edu.kz"""
    def __init__(self):
        self.url = f"{settings.LIB_TAU_SCHEME}://{settings.LIB_TAU_HOST}:{settings.LIB_TAU_PORT}/crawl_pdfs"
        self.auth = (settings.LIB_TAU_USER, settings.LIB_TAU_PASSWORD)

    def fetch_books(self):
        """Получение списка PDF с внешней библиотеки"""
        if settings.LIB_TAU_SCHEME != "https" or not all(self.auth):
            raise RuntimeError("Configure HTTPS and integration credentials")
        try:
            resp = requests.get(self.url, auth=self.auth, timeout=30, allow_redirects=False)
            resp.raise_for_status()
            return resp.json().get("pdfs", [])
        except requests.RequestException as e:
            logger.error(f"Failed to fetch books from external library: {e}")
            return []
