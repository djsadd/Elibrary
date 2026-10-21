import pytest


@pytest.mark.parametrize("service,module,paths", [
    ("FileStorageService", "app.main", [("post","/files/upload"),("get","/files/upload/2026/10/probe.pdf")]),
    ("SearchService", "app.main", [("get","/search"),("get","/search/suggest?q=test"),("post","/search/book-recommendation-explanation")]),
    ("OtherLibraryIntegrations", "app.main", [("get","/libtau/books"),("get","/libtau/crawl_pdfs"),("post","/libtau/migrate_subjects/cancel")]),
    ("AI", "app.main", [("post","/api/chat_card")]),
    ("PlatonusAuth", "app", [("post","/auth_platonus")]),
    ("AnalyticsService", "main", [("get","/analytics/stats/summary"),("get","/analytics/traffic"),("post","/analytics/events")]),
    ("reviews", "app.main", [("post","/reviews"),("patch","/reviews/1"),("delete","/reviews/1")]),
    ("favourites", "app.main", [("get","/favourites"),("post","/favourites"),("delete","/favourites/1")]),
    ("NotificationService", "app.main", [("get","/notification/"),("post","/notification/"),("get","/notification/1")]),
])
def test_direct_service_anonymous_requests_denied(probe, service, module, paths):
    probe(service, f'''
        import importlib
        from fastapi.testclient import TestClient
        app = importlib.import_module({module!r}).app
        c = TestClient(app)
        for method,path in {paths!r}:
            r = getattr(c,method)(path,json={{}}) if method in {{"post","patch"}} else getattr(c,method)(path)
            assert r.status_code == 401, (path,r.status_code,r.text)
    ''')


def test_search_admin_key_fails_closed(probe):
    probe("SearchService", '''
        from app.main import app
        from app.core.config import settings
        from fastapi.testclient import TestClient
        c=TestClient(app)
        settings.ADMIN_TOKEN=""
        assert c.post("/admin/reset_index").status_code == 503
        settings.ADMIN_TOKEN="test-key-" + "x"*40
        assert c.post("/admin/reset_index").status_code == 401
        assert c.post("/internal/books/index", json={}).status_code == 401
    ''')


def test_stale_search_index_cannot_disclose_private_book(probe):
    probe("SearchService", '''
        from fastapi.testclient import TestClient
        from app.main import app
        from app.api import search
        from app.utils.authz import get_current_user, AuthUser
        async def student():return AuthUser(user_id=1,roles=["student"])
        app.dependency_overrides[get_current_user]=student
        class Index:
            async def search(self,**kwargs):
                return {"hits":{"total":{"value":1},"hits":[{"_source":{"id":42,"title":"Private stale title"}}]}}
            async def close(self):pass
        search.create_es=lambda:Index()
        async def unavailable(**kwargs):raise RuntimeError("Catalogue unavailable")
        async def hidden(**kwargs):return []
        c=TestClient(app)
        search.fetch_books_batch=hidden
        assert c.get("/search?q=test").json()["items"]==[]
        assert c.get("/search/suggest?q=test").json()["items"]==[]
        search.fetch_books_batch=unavailable
        assert c.get("/search?q=test").status_code==503
        assert c.get("/search/suggest?q=test").status_code==503
    ''')
