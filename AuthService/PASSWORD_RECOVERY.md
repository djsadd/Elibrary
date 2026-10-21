# Password recovery

The library's local email accounts can reset a password using a six-digit code. This does not reset Platonus or OAuth credentials, enable a disabled account, verify an email address or open registration.

## Configuration

Set AuthService environment variables using the deployment's secret store or private environment file:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`.
- `SMTP_USER` and `SMTP_PASSWORD` together when the mail provider requires authentication.
- `SMTP_USE_TLS=true` for STARTTLS (normally port 587), or `SMTP_USE_SSL=true` for implicit TLS (normally port 465), according to the provider. Certificate verification is enabled.
- Keep `JWT_SECRET_KEY` stable and private; Redis must be available for recovery, rate limiting and session revocation.

No SMTP credentials are supplied or fabricated by this change. The local launcher inherits its environment. Set the variables in the environment that starts AuthService and restart it after configuration. Without a configured, reachable mail transport, requests return HTTP 503 and the interface displays an unavailable message. Do not configure a public endpoint to return recovery codes.

## Contract

- `POST /api/auth/password-reset/request` with `{ "email": "reader@example.com" }`: HTTP 202, a neutral `message` and `expires_in`. The same reply is used for unknown or ineligible addresses. Transport readiness is checked for every address. Delivery runs after the reply; recipient-specific failure does not reveal account existence and invalidates the challenge.
- `POST /api/auth/password-reset/confirm` with `{ "email": "reader@example.com", "code": "123456", "new_password": "a new strong password" }`: HTTP 200 after the database commit and session invalidation. The sample code/password above are illustrative, not working credentials.
- HTTP 400 for invalid/expired codes, 422 for invalid input, 429 with `Retry-After`, 503 for unavailable security state/mail transport. Replies use `Cache-Control: no-store`.

Codes expire after 600 seconds by default, are single-use, and are stored as keyed hashes. Rate limits cover both email identities and client IPs. Resend cooldown defaults to 60 seconds. The password must contain at least 12 characters, lowercase and uppercase letters, a digit and a non-whitespace symbol; the full password is hashed with Argon2id. Previous access tokens, refresh tokens and pending login challenges are invalidated. Token issuance retains the identity/version actually verified to prevent an in-flight old login or refresh from surviving a reset.

## Verification

From the repository root:

```powershell
.local/venv/Scripts/python.exe -m pytest tests/security/test_password_recovery.py tests/security/test_auth.py -q
```

Tests use temporary databases, fake Redis and a mock mail transport. They do not change existing user passwords or send email. Delivery to a real mailbox requires the deployment's SMTP configuration and a separate authorised end-to-end check.
