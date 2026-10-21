"""Recovery runs only against temporary SQLite and fake Redis/mail transports."""

BOOTSTRAP = '''
import json, time
import fakeredis
from fastapi.testclient import TestClient
from app.main import app
from app.core.db import SessionLocal
from app.core.config import settings
from app.models.user import User
from app.utils import tokens
from app.utils.security import hash_password, verify_password
from app.services import security_controls, challenge_store, password_reset, email_sender, twofa
fake = fakeredis.FakeRedis(decode_responses=True)
for module in (tokens, security_controls, challenge_store, password_reset, twofa):
    module.r = fake
old_password = "Old-Strong-Password123!"
with SessionLocal() as db:
    db.add_all([
        User(id=1, email="local@example.com", hashed_password=hash_password(old_password),
             is_active=True, email_verified=True, role="student"),
        User(id=2, email="platonus@example.com", hashed_password=hash_password(old_password),
             is_active=True, email_verified=True, iin="123456789012", role="student"),
        User(id=3, email="disabled@example.com", hashed_password=hash_password(old_password),
             is_active=False, email_verified=True, role="student"),
        User(id=4, email="unverified@example.com", hashed_password=hash_password(old_password),
             is_active=True, email_verified=False, role="student"),
    ])
    db.commit()
mail = []
email_sender.ensure_email_delivery_available = lambda: None
email_sender.send_password_reset_code_email = lambda **kw: mail.append(kw)
c = TestClient(app)
def request(email="local@example.com"):
    return c.post("/auth/password-reset/request", json={"email": email})
def confirm(email, code, password="New-Strong-Password456!"):
    return c.post("/auth/password-reset/confirm", json={"email":email,"code":code,"new_password":password})
'''


def test_recovery_changes_full_password_and_revokes_sessions(probe):
    probe("AuthService", BOOTSTRAP + '''
access = tokens.create_access(1, "student")[0]
refresh = tokens.create_refresh(1)[0]
pending_2fa, pending_code, _ = twofa.create_challenge(user_id=1)
known = request("LOCAL@example.com")
unknown = request("missing@example.com")
assert known.status_code == unknown.status_code == 202
assert known.json() == unknown.json()
assert known.headers["cache-control"] == "no-store"
assert len(mail) == 1 and set(known.json()) == {"message", "expires_in"}
code = mail[0]["code"]
state = json.loads(fake.get(password_reset._key("local@example.com")))
assert "code" not in state and state["hash"] != code and len(state["hash"]) == 64
assert fake.ttl(password_reset._key("local@example.com")) <= 600
# Strong-password errors cannot consume an otherwise valid challenge.
for weak in ("shortA1!", "lowercaseonly123!", "UPPERCASEONLY123!", "NoDigitsInPassword!", "NoSymbolPassword123"):
    assert confirm("local@example.com", code, weak).status_code == 422
# The whole Unicode password must be hashed: no bcrypt 72-byte truncation.
new_password = "Ж" * 80 + "Strong-Password456!"
r = confirm("local@example.com", code, new_password)
assert r.status_code == 200, r.text
assert "token" not in r.text and r.headers["cache-control"] == "no-store"
assert confirm("local@example.com", code, new_password).status_code == 400
with SessionLocal() as db:
    u = db.get(User, 1)
    assert u.hashed_password.startswith("$argon2id$")
    assert verify_password(new_password, u.hashed_password)
    assert not verify_password(new_password[:-1] + "?", u.hashed_password)
    assert not verify_password(old_password, u.hashed_password)
assert c.get("/auth/profile", headers={"Authorization":"Bearer " + access}).status_code == 401
assert c.post("/auth/introspect", json={"token":access}).json()["active"] is False
assert c.post("/auth/refresh", json={"token":refresh}).status_code == 401
try:
    twofa.verify_code(challenge_id=pending_2fa, code=pending_code)
    raise AssertionError("Pre-reset second-factor challenge survived")
except ValueError:
    pass
assert c.post("/auth/login", json={"email":"local@example.com","password":old_password}).status_code == 401
assert c.post("/auth/login", json={"email":"local@example.com","password":new_password}).status_code == 200
''')


def test_recovery_unknown_platonus_inactive_and_unverified_are_neutral(probe):
    probe("AuthService", BOOTSTRAP + '''
responses = [request(email) for email in ("missing@example.com", "platonus@example.com", "disabled@example.com", "unverified@example.com")]
assert all(r.status_code == 202 for r in responses)
assert len({r.text for r in responses}) == 1 and not mail
for email in ("missing@example.com", "platonus@example.com", "disabled@example.com", "unverified@example.com"):
    assert confirm(email, "123456").status_code == 400
    state = json.loads(fake.get(password_reset._key(email)))
    assert state["uid"] == 0
with SessionLocal() as db:
    assert db.query(User).count() == 4
    for uid in (2, 3, 4):
        u = db.get(User, uid)
        assert verify_password(old_password, u.hashed_password)
    assert not db.get(User, 3).is_active
    assert not db.get(User, 4).email_verified
''')


def test_recovery_expiry_attempt_budget_replacement_and_atomic_reuse(probe):
    probe("AuthService", BOOTSTRAP + '''
assert request().status_code == 202
code = mail[-1]["code"]
key = password_reset._key("local@example.com")
state = json.loads(fake.get(key)); state["exp"] = int(time.time()) - 1
fake.setex(key, 60, json.dumps(state))
assert confirm("local@example.com", code).status_code == 400
fake.flushall()
assert request().status_code == 202
code = mail[-1]["code"]
settings.PASSWORD_RESET_MAX_ATTEMPTS = 2
wrong = "000000" if code != "000000" else "111111"
assert confirm("local@example.com", wrong).status_code == 400
assert confirm("local@example.com", wrong).status_code == 400
assert not fake.exists(key)
assert confirm("local@example.com", code).status_code == 400
fake.flushall()
assert request().status_code == 202
first_state = fake.get(key)
for k in fake.scan_iter("password-reset:limit:request:cooldown:*"): fake.delete(k)
assert request().status_code == 202
assert fake.get(key) != first_state
code = mail[-1]["code"]
# Exactly one worker may consume the code, even when submitted concurrently.
from concurrent.futures import ThreadPoolExecutor
def consume(_):
    try: return password_reset.consume_challenge(email="local@example.com", code=code)["uid"]
    except ValueError: return None
with ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(consume, range(6)))
assert results.count(1) == 1, results
''')


def test_recovery_rate_limits_apply_equally_to_known_and_unknown(probe):
    probe("AuthService", BOOTSTRAP + '''
settings.PASSWORD_RESET_REQUEST_EMAIL_LIMIT = 2
settings.PASSWORD_RESET_REQUEST_IP_LIMIT = 100
for email in ("local@example.com", "missing@example.com"):
    for _ in range(2):
        for key in fake.scan_iter("password-reset:limit:request:cooldown:*"): fake.delete(key)
        assert request(email).status_code == 202
    r = request(email)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0
fake.flushall()
assert request().status_code == 202
assert request().status_code == 429  # Per-address resend cooldown.
fake.flushall()
settings.PASSWORD_RESET_REQUEST_IP_LIMIT = 2
assert request().status_code == 202
assert request("missing@example.com").status_code == 202
assert request("another@example.com").status_code == 429  # Varying addresses shares an IP budget.
fake.flushall()
settings.PASSWORD_RESET_CONFIRM_EMAIL_LIMIT = 2
settings.PASSWORD_RESET_CONFIRM_IP_LIMIT = 100
for email in ("local@example.com", "missing@example.com"):
    assert confirm(email, "123456").status_code == 400
    assert confirm(email, "123456").status_code == 400
    assert confirm(email, "123456").status_code == 429
''')


def test_recovery_mail_failure_and_redis_failure_do_not_claim_delivery(probe):
    probe("AuthService", BOOTSTRAP + '''
from redis.exceptions import ConnectionError
# Real configuration guard, with no live network access or credentials.
from app.services.email_sender import _smtp_connection
def unavailable():
    with _smtp_connection(): pass
settings.SMTP_HOST = None
email_sender.ensure_email_delivery_available = unavailable
for email in ("local@example.com", "missing@example.com"):
    r = request(email)
    assert r.status_code == 503 and "code" not in r.text
assert not mail and not list(fake.scan_iter("password-reset:challenge:*"))
fake.flushall()
email_sender.ensure_email_delivery_available = lambda: None
def recipient_failure(**kw): raise RuntimeError("simulated recipient rejection")
email_sender.send_password_reset_code_email = recipient_failure
known, unknown = request(), request("missing@example.com")
assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
assert not fake.exists(password_reset._key("local@example.com"))
# Security state failures always close recovery, even when login allows fail-open.
settings.AUTH_FAIL_CLOSED_ON_REDIS = False
class BrokenRedis:
    def pipeline(self): raise ConnectionError("simulated")
    def incr(self, key): raise ConnectionError("simulated")
password_reset.r = BrokenRedis()
assert request("new@example.com").status_code == 503
assert confirm("new@example.com", "123456").status_code == 503
# A reset cannot commit unless existing sessions were invalidated.
password_reset.r = fake
fake.flushall()
email_sender.send_password_reset_code_email = lambda **kw: mail.append(kw)
assert request().status_code == 202
tokens.r = BrokenRedis()
assert confirm("local@example.com", mail[-1]["code"]).status_code == 503
with SessionLocal() as db:
    assert verify_password(old_password, db.get(User, 1).hashed_password)
''')


def test_gateway_forwards_public_recovery_contract_and_error_headers(probe):
    probe("API-Gateaway", '''
import json, httpx
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services import proxy
settings.RATE_LIMIT_BURST = 100
calls = []
status = [202]
async def upstream(request):
    calls.append((request.url.path, json.loads(await request.aread()), request.headers))
    data = {"message":"If eligible, you will receive a code.","expires_in":600}
    if status[0] == 429: data = {"detail":"Too many requests"}
    if status[0] == 503: data = {"detail":"Password recovery email service unavailable"}
    return httpx.Response(status[0], headers={"content-type":"application/json","cache-control":"no-store","retry-after":"60"},
                          stream=httpx.ByteStream(json.dumps(data).encode()))
proxy._CLIENT = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
c = TestClient(app)
for code in (202, 429, 503):
    status[0] = code
    r = c.post("/api/auth/password-reset/request", json={"email":"missing@example.com"})
    assert r.status_code == code and r.headers["cache-control"] == "no-store"
    assert calls[-1][0] == "/auth/password-reset/request"
    assert calls[-1][1] == {"email":"missing@example.com"}
    if code == 429: assert r.headers["retry-after"] == "60"
status[0] = 200
body = {"email":"local@example.com","code":"123456","new_password":"New-Strong-Password123!"}
assert c.post("/api/auth/password-reset/confirm", json=body).status_code == 200
assert calls[-1][0] == "/auth/password-reset/confirm" and calls[-1][1] == body
''')


def test_recovery_smtp_delivery_uses_verified_tls(probe):
    probe("AuthService", '''
import ssl
from app.core.config import settings
from app.services import email_sender
settings.SMTP_HOST = "smtp.invalid"
settings.SMTP_FROM = "library@example.com"
settings.SMTP_USER = "test-user"
settings.SMTP_PASSWORD = "test-only-credential"
settings.SMTP_USE_TLS = True
contexts, messages = [], []
refused = [False]
class SMTP:
    def __init__(self, **kwargs):
        if "context" in kwargs: contexts.append(kwargs["context"])
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def ehlo(self): pass
    def starttls(self, *, context): contexts.append(context)
    def login(self, username, password):
        assert username == settings.SMTP_USER and password == settings.SMTP_PASSWORD
    def noop(self): return 250, b"OK"
    def send_message(self, message):
        messages.append(message)
        return {"local@example.com": (550, b"Rejected")} if refused[0] else {}
email_sender.smtplib.SMTP = SMTP
email_sender.smtplib.SMTP_SSL = SMTP
for use_ssl in (False, True):
    settings.SMTP_USE_SSL = use_ssl
    email_sender.ensure_email_delivery_available()
    email_sender.send_password_reset_code_email(to_email="local@example.com", code="123456", ttl_seconds=600)
assert len(messages) == 2 and all("123456" in message.get_content() for message in messages)
assert all(ctx.check_hostname and ctx.verify_mode == ssl.CERT_REQUIRED for ctx in contexts)
refused[0] = True
try:
    email_sender.send_password_reset_code_email(to_email="local@example.com", code="123456", ttl_seconds=600)
    raise AssertionError("Rejected recipient claimed as a successful delivery")
except RuntimeError:
    pass
''')


def test_recovery_cannot_refresh_an_identity_verified_before_reset(probe):
    probe("AuthService", BOOTSTRAP + '''
from app.api import routes
assert request().status_code == 202
code = mail[-1]["code"]
refresh = tokens.create_refresh(1)[0]
original_create_access = routes.create_access
def reset_before_issue(*args, **kwargs):
    assert confirm("local@example.com", code).status_code == 200
    return original_create_access(*args, **kwargs)
routes.create_access = reset_before_issue
# Refresh validation happens before the reset; the issuer must retain its old version.
assert c.post("/auth/refresh", json={"token":refresh}).status_code == 401
''')


def test_recovery_cannot_mint_a_valid_session_from_old_password_verification(probe):
    probe("AuthService", BOOTSTRAP + '''
from app.api import routes
assert request().status_code == 202
code = mail[-1]["code"]
original_create_access = routes.create_access
def reset_before_issue(*args, **kwargs):
    assert confirm("local@example.com", code).status_code == 200
    return original_create_access(*args, **kwargs)
routes.create_access = reset_before_issue
response = c.post("/auth/login", json={"email":"local@example.com","password":old_password})
# A request that verified the previous hash cannot acquire access after the reset.
assert response.status_code in (200, 401)
if response.status_code == 200:
    pair = response.json()
    assert c.get("/auth/profile", headers={"Authorization":"Bearer " + pair["access_token"]}).status_code == 401
    assert c.post("/auth/refresh", json={"token":pair["refresh_token"]}).status_code == 401
''')
