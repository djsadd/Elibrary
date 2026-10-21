def test_profile_tokens_account_state_and_otp(probe):
    probe("AuthService", '''
        import fakeredis
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.db import SessionLocal
        from app.models.user import User
        from app.utils import tokens
        from app.utils.security import hash_password
        from app.services import security_controls, twofa, challenge_store, platonus_email_change
        fake = fakeredis.FakeRedis(decode_responses=True)
        for module in (tokens, security_controls, twofa, challenge_store, platonus_email_change):
            module.r = fake
        with SessionLocal() as db:
            db.add_all([User(id=1, email="student@example.com", hashed_password=hash_password("good-password"),
                             role="student", is_active=True),
                        User(id=2, email="admin@example.com", hashed_password=hash_password("good-password"),
                             role="admin", is_active=True)])
            db.commit()
        c = TestClient(app)
        token = tokens.create_access(1, "student")[0]
        h = {"Authorization": "Bearer " + token}
        for field in ("role", "permissions", "subscription_type", "google_id", "github_id", "iin"):
            assert c.put("/auth/profile", headers=h, json={field: "admin"}).status_code == 422, field
        assert c.put("/auth/profile", headers=h, json={"first_name": "Test"}).status_code == 200
        assert c.get("/auth/admin/stats", headers=h).status_code == 403
        # No trust in stale or forged role claims, even when correctly signed.
        elevated = tokens.create_access(1, "admin")[0]
        assert c.get("/auth/admin/stats", headers={"Authorization": "Bearer " + elevated}).status_code == 403
        refresh = tokens.create_refresh(1)[0]
        assert c.get("/auth/profile", headers={"Authorization": "Bearer " + refresh}).status_code == 401
        assert c.post("/auth/introspect_any", json={"token": refresh}).json()["active"] is False
        r = c.post("/auth/refresh", json={"token": refresh})
        assert r.status_code == 200, r.text
        assert c.post("/auth/refresh", json={"token": refresh}).status_code == 401
        with SessionLocal() as db:
            u = db.get(User, 1); u.is_active = False; db.commit()
        assert c.get("/auth/profile", headers=h).status_code == 401
        assert c.post("/auth/introspect", json={"token": token}).json()["active"] is False
        assert c.post("/auth/refresh", json={"token": r.json()["refresh_token"]}).status_code == 401
        active_admin = tokens.create_access(2,"admin")[0]
        admin_headers = {"Authorization":"Bearer "+active_admin}
        assert c.patch("/auth/users/1/access", headers=h, json={"role":"admin"}).status_code == 401
        assert c.patch("/auth/users/1/access", headers=admin_headers, json={"role":"teacher"}).status_code == 200
        assert c.post("/auth/login", json={"email":"student@example.com","password":"good-password"}).status_code == 403
        assert c.post("/auth/verify", json={"email":"student@example.com","code":"123456"}).status_code == 410
        logout_refresh = tokens.create_refresh(2)[0]
        assert c.post("/auth/logout", headers=admin_headers, json={"token":logout_refresh}).status_code == 204
        assert c.get("/auth/profile", headers=admin_headers).status_code == 401
        assert c.post("/auth/refresh",json={"token":logout_refresh}).status_code == 401
        # An empty activation code cannot authenticate an already active account.
        assert c.post("/auth/verify", json={"email":"admin@example.com","code":""}).status_code == 422
        import jwt, time
        from app.core.config import settings
        claims = {"sub":"2", "typ":"access", "iat":int(time.time())-60, "exp":int(time.time())-1,
                  "jti":"expired-test", "ver":"0", "iss":"elibrary-auth", "aud":"elibrary"}
        expired = jwt.encode(claims, settings.JWT_SECRET_KEY, algorithm="HS256")
        assert c.post("/auth/introspect_any", json={"token":expired}).json()["active"] is False
        # Concurrent submissions of the same OTP must produce only one success.
        from concurrent.futures import ThreadPoolExecutor
        cid, code, ttl = twofa.create_challenge(user_id=2)
        def verify(_):
            try: return twofa.verify_code(challenge_id=cid, code=code)
            except ValueError: return None
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(verify, range(4)))
        assert results.count(2) == 1, results
        cid, ttl = platonus_email_change.create_challenge(payload={"iin":"test"})
        code, ttl = platonus_email_change.request_code(challenge_id=cid, email="a@example.com")
        for _ in range(settings.TWOFA_MAX_ATTEMPTS):
            try: platonus_email_change.verify_code(challenge_id=cid, email="a@example.com", code="invalid")
            except ValueError: pass
        try:
            platonus_email_change.verify_code(challenge_id=cid, email="a@example.com", code=code)
            raise AssertionError("Attempt budget bypass")
        except ValueError: pass
    ''')


def test_default_jwt_secret_rejected(probe):
    probe("AuthService", '''
        try:
            from app.core.config import settings
            raise AssertionError("Weak key accepted")
        except ValueError:
            pass
    ''', {"JWT_SECRET_KEY": "CHANGE_ME"})
