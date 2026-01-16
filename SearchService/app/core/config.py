from pydantic import AnyHttpUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ENV: str = "prod"

    ELASTIC_URL: AnyHttpUrl = "http://elasticsearch:9200"
    ELASTIC_INDEX_BOOKS: str = "books"
    ELASTIC_REQUEST_TIMEOUT_S: float = 5.0

    CATALOG_SERVICE_URL: AnyHttpUrl = "http://catalog:8002"
    CATALOG_TIMEOUT_S: float = 10.0

    INIT_INDEX_ON_START: bool = True
    REINDEX_ON_START: bool = False

    ADMIN_TOKEN: str = ""

    SEARCH_DEFAULT_LIMIT: int = 20
    SEARCH_MAX_LIMIT: int = 50
    SUGGEST_DEFAULT_LIMIT: int = 10
    SUGGEST_MAX_LIMIT: int = 20


settings = Settings()

