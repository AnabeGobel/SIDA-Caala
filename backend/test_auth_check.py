from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import patch

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user, require_roles
from app.routes.auth import admin_router


PROFILES = {
    "admin-token": {
        "id": "admin-token",
        "nome": "Admin",
        "email": "admin@example.test",
        "role": "admin",
        "ativo": True,
    },
    "operator-token": {
        "id": "operator-token",
        "nome": "Operator",
        "email": "operator@example.test",
        "role": "operador",
        "ativo": True,
    },
    "inactive-token": {
        "id": "inactive-token",
        "nome": "Inactive",
        "email": "inactive@example.test",
        "role": "admin",
        "ativo": False,
    },
}


class ProfileQuery:
    def __init__(self):
        self.user_id = ""

    def select(self, *_):
        return self

    def eq(self, _, value):
        self.user_id = value
        return self

    def maybe_single(self):
        return self

    def execute(self):
        return SimpleNamespace(data=PROFILES.get(self.user_id))


class FakeSupabaseClient:
    def __init__(self):
        self.auth = SimpleNamespace(
            get_user=lambda token: SimpleNamespace(user=SimpleNamespace(id=token))
        )

    def table(self, _):
        return ProfileQuery()


class AuthorizationCheck(TestCase):
    def setUp(self):
        app = FastAPI()

        @app.get("/admin-only")
        def admin_only(user: CurrentUser = Depends(require_roles("admin"))):
            return {"role": user.role}

        app.include_router(admin_router, prefix="/api")
        self.client = TestClient(app)
        self.supabase = patch("app.auth.get_supabase_client", return_value=FakeSupabaseClient())
        self.supabase.start()
        self.addCleanup(self.supabase.stop)

    def test_requires_authentication(self):
        self.assertEqual(self.client.get("/admin-only").status_code, 401)

    def test_rejects_other_roles(self):
        response = self.client.get(
            "/admin-only", headers={"Authorization": "Bearer operator-token"}
        )
        self.assertEqual(response.status_code, 403)

    def test_rejects_inactive_profiles(self):
        response = self.client.get(
            "/admin-only", headers={"Authorization": "Bearer inactive-token"}
        )
        self.assertEqual(response.status_code, 403)

    def test_allows_active_admin(self):
        response = self.client.get(
            "/admin-only", headers={"Authorization": "Bearer admin-token"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"role": "admin"})

    def test_admin_api_rejects_operator(self):
        response = self.client.get(
            "/api/admin/users", headers={"Authorization": "Bearer operator-token"}
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_api_requires_token(self):
        self.assertEqual(self.client.get("/api/admin/users").status_code, 401)


if __name__ == "__main__":
    main()