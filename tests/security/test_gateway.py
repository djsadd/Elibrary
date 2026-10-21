def test_gateway_tokens_roles_proxy_and_body_limits(probe):
    probe("API-Gateaway", '''
        import asyncio
        import httpx
        from fastapi import HTTPException
        from fastapi.testclient import TestClient
        from starlette.requests import Request
        from app.main import app
        from app.services import auth_guard, proxy
        from app.schemas.auth import IntrospectResponse
        from app.core.config import settings
        settings.RATE_LIMIT_BURST = 100
        async def introspect(token):
            if token == "unavailable": raise HTTPException(503, "Unavailable")
            if token not in {"admin", "student"}: return IntrospectResponse(active=False)
            return IntrospectResponse(active=True,user_id=1,roles=[token])
        auth_guard.introspect = introspect
        calls=[]
        async def upstream(request):
            body=await request.aread()
            calls.append((request,body))
            if request.url.path.endswith("fail"):
                raise httpx.ReadTimeout("simulated",request=request)
            return httpx.Response(200, headers={"content-type":"application/json"},
                                  stream=httpx.ByteStream(b'{"ok":true}'))
        proxy._CLIENT = httpx.AsyncClient(transport=httpx.MockTransport(upstream))
        c=TestClient(app)
        for token in ("refresh", "expired", "invalid"):
            r=c.get("/api/favourites", headers={"Authorization":"Bearer "+token})
            assert r.status_code == 401, r.text
        assert c.get("/api/favourites",headers={"Authorization":"Bearer unavailable"}).status_code == 503
        h={"Authorization":"Bearer student"}
        assert c.get("/api/analytics/stats/summary",headers=h).status_code == 403
        assert c.get("/api/libtau/books",headers=h).status_code == 403
        assert c.post("/api/ai/chat_card",json={}).status_code == 401
        r=c.get("/api/favourites",headers={**h,"X-Service-Token":"spoof","X-Admin-Token":"spoof",
                                         "X-User-ID":"999","X-User-Roles":"admin"})
        assert r.status_code == 200, r.text
        forwarded=calls[-1][0].headers
        assert "x-service-token" not in forwarded and "x-admin-token" not in forwarded
        assert forwarded["x-user-id"] == "1" and forwarded["x-user-roles"] == "student"
        before=len(calls)
        assert c.post("/api/catalog/fail",json={}).status_code == 502
        assert len(calls) == before+1
        assert c.post("/api/auth/login",content=b"x"*(2*1024*1024+1)).status_code == 413
        # Varying attacker-controlled bearer tokens must share the same IP bucket.
        from app.utils.rate_limit import RateLimitMiddleware
        limiter=RateLimitMiddleware(lambda *args:None)
        scope={"type":"http","client":("10.0.0.1",1234),"headers":[(b"authorization",b"one")]}
        first=limiter._key(Request(scope))
        scope["headers"]=[(b"authorization",b"two")]
        assert limiter._key(Request(scope)) == first
    ''')


def test_request_size_without_content_length(probe):
    probe("API-Gateaway", '''
        import asyncio, os
        from app.utils.request_limits import RequestLimitsMiddleware
        os.environ["MAX_REQUEST_MB"]="1"
        touched=[];messages=[]
        async def downstream(scope,receive,send): touched.append(True)
        stream=iter([{"type":"http.request","body":b"x"*700000,"more_body":True},
                     {"type":"http.request","body":b"x"*700000,"more_body":False}])
        async def receive(): return next(stream)
        async def send(message): messages.append(message)
        asyncio.run(RequestLimitsMiddleware(downstream)({"type":"http","path":"/api/auth/login","headers":[]},receive,send))
        assert messages[0]["status"] == 413 and not touched
    ''')
