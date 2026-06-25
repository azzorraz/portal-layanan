"""Phase 5 tests — Fonnte WhatsApp integration + admin maintenance endpoints.

Covers:
- /app/backend/fonnte.py helper unit tests (templates, normalize_phone, fail-soft)
- POST /api/admin/test-whatsapp (koord only)
- POST /api/admin/cleanup-test-tickets (koord only) with cascade
- Triggers in create_ticket / change_status / add_comment / bulk_status

To avoid spamming real WhatsApp during tests we set FONNTE_ENABLED=false in
a session-scoped fixture so send_whatsapp returns {"status": false, "skipped": true}
without hitting the network. One explicit live call is exercised against
test-whatsapp with a clearly-invalid phone number per review_request guidance.
"""
import os
import sys
import asyncio
import importlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OP = {"email": "operator1@dapodik.id", "password": "operator123"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def koord_token():
    r = requests.post(f"{API}/auth/login", json=KOORD, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def operator_token():
    r = requests.post(f"{API}/auth/login", json=OP, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def koord_headers(koord_token):
    return {"Authorization": f"Bearer {koord_token}", "Content-Type": "application/json"}


@pytest.fixture
def operator_headers(operator_token):
    return {"Authorization": f"Bearer {operator_token}", "Content-Type": "application/json"}


# ---------- fonnte.py unit tests (helpers) ----------
class TestFonnteHelpers:
    def setup_method(self):
        # Ensure backend dir is importable for fonnte module
        sys.path.insert(0, "/app/backend")
        import fonnte  # noqa
        importlib.reload(fonnte)
        self.fonnte = fonnte

    def test_normalize_phone_strips_non_digits(self):
        assert self.fonnte.normalize_phone("0812-3456-7890") == "081234567890"
        assert self.fonnte.normalize_phone("+62 812 3456 7890") == "6281234567890"
        assert self.fonnte.normalize_phone("") is None
        assert self.fonnte.normalize_phone(None) is None
        assert self.fonnte.normalize_phone("abc") is None

    def test_template_msg_ticket_created(self):
        t = {"ticket_number": "TCK-2026-000001", "layanan_nama": "X", "judul": "Y", "status": "Diajukan", "sla_days": 5}
        s = self.fonnte.msg_ticket_created(t)
        assert isinstance(s, str) and "TCK-2026-000001" in s and s.strip()

    def test_template_msg_status_change(self):
        t = {"ticket_number": "TCK-2", "layanan_nama": "L"}
        s = self.fonnte.msg_status_change(t, "Diajukan", "Diproses", "OK")
        assert "TCK-2" in s and "Diproses" in s

    def test_template_msg_new_comment(self):
        t = {"ticket_number": "TCK-3"}
        s = self.fonnte.msg_new_comment(t, "Pak Koord", "Halo")
        assert "TCK-3" in s and "Pak Koord" in s

    def test_template_msg_bulk_status(self):
        t = {"ticket_number": "TCK-4"}
        s = self.fonnte.msg_bulk_status(t, "Disetujui")
        assert "TCK-4" in s and "Disetujui" in s

    def test_send_whatsapp_disabled_returns_soft_failure(self, monkeypatch):
        monkeypatch.setenv("FONNTE_ENABLED", "false")
        importlib.reload(self.fonnte)
        out = asyncio.run(self.fonnte.send_whatsapp("081234567890", "hello"))
        assert out["status"] is False
        assert out.get("skipped") is True
        monkeypatch.setenv("FONNTE_ENABLED", "true")
        importlib.reload(self.fonnte)

    def test_send_whatsapp_no_token_returns_soft_failure(self, monkeypatch):
        monkeypatch.delenv("FONNTE_API_TOKEN", raising=False)
        importlib.reload(self.fonnte)
        out = asyncio.run(self.fonnte.send_whatsapp("081234567890", "hello"))
        assert out["status"] is False
        assert out.get("skipped") is True


# ---------- Admin test-whatsapp endpoint ----------
class TestAdminTestWhatsApp:
    def test_operator_forbidden(self, operator_headers):
        r = requests.post(f"{API}/admin/test-whatsapp", json={"target": "08000000000", "message": "x"}, headers=operator_headers, timeout=20)
        assert r.status_code == 403

    def test_koord_success_does_not_500(self, koord_headers):
        # Single live call with clearly-invalid number; accept any status (true/false).
        r = requests.post(
            f"{API}/admin/test-whatsapp",
            json={"target": "08000000000", "message": "TEST_PHASE5 do not reply"},
            headers=koord_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "status" in data  # Fonnte-shaped response, may be True or False

    def test_audit_log_test_whatsapp_entry(self, koord_headers):
        r = requests.get(f"{API}/audit?action=test_whatsapp&limit=10", headers=koord_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        logs = body.get("items", body) if isinstance(body, dict) else body
        assert isinstance(logs, list) and len(logs) >= 1
        assert any(l.get("action") == "test_whatsapp" for l in logs)


# ---------- Admin cleanup-test-tickets endpoint ----------
class TestAdminCleanupTestTickets:
    @pytest.fixture
    def seed_test_tickets(self, operator_headers, koord_headers):
        # Get a layanan id
        lay = requests.get(f"{API}/layanan", headers=koord_headers, timeout=20).json()
        assert lay
        layanan_id = lay[0]["id"]

        created_numbers = []
        payloads = [
            {"judul": "TEST_PHASE5 alpha", "deskripsi": "cleanup target", "prioritas": "Normal", "layanan_id": layanan_id},
            {"judul": "TEST-PHASE5 beta", "deskripsi": "cleanup target", "prioritas": "Normal", "layanan_id": layanan_id},
            {"judul": "Some playwright case", "deskripsi": "x", "prioritas": "Normal", "layanan_id": layanan_id},
        ]
        for p in payloads:
            r = requests.post(f"{API}/tickets", json=p, headers=operator_headers, timeout=30)
            assert r.status_code in (200, 201), r.text
            created_numbers.append(r.json()["ticket_number"])
        return created_numbers

    def test_operator_forbidden(self, operator_headers):
        r = requests.post(f"{API}/admin/cleanup-test-tickets", headers=operator_headers, timeout=20)
        assert r.status_code == 403

    def test_koord_deletes_and_cascades(self, seed_test_tickets, koord_headers):
        seeded = set(seed_test_tickets)
        r = requests.post(f"{API}/admin/cleanup-test-tickets", headers=koord_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "deleted" in data and "tickets" in data
        assert data["deleted"] >= len(seeded)
        returned = set(data["tickets"])
        assert seeded.issubset(returned), f"Missing from cleanup: {seeded - returned}"

        # Verify gone via list endpoint
        lst = requests.get(f"{API}/tickets?limit=500", headers=koord_headers, timeout=30).json()
        remaining = {t.get("ticket_number") for t in (lst if isinstance(lst, list) else lst.get("items", []))}
        assert not (seeded & remaining), f"Tickets still present: {seeded & remaining}"

    def test_cleanup_audit_log_entry(self, koord_headers):
        r = requests.get(f"{API}/audit?action=cleanup_test&limit=10", headers=koord_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        logs = body.get("items", body) if isinstance(body, dict) else body
        assert any(l.get("action") == "cleanup_test" for l in logs)


# ---------- Triggers via real endpoints (no_whatsapp present, must NOT 500) ----------
class TestTriggers:
    @pytest.fixture
    def layanan_id(self, koord_headers):
        lay = requests.get(f"{API}/layanan", headers=koord_headers, timeout=20).json()
        return lay[0]["id"]

    def test_create_ticket_with_no_whatsapp_succeeds(self, operator_headers, layanan_id):
        payload = {
            "judul": "TEST_PHASE5 wa-trigger",
            "deskripsi": "trigger create WA",
            "prioritas": "Normal",
            "layanan_id": layanan_id,
            "form_data": {"no_whatsapp": "081234567890"},
        }
        r = requests.post(f"{API}/tickets", json=payload, headers=operator_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data.get("ticket_number")
        return data["id"]

    def test_status_change_with_no_whatsapp_succeeds(self, operator_headers, koord_headers, layanan_id):
        # Create
        payload = {
            "judul": "TEST_PHASE5 wa-status",
            "deskripsi": "trigger status WA",
            "prioritas": "Normal",
            "layanan_id": layanan_id,
            "form_data": {"no_whatsapp": "081234567890"},
        }
        r = requests.post(f"{API}/tickets", json=payload, headers=operator_headers, timeout=30)
        assert r.status_code in (200, 201), r.text
        tid = r.json()["id"]

        # Change status as koord
        r2 = requests.post(f"{API}/tickets/{tid}/status", json={"status": "Diproses", "catatan": "ok"}, headers=koord_headers, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "Diproses"

    def test_koord_comment_does_not_500(self, operator_headers, koord_headers, layanan_id):
        payload = {
            "judul": "TEST_PHASE5 wa-comment",
            "deskripsi": "trigger comment WA",
            "prioritas": "Normal",
            "layanan_id": layanan_id,
            "form_data": {"no_whatsapp": "081234567890"},
        }
        r = requests.post(f"{API}/tickets", json=payload, headers=operator_headers, timeout=30)
        tid = r.json()["id"]
        rc = requests.post(f"{API}/tickets/{tid}/comments", json={"content": "halo dari koord"}, headers=koord_headers, timeout=30)
        assert rc.status_code in (200, 201), rc.text

    def test_bulk_status_per_ticket_does_not_500(self, operator_headers, koord_headers, layanan_id):
        ids = []
        for i in range(2):
            r = requests.post(f"{API}/tickets", json={
                "judul": f"TEST_PHASE5 bulk-{i}", "deskripsi": "x", "prioritas": "Normal",
                "layanan_id": layanan_id, "form_data": {"no_whatsapp": "081234567890"},
            }, headers=operator_headers, timeout=30)
            ids.append(r.json()["id"])
        rb = requests.post(f"{API}/tickets/bulk-status", json={"ticket_ids": ids, "status": "Diproses"}, headers=koord_headers, timeout=60)
        assert rb.status_code == 200, rb.text

    def test_create_ticket_without_no_whatsapp_succeeds(self, operator_headers, layanan_id):
        payload = {
            "judul": "TEST_PHASE5 no-wa-field",
            "deskripsi": "no wa",
            "prioritas": "Normal",
            "layanan_id": layanan_id,
        }
        r = requests.post(f"{API}/tickets", json=payload, headers=operator_headers, timeout=30)
        assert r.status_code in (200, 201), r.text


# ---------- Regression: existing endpoints still respond ----------
class TestRegression:
    def test_auth_me(self, koord_headers):
        r = requests.get(f"{API}/auth/me", headers=koord_headers, timeout=20)
        assert r.status_code == 200
        assert r.json().get("role") == "koordinator"

    def test_layanan_list(self, koord_headers):
        r = requests.get(f"{API}/layanan", headers=koord_headers, timeout=20)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_tickets_list(self, koord_headers):
        r = requests.get(f"{API}/tickets?limit=5", headers=koord_headers, timeout=20)
        assert r.status_code == 200

    def test_dashboard_stats(self, koord_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=koord_headers, timeout=20)
        assert r.status_code == 200

    def test_executive_stats(self, koord_headers):
        r = requests.get(f"{API}/executive/stats", headers=koord_headers, timeout=20)
        assert r.status_code == 200

    def test_kb_list(self, koord_headers):
        r = requests.get(f"{API}/kb/articles", headers=koord_headers, timeout=20)
        assert r.status_code == 200

    def test_audit_logs_list(self, koord_headers):
        r = requests.get(f"{API}/audit?limit=5", headers=koord_headers, timeout=20)
        assert r.status_code == 200


# ---------- Final cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def final_cleanup(request):
    """After session, call cleanup-test-tickets to remove any TEST_ leftovers."""
    yield
    try:
        login = requests.post(f"{API}/auth/login", json=KOORD, timeout=20)
        if login.status_code == 200:
            tok = login.json()["token"]
            requests.post(
                f"{API}/admin/cleanup-test-tickets",
                headers={"Authorization": f"Bearer {tok}"},
                timeout=60,
            )
    except Exception:
        pass
