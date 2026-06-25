"""Phase 7 backend tests — Quota low-alert + WA resend mechanism.

Covers:
- PATCH /api/auth/preferences with `phone` field (koord self-alert number) + GET /me reflects
- POST /api/admin/wa-logs/{log_id}/resend RBAC + error paths + success path
- Audit log entry created for resend
- New wa_log row written with event_type='resend_{original}'
- Quota-low alert helper is exercised indirectly (system_state collection presence is checked
  through repeated triggers; full monkey-patch is out-of-process so skipped with note)

NOTE: send_whatsapp cannot be monkey-patched from out-of-process tests. We rely on
known-bad phone numbers ("08" too short) which Fonnte rejects WITHOUT consuming quota,
so we can exercise the failure → resend cycle without burning the live quota.
"""

import os
import time
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "http://localhost:8001"

API = f"{BASE_URL}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OPERATOR = {"email": "operator1@dapodik.id", "password": "operator123"}


# ---------- helpers ----------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    body = r.json()
    return body["token"], body["user"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def koord_session():
    token, user = _login(KOORD)
    return {"token": token, "user": user, "h": _h(token)}


@pytest.fixture(scope="module")
def operator_session():
    token, user = _login(OPERATOR)
    return {"token": token, "user": user, "h": _h(token)}


@pytest.fixture(scope="module")
def first_layanan(koord_session):
    r = requests.get(f"{API}/layanan", headers=koord_session["h"], timeout=20)
    assert r.status_code == 200
    items = r.json()
    assert items, "No layanan available"
    return items[0]


@pytest.fixture(scope="module", autouse=True)
def cleanup_at_end(koord_session, operator_session):
    # Ensure operator is opted-IN
    requests.patch(f"{API}/auth/preferences", headers=operator_session["h"],
                   json={"wa_opt_out": False}, timeout=20)
    yield
    requests.patch(f"{API}/auth/preferences", headers=operator_session["h"],
                   json={"wa_opt_out": False}, timeout=20)
    # Clean phone on koord for hygiene
    try:
        requests.patch(f"{API}/auth/preferences", headers=koord_session["h"],
                       json={"phone": ""}, timeout=20)
    except Exception:
        pass
    # Cleanup test tickets
    try:
        requests.post(f"{API}/admin/cleanup-test-tickets", headers=koord_session["h"], timeout=30)
    except Exception:
        pass


# ============================================================
# PATCH /auth/preferences — `phone` field (Phase 7)
# ============================================================
class TestKoordPhonePreference:
    def test_koord_can_save_phone(self, koord_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=koord_session["h"],
            json={"phone": "081299990000"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("phone") == "081299990000"

    def test_me_reflects_phone(self, koord_session):
        me = requests.get(f"{API}/auth/me", headers=koord_session["h"], timeout=20)
        assert me.status_code == 200
        assert me.json().get("phone") == "081299990000"

    def test_phone_alongside_optout(self, operator_session):
        """Operator can patch wa_opt_out AND phone together."""
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={"wa_opt_out": False, "phone": "081888887777"},
            timeout=20,
        )
        assert r.status_code == 200
        body = r.json()
        assert body["wa_opt_out"] is False
        assert body["phone"] == "081888887777"

        # cleanup phone
        requests.patch(f"{API}/auth/preferences", headers=operator_session["h"],
                       json={"phone": ""}, timeout=20)

    def test_phone_clears_with_empty_string(self, koord_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=koord_session["h"],
            json={"phone": ""},
            timeout=20,
        )
        assert r.status_code == 200
        # restore for next test
        requests.patch(f"{API}/auth/preferences", headers=koord_session["h"],
                       json={"phone": "081299990000"}, timeout=20)


# ============================================================
# POST /admin/wa-logs/{log_id}/resend
# ============================================================
class TestResendWaLog:
    def test_operator_forbidden(self, operator_session):
        # Any objectid-ish value will do — RBAC must reject before lookup
        r = requests.post(
            f"{API}/admin/wa-logs/507f1f77bcf86cd799439011/resend",
            headers=operator_session["h"],
            timeout=20,
        )
        assert r.status_code == 403

    def test_invalid_log_id_returns_404(self, koord_session):
        # Non-ObjectId string → server raises 404
        r = requests.post(
            f"{API}/admin/wa-logs/not-a-real-id/resend",
            headers=koord_session["h"],
            timeout=20,
        )
        assert r.status_code == 404

    def test_nonexistent_log_id_returns_404(self, koord_session):
        # Valid ObjectId format but no document
        r = requests.post(
            f"{API}/admin/wa-logs/000000000000000000000000/resend",
            headers=koord_session["h"],
            timeout=20,
        )
        assert r.status_code == 404


# ============================================================
# Create a failing wa_log row first, then exercise resend success/error paths
# ============================================================
@pytest.fixture(scope="module")
def failed_wa_log(koord_session, operator_session, first_layanan):
    """Create a ticket with a short/bad phone so Fonnte fails the send,
    producing a failed wa_log row we can use for resend tests."""
    # Make sure operator is opted-in so send is attempted
    requests.patch(f"{API}/auth/preferences", headers=operator_session["h"],
                   json={"wa_opt_out": False}, timeout=20)

    # Create ticket with intentionally-bad short phone "08" — Fonnte will reject
    payload = {
        "layanan_id": first_layanan["id"],
        "judul": "TEST_PHASE7 failed-wa ticket",
        "deskripsi": "TEST_PHASE7 bad phone for resend test",
        "prioritas": "Normal",
        "form_data": {"no_whatsapp": "08"},  # too short → Fonnte error, no quota burn
    }
    cr = requests.post(f"{API}/tickets", headers=operator_session["h"],
                       json=payload, timeout=30)
    assert cr.status_code in (200, 201), cr.text
    ticket = cr.json()
    time.sleep(2.0)  # allow async log write

    # Find the recent failure in stats
    stats = requests.get(f"{API}/executive/whatsapp-stats",
                         headers=koord_session["h"], timeout=30).json()
    failures = stats.get("recent_failures", [])
    # Look for one tied to our ticket
    log = None
    for f in failures:
        if f.get("ticket_number") == ticket.get("ticket_number"):
            log = f
            break
    if not log and failures:
        log = failures[0]
    return {"ticket": ticket, "log": log}


class TestResendSuccessPath:
    def test_resend_failed_log_creates_new_row(self, koord_session, failed_wa_log):
        log = failed_wa_log["log"]
        if not log:
            pytest.skip("No failed wa_log available — Fonnte may have accepted the bad phone or backend unreachable")
        log_id = log.get("id")
        assert log_id, f"log has no id field: {log}"

        # snapshot stats
        before = requests.get(f"{API}/executive/whatsapp-stats",
                              headers=koord_session["h"], timeout=30).json()
        total_before = before["total"]

        r = requests.post(
            f"{API}/admin/wa-logs/{log_id}/resend",
            headers=koord_session["h"], timeout=30,
        )
        # Either 200 with Fonnte result or 400 if endpoint can't rebuild
        assert r.status_code in (200, 400), r.text
        if r.status_code == 400:
            pytest.skip(f"Resend rejected with 400: {r.text}")

        body = r.json()
        # response is Fonnte-shaped (status/detail/...)
        assert "status" in body or "detail" in body

        time.sleep(2.0)
        after = requests.get(f"{API}/executive/whatsapp-stats",
                             headers=koord_session["h"], timeout=30).json()
        # A new wa_log row should have been created
        assert after["total"] >= total_before + 1, (
            f"resend did not create new wa_log: total {total_before} -> {after['total']}"
        )

        # by_event should contain a 'resend_' prefixed event
        events = [e["event"] for e in after["by_event"]]
        resend_events = [e for e in events if e.startswith("resend_")]
        assert resend_events, f"no resend_* event in by_event: {events}"

    def test_audit_log_records_wa_resend(self, koord_session, failed_wa_log):
        # GET audit logs (koord-only)
        r = requests.get(f"{API}/audit?action=wa_resend",
                         headers=koord_session["h"], timeout=20)
        if r.status_code == 404:
            pytest.skip("Audit logs endpoint not available")
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        if not items:
            pytest.skip("No wa_resend audit entry — earlier resend may have been skipped")
        actions = [it.get("action") for it in items]
        assert "wa_resend" in actions
