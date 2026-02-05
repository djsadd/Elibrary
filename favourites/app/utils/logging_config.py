import logging
import os
import sys

from pythonjsonlogger import jsonlogger


def setup_logging() -> None:
    level = os.getenv("LOG_LEVEL", "INFO").upper()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    root.propagate = False

    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        l = logging.getLogger(logger_name)
        l.handlers = [handler]
        l.setLevel(level)
        l.propagate = False
