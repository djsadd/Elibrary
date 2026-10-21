def test_catalog_permissions_paths_and_upload_limits(probe):
    probe("CatalogService", '''
        import os
        from pathlib import Path
        from fastapi import HTTPException, Request
        from fastapi.testclient import TestClient
        from app.main import app
        from app.utils.authz import get_current_user, AuthUser
        from app.api import catalog_files, catalog_books
        from app.core.db import SessionLocal
        from app.models.book import Book
        async def identity(request: Request):
            role = request.headers.get("authorization", "")
            if role not in {"admin", "student"}: raise HTTPException(401, "Unauthorized")
            return AuthUser(user_id=1, roles=[role])
        app.dependency_overrides[get_current_user] = identity
        catalog_books.index_book_in_search = lambda *args: None
        c = TestClient(app)
        staff = {"Authorization": "admin"}; student = {"Authorization": "student"}
        for method, path, payload in [
            ("post", "/catalog/books", {"title":"Probe"}),
            ("patch", "/catalog/books/1", {"title":"Probe"}),
            ("patch", "/catalog/authors/1", {"name":"Probe"}),
            ("post", "/catalog/subjects", {"name":"Probe"}),
            ("post", "/catalog/playlists", {"title":"Probe"}),
        ]:
            assert getattr(c, method)(path, json=payload).status_code == 401, path
            assert getattr(c, method)(path, json=payload, headers=student).status_code == 403, path
        for value in ("../outside.txt", "/etc/passwd", "C:/secret", "a/../../secret", "a\\\\b", "a%2fb", "a:stream"):
            response = c.post("/catalog/books", json={"title":"Probe","file_id":value}, headers=staff)
            assert response.status_code == 422, (value,response.text)
        catalog_files.MAX_RAW_SIZE = 16
        before = set(Path(os.environ["MEDIA_ROOT"]).iterdir())
        r = c.post("/catalog/upload/raw", content=iter([b"a"*10,b"b"*10]), headers={**staff,"x_filename":"probe.pdf"})
        assert r.status_code == 413, r.text
        assert set(Path(os.environ["MEDIA_ROOT"]).iterdir()) == before
        r = c.post("/catalog/upload/raw", content=b"safe", headers={**staff,"x_filename":"probe.html"})
        assert r.status_code == 415
        r = c.post("/catalog/upload/raw", content=b"safe", headers={**staff,"x_filename":"probe.pdf"})
        assert r.status_code == 200, r.text
        fid = r.json()["file"]["file_id"]
        book = c.post("/catalog/books", headers=staff, json={"title":"Safe","file_id":fid})
        assert book.status_code == 201, book.text
        bid = book.json()["id"]
        assert c.get(f"/catalog/books/{bid}/download", headers=student).content == b"safe"
        outside = Path(os.environ["MEDIA_ROOT"]).parent / "outside.txt"; outside.write_text("sentinel")
        with SessionLocal() as db:
            db.get(Book,bid).file_id = str(outside); db.commit()
        assert c.get(f"/catalog/books/{bid}/download", headers=student).status_code == 404
        assert c.get(f"/catalog/books/{bid}/stream", headers=student).status_code == 404
        assert c.get("/catalog/public/content/menu").status_code == 200
        private = c.post("/catalog/books", headers=staff, json={"title":"Private","is_public":False})
        assert private.status_code == 201, private.text
        private_id = private.json()["id"]
        assert c.get(f"/catalog/books/{private_id}",headers=student).status_code == 404
        assert c.get(f"/catalog/books/{private_id}/download",headers=student).status_code == 404
        assert c.post("/catalog/userbook",headers=student,json={"book_id":private_id}).status_code == 404
        assert c.post("/catalog/notes",headers=student,json={"book_id":private_id,"note":"test"}).status_code == 404
        assert all(b["id"]!=private_id for b in c.get("/catalog/books",headers=student).json()["items"])
        assert c.get(f"/catalog/books/{private_id}",headers=staff).status_code == 200
    ''')
