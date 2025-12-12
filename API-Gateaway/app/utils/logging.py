import logging
import sys
from app.core.config import settings


def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    fmt = "[%(asctime)s] [%(levelname)s] %(name)s: %(message)s"
    handler.setFormatter(logging.Formatter(fmt))
    root = logging.getLogger()
    root.setLevel(settings.LOG_LEVEL.upper())
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        root.addHandler(handler)
