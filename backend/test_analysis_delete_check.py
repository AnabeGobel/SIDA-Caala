from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import patch
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.auth import CurrentUser
from app.cors import configure_cors, wrap_cors
from app.routes.analyses import delete_analysis


ANALYSIS_ID = UUID("81e372ee-538d-4fa0-bb16-d70ff2cd89f5")


class AnalysisTable:
    def __init__(self, record):
        self.record = record
        self.deleted = False

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def maybe_single(self):
        return self

    def delete(self):
        self.deleted = True
        return self

    def execute(self):
        return SimpleNamespace(data=self.record)


class AnalysisDeleteCheck(TestCase):
    def test_delete_preflight_allows_frontend_origin(self):
        cors_test_app = FastAPI()
        configure_cors(cors_test_app)
        response = TestClient(cors_test_app).options(
            f"/api/analyses/{ANALYSIS_ID}",
            headers={
                "Origin": "http://localhost:8080",
                "Access-Control-Request-Method": "DELETE",
                "Access-Control-Request-Headers": "authorization",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            "http://localhost:8080",
        )
        self.assertIn("DELETE", response.headers["access-control-allow-methods"])

    def test_cors_headers_are_added_to_unhandled_error_responses(self):
        cors_test_app = FastAPI()

        @cors_test_app.get("/failure")
        def fail():
            raise RuntimeError("simulated internal error")

        response = TestClient(
            wrap_cors(cors_test_app),
            raise_server_exceptions=False,
        ).get("/failure", headers={"Origin": "http://localhost:8080"})

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            "http://localhost:8080",
        )

    def make_user(self, user_id, role):
        return CurrentUser(
            id=user_id,
            nome="Test user",
            email="test@example.test",
            role=role,
            ativo=True,
        )

    def make_client(self, record):
        table = AnalysisTable(record)
        removed_images = []
        storage_bucket = SimpleNamespace(
            remove=lambda paths: removed_images.extend(paths)
        )
        client = SimpleNamespace(
            table=lambda _: table,
            storage=SimpleNamespace(from_=lambda _: storage_bucket),
        )
        return client, table, removed_images

    def test_operator_deletes_own_record_and_image(self):
        client, table, removed_images = self.make_client(
            {
                "id": str(ANALYSIS_ID),
                "user_id": "operator-1",
                "image_storage_path": "operator-1/image.png",
            }
        )
        with patch("app.routes.analyses.get_supabase_client", return_value=client):
            response = delete_analysis(
                ANALYSIS_ID, self.make_user("operator-1", "operador")
            )

        self.assertEqual(response.status_code, 204)
        self.assertTrue(table.deleted)
        self.assertEqual(removed_images, ["operator-1/image.png"])

    def test_operator_cannot_delete_another_users_record(self):
        client, table, removed_images = self.make_client(
            {
                "id": str(ANALYSIS_ID),
                "user_id": "operator-2",
                "image_storage_path": "operator-2/image.png",
            }
        )
        with patch("app.routes.analyses.get_supabase_client", return_value=client):
            with self.assertRaises(HTTPException) as raised:
                delete_analysis(ANALYSIS_ID, self.make_user("operator-1", "operador"))

        self.assertEqual(raised.exception.status_code, 403)
        self.assertFalse(table.deleted)
        self.assertEqual(removed_images, [])

    def test_missing_record_returns_not_found(self):
        client, table, _ = self.make_client(None)
        with patch("app.routes.analyses.get_supabase_client", return_value=client):
            with self.assertRaises(HTTPException) as raised:
                delete_analysis(ANALYSIS_ID, self.make_user("admin-1", "admin"))

        self.assertEqual(raised.exception.status_code, 404)
        self.assertFalse(table.deleted)


if __name__ == "__main__":
    main()
