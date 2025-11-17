from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_upload():
    file_data = {"file": ("test.pdf", b"PDF content", "application/pdf")}
    response = client.post("/files/upload", files=file_data)
    assert response.status_code == 200
    data = response.json()["file"]
    assert data["uploaded_to"].startswith("/upload/")
