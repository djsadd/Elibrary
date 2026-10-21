import pytest


@pytest.mark.parametrize("service,module", [
    ("CatalogService", "app.utils.authz"),
    ("FileStorageService", "app.utils.authz"),
    ("reviews", "app.utils.authz"),
    ("favourites", "app.utils.authz"),
    ("NotificationService", "app.utils.authz"),
    ("OtherLibraryIntegrations", "app.utils.authz"),
    ("SearchService", "app.utils.authz"),
    ("AI", "app.utils.authz"),
    ("AnalyticsService", "utils.authz"),
    ("PlatonusAuth", "security"),
])
def test_introspection_fails_closed_without_stale_cache(probe, service, module):
    probe(service, f'''
        import asyncio, importlib, httpx
        from fastapi import HTTPException
        from starlette.requests import Request
        adapter=importlib.import_module({module!r})
        real_client=httpx.AsyncClient
        state={{"mode":"valid"}}
        def answer(request):
            if state["mode"]=="error": return httpx.Response(500,json={{}})
            if state["mode"]=="invalid": return httpx.Response(200,json={{"active":False}})
            return httpx.Response(200,json={{"active":True,"user_id":1,"roles":["student"]}})
        adapter.httpx.AsyncClient=lambda **kwargs:real_client(transport=httpx.MockTransport(answer))
        request=Request({{"type":"http","headers":[(b"authorization",b"Bearer test-sentinel-token")]}})
        assert asyncio.run(adapter.get_current_user(request)).user_id==1
        for mode,expected in [("error",503),("invalid",401)]:
            state["mode"]=mode
            try:
                asyncio.run(adapter.get_current_user(request))
                raise AssertionError("Authentication failed open")
            except HTTPException as e: assert e.status_code==expected
    ''')


def test_filestorage_staff_upload_limits_and_traversal(probe):
    probe("FileStorageService", '''
        import os
        from pathlib import Path
        from fastapi import Request, HTTPException
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.config import settings
        from app.utils.authz import get_current_user, AuthUser
        from app.services.file_service import get_file
        async def identity(request: Request):
            role=request.headers.get("authorization","")
            if not role: raise HTTPException(401,"Unauthorized")
            return AuthUser(user_id=1,roles=[role])
        app.dependency_overrides[get_current_user]=identity
        c=TestClient(app);admin={"Authorization":"admin"};student={"Authorization":"student"}
        f={"file":("../../outside.pdf",b"safe","application/pdf")}
        assert c.post("/files/upload",headers=student,files=f).status_code==403
        r=c.post("/files/upload",headers=admin,files=f)
        assert r.status_code==200,r.text
        metadata=r.json()["file"]
        assert "path" not in metadata and ".." not in metadata["stored_as"]
        path="/files"+metadata["uploaded_to"]
        assert c.get(path,headers=student).status_code==403
        assert c.get(path,headers=admin).content==b"safe"
        settings.MAX_UPLOAD_MB=1
        files_before=set(Path(settings.STORAGE_PATH).rglob("*.pdf"))
        r=c.post("/files/upload",headers=admin,files={"file":("big.pdf",b"x"*(1024*1024+1),"application/pdf")})
        assert r.status_code==413,r.text
        assert set(Path(settings.STORAGE_PATH).rglob("*.pdf"))==files_before
        for year,month,name in [("..","..","secret"),("2026","10","../secret"),("2026","10","C:secret")]:
            try: get_file(year,month,name);raise AssertionError("Unsafe path accepted")
            except FileNotFoundError: pass
    ''')


def test_personal_notes_and_shelves_have_ownership_checks(probe):
    probe("CatalogService", '''
        from fastapi import Request
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.db import SessionLocal
        from app.models.book import Book,UserBook,UserBookNote
        from app.utils.authz import get_current_user,AuthUser
        async def student(request:Request):return AuthUser(user_id=1,roles=["student"])
        app.dependency_overrides[get_current_user]=student
        with SessionLocal() as db:
            db.add(Book(id=1,title="Book",is_public=True))
            db.add(UserBook(id=1,user_id=2,book_id=1))
            db.add(UserBookNote(id=1,user_id=2,book_id=1,note="private-note"))
            db.commit()
        c=TestClient(app)
        assert c.patch("/catalog/notes/1",json={"note":"changed"}).status_code==404
        assert c.patch("/catalog/userbook/1",json={"current_page":9}).status_code==404
        assert c.get("/catalog/notes").json()==[]
        assert c.get("/catalog/userbook").json()==[]
    ''')


def test_cms_rejects_active_url_schemes(probe):
    probe("CatalogService", '''
        from pydantic import ValidationError
        from app.schemas.content import MenuItemCreate,PageBlockCreate
        from app.utils.html_sanitizer import sanitize_html
        for value in ("javascript:alert(1)","data:text/html,<script>alert(1)</script>","java\\tscript:alert(1)"):
            try:MenuItemCreate(title="test",slug="test",external_url=value);raise AssertionError(value)
            except ValidationError:pass
        html=sanitize_html('<a href="javascript:alert(1)">test</a><img src="x" onerror="alert(1)"><script>alert(1)</script>')
        assert 'javascript:' not in html and 'onerror' not in html and '<script>' not in html
    ''')


def test_review_ownership(probe):
    probe("reviews", '''
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.db import SessionLocal
        from app.models.review import Review
        from app.utils.authz import get_current_user,AuthUser
        async def student():return AuthUser(user_id=1,roles=["student"])
        app.dependency_overrides[get_current_user]=student
        with SessionLocal() as db:
            db.add(Review(id=1,user_id=2,book_id=1,rating=4,comment="another-user"));db.commit()
        c=TestClient(app)
        assert c.patch("/reviews/1",json={"rating":1,"comment":"changed"}).status_code==403
        assert c.delete("/reviews/1").status_code==403
    ''')


def test_notification_ownership_and_send_roles(probe):
    probe("NotificationService", '''
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.db import SessionLocal,Base,engine
        from app.models.notification import Notification
        from app.utils.authz import get_current_user,AuthUser
        Base.metadata.create_all(engine)
        async def student():return AuthUser(user_id=1,roles=["student"])
        app.dependency_overrides[get_current_user]=student
        with SessionLocal() as db:
            db.add(Notification(id=1,user_id=2,type="email",message="private"));db.commit()
        c=TestClient(app)
        assert c.get("/notification/1").status_code==404
        assert c.get("/notification/").json()==[]
        assert c.post("/notification/",json={"type":"email","message":"spam"}).status_code==403
    ''')


def test_favourite_ownership(probe):
    probe("favourites", '''
        from fastapi.testclient import TestClient
        from app.main import app
        from app.core.db import SessionLocal
        from app.models.favourite import Favourite
        from app.utils.authz import get_current_user,AuthUser
        async def student():return AuthUser(user_id=1,roles=["student"])
        app.dependency_overrides[get_current_user]=student
        with SessionLocal() as db:
            db.add(Favourite(user_id=2,book_id=1));db.commit()
        c=TestClient(app)
        assert c.delete("/favourites/1").status_code==404
        assert c.get("/favourites").json()==[]
    ''')
