"""Generate missing private Compose configuration without replacing existing secrets."""
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / ".local" / "compose-secrets.env"
PRIVATE.parent.mkdir(parents=True, exist_ok=True)
if not PRIVATE.exists():
    PRIVATE.write_text("\n".join(f"{key}={secrets.token_urlsafe(48)}" for key in
                               ("POSTGRES_PASSWORD", "JWT_SECRET_KEY", "INTERNAL_API_TOKEN", "SEARCH_ADMIN_TOKEN")) + "\n")
values = dict(line.split("=", 1) for line in PRIVATE.read_text().splitlines() if "=" in line)


def save_missing(relative, data):
    path = ROOT / relative
    if path.exists():
        print(f"Preserved {relative}")
        return
    path.write_text("\n".join(f"{key}={value}" for key, value in data.items()) + "\n", encoding="utf-8")
    print(f"Created {relative}")


def db(name):
    return f"postgresql+psycopg2://elib:{values['POSTGRES_PASSWORD']}@postgres:5432/{name}"


save_missing(".env", {"POSTGRES_PASSWORD": values["POSTGRES_PASSWORD"]})
save_missing("AuthService/.env.prod", {
    "DATABASE_URL": db("elib_auth"), "REDIS_URL": "redis://redis:6379/0",
    "JWT_SECRET_KEY": values["JWT_SECRET_KEY"], "AUTH_TRUST_PROXY_HEADERS": "false",
    "AUTH_FAIL_CLOSED_ON_REDIS": "true",
})
save_missing("API-Gateaway/.env.prod", {
    **{name + "_SERVICE_URL": f"http://{host}:{port}" for name, host, port in
       [("AUTH", "auth", 8001), ("CATALOG", "catalog", 8002), ("FILE", "filestorage", 8003),
        ("SEARCH", "search", 8004), ("NOTIFY", "notifications", 8006), ("REVIEW", "reviews", 8007),
        ("FAVOURITES", "favourites", 8008), ("AI", "ai", 8010), ("ANALYTICS", "analytics", 8011)]},
    "LIBTAU_INTEGRATE_SERVICE": "http://otherlibraryintegrations:8009",
    "JWT_SECRET": values["JWT_SECRET_KEY"], "INTERNAL_API_TOKEN": values["INTERNAL_API_TOKEN"],
    "ANALYTICS_IP_HASH_SECRET": values["INTERNAL_API_TOKEN"], "ANALYTICS_CAPTURE_BODY": "false",
    "CORS_ALLOW_ORIGINS": "[]",
})
save_missing("CatalogService/.env.prod", {
    "DATABASE_URL": db("catalog_db"), "AUTH_SERVICE_URL": "http://auth:8001",
    "FILE_SERVICE_URL": "http://filestorage:8003/files/upload", "MEDIA_ROOT": "/app/storage",
    "SEARCH_SERVICE_URL": "http://search:8004", "SEARCH_ADMIN_TOKEN": values["SEARCH_ADMIN_TOKEN"],
})
save_missing("FileStorageService/.env.prod", {"STORAGE_PATH": "/app/storage", "AUTH_SERVICE_URL": "http://auth:8001"})
for folder, database in [("reviews", "reviews_db"), ("favourites", "favourites_db"), ("NotificationService", "notifications_db")]:
    save_missing(f"{folder}/.env.prod", {"DATABASE_URL": db(database), "AUTH_SERVICE_URL": "http://auth:8001",
                                       "CATALOG_SERVICE_URL": "http://catalog:8002/catalog", "REDIS_URL": "redis://redis:6379/0"})
save_missing("SearchService/.env.prod", {"ELASTIC_URL": "http://elasticsearch:9200", "CATALOG_SERVICE_URL": "http://catalog:8002",
                                       "AUTH_SERVICE_URL": "http://auth:8001", "ADMIN_TOKEN": values["SEARCH_ADMIN_TOKEN"]})
save_missing("AnalyticsService/.env.prod", {"DATABASE_URL": db("analytics_db"), "CLICKHOUSE_URL": "http://clickhouse:8123",
                                          "AUTH_SERVICE_URL": "http://auth:8001", "INTERNAL_API_TOKEN": values["INTERNAL_API_TOKEN"],
                                          "IP_HASH_SECRET": values["INTERNAL_API_TOKEN"]})
save_missing("OtherLibraryIntegrations/.env.prod", {"DATABASE_URL": db("integrations_db"), "AUTH_SERVICE_URL": "http://auth:8001",
                                                   "CATALOG_SERVICE_URL": "http://catalog:8002/catalog", "REDIS_URL": "redis://redis:6379/0",
                                                   "LIB_TAU_SCHEME": "https", "LIB_TAU_USER": "", "LIB_TAU_PASSWORD": "",
                                                   "DOWNLOAD_ALLOWED_HOSTS": ""})
save_missing("AI/.env", {"AUTH_SERVICE_URL": "http://auth:8001", "AI_CHAT_CARD_URL": ""})
print("External integration credentials, trusted download hosts and the HTTPS AI endpoint must be configured separately.")
