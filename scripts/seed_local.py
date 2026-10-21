"""Create accounts only in the isolated local SQLite database."""
import json
from pathlib import Path
import secrets
import sqlite3

from argon2 import PasswordHasher

root = Path(__file__).resolve().parents[1] / '.local'
database = root / 'data/auth.db'
if not database.exists():
    raise SystemExit('Start scripts/local.py first.')
credentials_file = root / 'credentials.json'
if credentials_file.exists():
    raise SystemExit('Accounts already created. See .local/credentials.txt')
accounts = []
with sqlite3.connect(database) as db:
    for role in ('admin', 'student'):
        email = f'{role}@example.com'
        password = secrets.token_urlsafe(18)
        db.execute('INSERT INTO users (email, hashed_password, role, is_active, email_verified, twofa_enabled, first_name) '
                   'VALUES (?, ?, ?, 1, 1, 0, ?)', (email, PasswordHasher().hash(password), role, f'Local {role}'))
        accounts.append({'email': email, 'password': password, 'role': role})
credentials_file.write_text(json.dumps(accounts, indent=2), encoding='utf-8')
(root / 'credentials.txt').write_text('\n\n'.join(
    f'Role: {a["role"]}\nEmail: {a["email"]}\nPassword: {a["password"]}' for a in accounts), encoding='utf-8')
print('Local accounts created. Credentials: .local/credentials.txt')
