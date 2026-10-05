from types import SimpleNamespace
from unittest import TestCase, main
from unittest.mock import patch

from pydantic import ValidationError

from app.auth import CurrentUser
from app.routes.auth import ProfileUpdate, UserUpdate, update_user


class AdminUpdateQuery:
    def __init__(self, target):
        self.target = target
        self.operation = "select"
        self.changes = {}

    def select(self, *_):
        self.operation = "select"
        return self

    def update(self, changes):
        self.operation = "update"
        self.changes = changes
        return self

    def eq(self, *_):
        return self

    def maybe_single(self):
        return self

    def execute(self):
        if self.operation == "update":
            return SimpleNamespace(data=[{**self.target, **self.changes}])
        return SimpleNamespace(data=self.target)


class AccountManagementCheck(TestCase):
    def test_profile_password_requires_matching_confirmation(self):
        with self.assertRaises(ValidationError):
            ProfileUpdate(password="newpassword", password_confirmation="different")

        profile = ProfileUpdate(
            password="newpassword", password_confirmation="newpassword"
        )
        self.assertEqual(profile.password, profile.password_confirmation)

    def test_deactivating_account_bans_supabase_auth_user(self):
        target = {
            "id": "operator-id",
            "role": "operador",
            "ativo": True,
        }
        table = AdminUpdateQuery(target)
        auth_changes = []
        client = SimpleNamespace(
            table=lambda _: table,
            auth=SimpleNamespace(
                admin=SimpleNamespace(
                    update_user_by_id=lambda user_id, changes: auth_changes.append(
                        (user_id, changes)
                    )
                )
            ),
        )
        current_admin = CurrentUser(
            id="admin-id",
            nome="Admin",
            email="admin@example.test",
            role="admin",
            ativo=True,
        )

        with patch("app.routes.auth.get_supabase_client", return_value=client):
            result = update_user(
                "operator-id", UserUpdate(ativo=False), current_admin
            )

        self.assertEqual(result["ativo"], False)
        self.assertEqual(
            auth_changes,
            [("operator-id", {"ban_duration": "876000h"})],
        )
        self.assertEqual(table.changes, {"ativo": False})

    def test_reactivating_account_removes_auth_ban(self):
        target = {
            "id": "operator-id",
            "role": "operador",
            "ativo": False,
        }
        table = AdminUpdateQuery(target)
        auth_changes = []
        client = SimpleNamespace(
            table=lambda _: table,
            auth=SimpleNamespace(
                admin=SimpleNamespace(
                    update_user_by_id=lambda user_id, changes: auth_changes.append(
                        (user_id, changes)
                    )
                )
            ),
        )
        current_admin = CurrentUser(
            id="admin-id",
            nome="Admin",
            email="admin@example.test",
            role="admin",
            ativo=True,
        )

        with patch("app.routes.auth.get_supabase_client", return_value=client):
            result = update_user(
                "operator-id", UserUpdate(ativo=True), current_admin
            )

        self.assertEqual(result["ativo"], True)
        self.assertEqual(
            auth_changes,
            [("operator-id", {"ban_duration": "none"})],
        )


if __name__ == "__main__":
    main()
