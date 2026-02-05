import logging
import sys
from app.core.config import settings
from pythonjsonlogger import jsonlogger


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())
    root.handlers = [handler]
    root.propagate = False

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        l = logging.getLogger(logger_name)
        l.handlers = [handler]
        l.setLevel(settings.LOG_LEVEL.upper())
        l.propagate = False
