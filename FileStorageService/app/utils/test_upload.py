from fastapi.testclient import TestClient
from app.main import app
from app.utils.authz import get_current_user, AuthUser
from app.core.config import settings


def test_upload(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    client = TestClient(app)
    file_data = {"file": ("test.pdf", b"PDF content", "application/pdf")}
    assert client.post("/files/upload", files=file_data).status_code == 401
    async def admin():
        return AuthUser(user_id=1, roles=["admin"])
    app.dependency_overrides[get_current_user] = admin
    try:
        response = client.post("/files/upload", files=file_data)
        assert response.status_code == 200
        assert response.json()["file"]["uploaded_to"].startswith("/upload/")
    finally:
        app.dependency_overrides.clear()
