import requests
from app.core.logging import logger

def get_json(url: str, auth=None):
    try:
        resp = requests.get(url, auth=auth, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"HTTP GET failed: {e}")
        return None

def post_json(url: str, data: dict, auth=None):
    try:
        resp = requests.post(url, json=data, auth=auth, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        logger.error(f"HTTP POST failed: {e}")
        return None
