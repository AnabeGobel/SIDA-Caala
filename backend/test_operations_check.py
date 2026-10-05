from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import CurrentUser, get_current_user
from app.routes import operations
from app.routes.operations import _integration_checks
from app.services.request_metrics import get_request_metrics, record_request


class FakeQuery:
    def __init__(self, sample, recent_count):
        self.sample = sample
        self.recent_count = recent_count
        self.head = False
        self.calls = []

    def select(self, *args, **kwargs):
        self.calls.append(("select", args, kwargs))
        self.head = kwargs.get("head", False)
        return self

    def order(self, *args, **kwargs):
        self.calls.append(("order", args, kwargs))
        return self

    def limit(self, *args):
        self.calls.append(("limit", args))
        return self

    def gte(self, *args):
        self.calls.append(("gte", args))
        return self

    def execute(self):
        if self.head:
            return SimpleNamespace(count=self.recent_count, data=None)
        return SimpleNamespace(count=723, data=self.sample)


class OperationsCheck(TestCase):
    def test_request_metrics_count_real_responses_and_exclude_health_polling(self):
        before = get_request_metrics()
        record_request("GET", "/api/analyses", 200, 12.5)
        record_request("GET", "/api/admin/operations", 200, 25.0)
        after = get_request_metrics()

        self.assertEqual(after["total_requests"], before["total_requests"] + 1)
        self.assertEqual(
            after["recent_sample_count"], before["recent_sample_count"] + 1
        )
        self.assertIsNotNone(after["last_request_at"])
        self.assertTrue(
            any(route["route"] == "GET /api/analyses" for route in after["top_routes"])
        )

    def test_model_file_status_reports_real_classes_and_size(self):
        from tempfile import NamedTemporaryFile

        with NamedTemporaryFile() as model_file:
            model_file.write(b"model-weights")
            model_file.flush()
            result = operations._model_status(
                "Test model",
                model_file.name,
                SimpleNamespace(names={0: "knife", 1: "gun"}),
            )

        self.assertTrue(result["available"])
        self.assertEqual(result["size_bytes"], len(b"model-weights"))
        self.assertEqual(result["classes"], ["knife", "gun"])
        self.assertEqual(result["status"], "operacional")

    def test_operations_endpoint_requires_admin_role(self):
        app = FastAPI()
        app.include_router(operations.router, prefix="/api")
        client = TestClient(app)

        self.assertEqual(client.get("/api/admin/operations").status_code, 401)

        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="operator-id",
            nome="Operator",
            email="operator@example.test",
            role="operador",
            ativo=True,
        )
        self.assertEqual(client.get("/api/admin/operations").status_code, 403)

    def test_admin_can_read_live_operations_endpoint(self):
        app = FastAPI()
        app.include_router(operations.router, prefix="/api")
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="admin-id",
            nome="Admin",
            email="admin@example.test",
            role="admin",
            ativo=True,
        )
        payload = {"service": {"status": "operacional"}}
        with patch(
            "app.routes.operations.operations_status", return_value=payload
        ):
            response = TestClient(app).get("/api/admin/operations")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), payload)

    def test_integration_status_uses_database_counts_and_inference_sample(self):
        sample = [
            {"inference_ms": 120},
            {"inference_ms": 80},
            {"inference_ms": None},
        ]
        query = FakeQuery(sample, recent_count=7)
        storage_calls = []
        table_calls = []

        def get_table(name):
            table_calls.append(name)
            return query

        client = SimpleNamespace(
            table=get_table,
            storage=SimpleNamespace(
                get_bucket=lambda name: storage_calls.append(name)
            ),
        )

        with patch(
            "app.routes.operations.get_supabase_client", return_value=client
        ):
            database, storage, analyses = _integration_checks()

        self.assertEqual(database["status"], "operacional")
        self.assertEqual(storage["status"], "operacional")
        self.assertEqual(analyses["total"], 723)
        self.assertEqual(analyses["last_24_hours"], 7)
        self.assertEqual(analyses["sampled_records"], 3)
        self.assertEqual(analyses["average_inference_ms"], 100)
        self.assertEqual(table_calls, ["detection_analyses", "detection_analyses"])
        self.assertEqual(storage_calls, ["analysis-images"])

    def test_storage_failure_is_reported_without_discarding_database_data(self):
        query = FakeQuery([{"inference_ms": 50}], recent_count=1)
        storage_calls = []

        def fail_storage(name):
            storage_calls.append(name)
            raise RuntimeError("storage unavailable")

        table_calls = []

        def get_table(name):
            table_calls.append(name)
            return query

        client = SimpleNamespace(
            table=get_table,
            storage=SimpleNamespace(get_bucket=fail_storage),
        )
        with patch(
            "app.routes.operations.get_supabase_client", return_value=client
        ):
            database, storage, analyses = _integration_checks()

        self.assertEqual(database["status"], "operacional")
        self.assertEqual(storage["status"], "indisponível")
        self.assertEqual(analyses["total"], 723)
        self.assertIn("error", storage)
        self.assertEqual(storage_calls, ["analysis-images"])
        self.assertEqual(table_calls, ["detection_analyses", "detection_analyses"])


if __name__ == "__main__":
    import unittest

    unittest.main()
