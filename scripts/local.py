"""Start the Windows development subset. See LOCAL_RUN.md for limitations."""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
import urllib.request

import psutil

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local'
STATE = LOCAL / 'processes.json'
PYTHON = LOCAL / 'venv/Scripts/python.exe'


def read_state():
    return json.loads(STATE.read_text()) if STATE.exists() else {}


def process_for(record):
    try:
        p = psutil.Process(record['pid'])
        return p if abs(p.create_time() - record['created']) < 0.01 else None
    except psutil.Error:
        return None


def available(port):
    with socket.socket() as s:
        return s.connect_ex(('127.0.0.1', port)) != 0


def start():
    state = read_state()
    if any(process_for(v) for v in state.values()):
        raise SystemExit('Local processes already exist. Use status or stop first.')
    ports = [6379, 8000, 8001, 8002, 8003, 8006, 8007, 8008, 5173]
    for port in ports:
        if not available(port):
            raise SystemExit(f'Port {port} is occupied; existing processes were left untouched.')
    for folder in ['data', 'logs', 'storage']:
        (LOCAL / folder).mkdir(parents=True, exist_ok=True)
    secret_file = LOCAL / 'secrets.json'
    if not secret_file.exists():
        secret_file.write_text(json.dumps({'jwt': secrets.token_urlsafe(48)}))
    secrets_data = json.loads(secret_file.read_text())
    secrets_data.setdefault('internal', secrets.token_urlsafe(48))
    secret_file.write_text(json.dumps(secrets_data))
    secret = secrets_data['jwt']
    common = os.environ.copy()
    common.update({
        'JWT_SECRET_KEY': secret, 'JWT_SECRET': secret,
        'INTERNAL_API_TOKEN': secrets_data['internal'],
        'ANALYTICS_IP_HASH_SECRET': secrets_data['internal'],
        'SEARCH_ADMIN_TOKEN': secrets_data['internal'],
        'AUTH_SERVICE_URL': 'http://127.0.0.1:8001',
        'CATALOG_SERVICE_URL': 'http://127.0.0.1:8002',
        'FILE_SERVICE_URL': 'http://127.0.0.1:8003',
        'NOTIFY_SERVICE_URL': 'http://127.0.0.1:8006',
        'REVIEW_SERVICE_URL': 'http://127.0.0.1:8007',
        'FAVOURITES_SERVICE_URL': 'http://127.0.0.1:8008',
        'REDIS_URL': 'redis://127.0.0.1:6379/0',
        'AUTH_TRUST_PROXY_HEADERS': 'false',
        'AUTH_FAIL_CLOSED_ON_REDIS': 'true',
        'ANALYTICS_ENABLED': 'false', 'LOG_LEVEL': 'INFO',
        'CORS_ALLOW_ORIGINS': '["http://127.0.0.1:5173","http://localhost:5173"]',
        'STORAGE_PATH': str(LOCAL / 'storage'), 'MEDIA_ROOT': str(LOCAL / 'storage'),
        'DOTNET_ROOT': str(LOCAL / 'tools/dotnet'),
        'PYTHONUNBUFFERED': '1', 'NO_COLOR': '1',
    })

    def launch(name, command, cwd, env):
        with (LOCAL / f'logs/{name}.log').open('ab') as log:
            p = subprocess.Popen(command, cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                 stdout=log, stderr=subprocess.STDOUT,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        state[name] = {'pid': p.pid, 'created': psutil.Process(p.pid).create_time()}
        STATE.write_text(json.dumps(state, indent=2))

    try:
        launch('redis', [str(LOCAL / 'tools/garnet/net10.0/GarnetServer.exe'),
                        '--bind', '127.0.0.1', '--port', '6379', '--memory', '64m',
                        '--page', '4m', '--segment', '64m', '--index', '8m'], LOCAL / 'data', common)
        for name, folder, port in [('auth', 'AuthService', 8001), ('catalog', 'CatalogService', 8002),
                                   ('filestorage', 'FileStorageService', 8003),
                                   ('notifications', 'NotificationService', 8006),
                                   ('reviews', 'reviews', 8007), ('favourites', 'favourites', 8008),
                                   ('gateway', 'API-Gateaway', 8000)]:
            env = common.copy()
            env['DATABASE_URL'] = 'sqlite:///' + (LOCAL / f'data/{name}.db').as_posix()
            if name == 'catalog':
                env['AUTH_SERVICE_URL'] += '/'
                env['FILE_SERVICE_URL'] += '/files/upload'
            if name == 'notifications':
                env['AUTH_SERVICE_URL'] += '/'
            if name in ('favourites', 'reviews'):
                env['AUTH_SERVICE_URL'] += '/auth'
                env['CATALOG_SERVICE_URL'] += '/catalog'
            launch(name, [str(PYTHON), '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                          '--port', str(port), '--no-proxy-headers'], ROOT / folder, env)
        node = os.environ.get('ELIB_NODE') or __import__('shutil').which('node')
        if not node:
            raise RuntimeError('Node.js was not found. Set ELIB_NODE to its absolute path.')
        launch('frontend', [node, str(ROOT / 'Frontend/tau-login/node_modules/vite/bin/vite.js'),
                            '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
               ROOT / 'Frontend/tau-login', common)
        for port in [8000, 8001, 8002, 8003, 8006, 8007, 8008, 5173]:
            deadline = time.monotonic() + 45
            while True:
                dead = [name for name, rec in state.items() if not process_for(rec)]
                if dead:
                    raise RuntimeError(f'Processes failed: {dead}; inspect .local/logs')
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/' +
                                                ('openapi.json' if port != 5173 else ''), timeout=2) as response:
                        assert response.status == 200
                    break
                except Exception:
                    if time.monotonic() >= deadline:
                        raise RuntimeError(f'Port {port} did not become ready; inspect .local/logs')
                    time.sleep(0.5)
        print('Started: http://127.0.0.1:5173 | API: http://127.0.0.1:8000/docs')
    except Exception:
        stop()
        raise


def stop():
    for name, record in reversed(list(read_state().items())):
        p = process_for(record)
        if p:
            children = p.children(recursive=True)
            for child in children:
                try:
                    child.terminate()
                except psutil.Error:
                    pass
            try:
                p.terminate()
                psutil.wait_procs([p, *children], timeout=5)
            except psutil.Error:
                pass
            print(f'Stopped {name}')
    STATE.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'stop', 'status'])
    action = parser.parse_args().action
    if action == 'start':
        start()
    elif action == 'stop':
        stop()
    else:
        for name, record in read_state().items():
            print(f'{name}: {"running" if process_for(record) else "stopped"} (PID {record["pid"]})')
