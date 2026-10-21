import os
from pathlib import Path
import subprocess
import sys
import textwrap

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def probe(tmp_path):
    def run(service, source, extra_env=None):
        env = os.environ.copy()
        env.update({
            "DATABASE_URL": "sqlite:///" + (tmp_path / (service + ".db")).as_posix(),
            "JWT_SECRET_KEY": "test-only-random-key-" + "a" * 48,
            "JWT_SECRET": "test-only-random-key-" + "a" * 48,
            "INTERNAL_API_TOKEN": "test-only-internal-" + "b" * 48,
            "AUTH_SERVICE_URL": "http://auth.invalid:8001",
            "MEDIA_ROOT": str(tmp_path / "storage"),
            "STORAGE_PATH": str(tmp_path / "storage"),
            "CORS_ALLOW_ORIGINS": "[]", "ANALYTICS_ENABLED": "false",
            "INIT_INDEX_ON_START": "false", "REINDEX_ON_START": "false",
            "CLICKHOUSE_ENABLED": "false", "AUTH_STEPUP_ON_NEW_IP": "false",
            "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1",
        })
        if extra_env:
            env.update(extra_env)
        result = subprocess.run([sys.executable, "-c", textwrap.dedent(source)],
                                cwd=ROOT / service, env=env, capture_output=True,
                                text=True, encoding="utf-8", timeout=90)
        assert result.returncode == 0, result.stdout[-4000:] + "\n" + result.stderr[-8000:]
        return result.stdout
    return run
