"""Phase 3 backend tests: Bulk operations on tickets (bulk-assign + bulk-status)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OP1 = {"email": "operator1@dapodik.id", "password": "operator123"}


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def koord_session():
    j = login(KOORD)
    return j["token"], j["user"]


@pytest.fixture(scope="module")
def op1_tok():
    return login(OP1)["token"]


@pytest.fixture(scope="module")
def koord_tok(koord_session):
    return koord_session[0]


@pytest.fixture(scope="module")
def koord_user(koord_session):
    return koord_session[1]


@pytest.fixture(scope="module")
def layanan_id(koord_tok):
    r = requests.get(f"{API}/layanan", headers=hdr(koord_tok))
    assert r.status_code == 200 and len(r.json()) > 0
    return r.json()[0]["id"]


def _create_tickets(op_tok, layanan_id, n=3, prefix="TEST_BULK"):
    ids = []
    for i in range(n):
        payload = {
            "layanan_id": layanan_id,
            "judul": f"{prefix}_{i}",
            "deskripsi": f"bulk test ticket {i}",
            "prioritas": "Normal",
            "attachments": [],
            "checklist_state": [],
        }
        r = requests.post(f"{API}/tickets", headers=hdr(op_tok), json=payload)
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
    return ids


@pytest.fixture(scope="module")
def bulk_tickets(op1_tok, layanan_id):
    return _create_tickets(op1_tok, layanan_id, n=3)


# --------------- BULK ASSIGN ---------------
class TestBulkAssign:
    def test_empty_array_returns_422(self, koord_tok):
        r = requests.post(f"{API}/tickets/bulk-assign", headers=hdr(koord_tok),
                          json={"ticket_ids": [], "assignee_id": None})
        assert r.status_code == 422, r.text

    def test_operator_forbidden(self, op1_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-assign", headers=hdr(op1_tok),
                          json={"ticket_ids": bulk_tickets, "assignee_id": None})
        assert r.status_code == 403

    def test_invalid_assignee_returns_404(self, koord_tok, bulk_tickets):
        # valid-looking ObjectId but not present
        r = requests.post(f"{API}/tickets/bulk-assign", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "assignee_id": "000000000000000000000000"})
        assert r.status_code == 404

    def test_bulk_assign_success(self, koord_tok, koord_user, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-assign", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "assignee_id": koord_user["id"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["updated"] == len(bulk_tickets)
        # verify persistence
        for tid in bulk_tickets:
            g = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok))
            assert g.status_code == 200
            t = g.json()
            assert t["assignee_id"] == koord_user["id"]
            assignee_name = t.get("assignee_name")
            assert assignee_name and len(assignee_name) > 0

    def test_bulk_unassign_with_none(self, koord_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-assign", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "assignee_id": None})
        assert r.status_code == 200
        assert r.json()["updated"] == len(bulk_tickets)
        for tid in bulk_tickets:
            t = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
            assert t.get("assignee_id") in (None, "")
            assert t.get("assignee_name") in (None, "")

    def test_bulk_assign_creates_audit_log(self, koord_tok):
        r = requests.get(f"{API}/audit", headers=hdr(koord_tok), params={"action": "bulk_assign", "limit": 5})
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert len(items) >= 1, "Expected at least one bulk_assign audit entry"
        assert items[0]["action"] == "bulk_assign"

    def test_bulk_assign_creates_activity_log(self, koord_tok, bulk_tickets):
        # Verify activity log on first ticket has assign entry
        tid = bulk_tickets[0]
        r = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok))
        assert r.status_code == 200
        acts = r.json().get("activities", [])
        assign_acts = [a for a in acts if a.get("kind") == "assign"]
        # at least 2 activities since we assigned + unassigned
        assert len(assign_acts) >= 1


# --------------- BULK STATUS ---------------
class TestBulkStatus:
    def test_empty_array_returns_422(self, koord_tok):
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(koord_tok),
                          json={"ticket_ids": [], "status": "Diproses"})
        assert r.status_code == 422

    def test_invalid_status_returns_422(self, koord_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "status": "Bogus"})
        assert r.status_code == 422

    def test_operator_forbidden(self, op1_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(op1_tok),
                          json={"ticket_ids": bulk_tickets, "status": "Diproses"})
        assert r.status_code == 403

    def test_bulk_status_success(self, koord_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "status": "Diproses", "catatan": "TEST bulk processing"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert data["updated"] == len(bulk_tickets)
        for tid in bulk_tickets:
            t = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
            assert t["status"] == "Diproses"

    def test_bulk_status_skips_already_target(self, koord_tok, bulk_tickets):
        # Same target → updated should be 0 (already Diproses from previous test)
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "status": "Diproses"})
        assert r.status_code == 200
        assert r.json()["updated"] == 0

    def test_bulk_status_sets_closed_at_on_selesai(self, koord_tok, bulk_tickets):
        r = requests.post(f"{API}/tickets/bulk-status", headers=hdr(koord_tok),
                          json={"ticket_ids": bulk_tickets, "status": "Selesai", "catatan": "TEST closed"})
        assert r.status_code == 200
        assert r.json()["updated"] == len(bulk_tickets)
        for tid in bulk_tickets:
            t = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
            assert t["status"] == "Selesai"
            assert t.get("closed_at") is not None

    def test_bulk_status_creates_audit_log(self, koord_tok):
        r = requests.get(f"{API}/audit", headers=hdr(koord_tok), params={"action": "bulk_status", "limit": 5})
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert len(items) >= 1
        assert items[0]["action"] == "bulk_status"

    def test_bulk_status_creates_activity_with_bulk_flag(self, koord_tok, bulk_tickets):
        tid = bulk_tickets[0]
        r = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
        acts = r.get("activities", [])
        sc = [a for a in acts if a.get("kind") == "status_change"]
        assert len(sc) >= 1
        # Check meta bulk flag on at least one entry
        bulk_acts = [a for a in sc if (a.get("meta") or {}).get("bulk") is True]
        assert len(bulk_acts) >= 1, f"Expected bulk=True meta on status_change activity. Got: {sc}"
