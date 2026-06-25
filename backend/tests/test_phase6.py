"""Phase 6 backend tests — WhatsApp opt-out preference & executive WA stats.

Covers:
- PATCH /api/auth/preferences (toggle wa_opt_out)
- GET /api/executive/whatsapp-stats (koord only, includes timeline/by_event/etc)
- Date filtering on the stats endpoint
- notify_operator_wa skip-logic (operator_opted_out / no_phone)
- /api/admin/test-whatsapp now writes to wa_logs (event_type=test)
"""

import os
import asyncio
import time
import pytest
import requests
from unittest.mock import AsyncMock
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for tests run from backend container
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
def reset_optout_at_end(operator_session):
    # Ensure operator is opted-IN before tests and again after (cleanup)
    requests.patch(f"{API}/auth/preferences", headers=operator_session["h"], json={"wa_opt_out": False}, timeout=20)
    yield
    requests.patch(f"{API}/auth/preferences", headers=operator_session["h"], json={"wa_opt_out": False}, timeout=20)
    # Cleanup any TEST_PHASE6 tickets
    try:
        koord_token, _ = _login(KOORD)
        requests.post(f"{API}/admin/cleanup-test-tickets", headers=_h(koord_token), timeout=30)
    except Exception:
        pass


# ============================================================
# Auth Preferences (PATCH /api/auth/preferences)
# ============================================================
class TestAuthPreferences:
    def test_patch_preferences_opt_out_true(self, operator_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={"wa_opt_out": True},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("wa_opt_out") is True

        # GET /auth/me reflects
        me = requests.get(f"{API}/auth/me", headers=operator_session["h"], timeout=20)
        assert me.status_code == 200
        assert me.json().get("wa_opt_out") is True

    def test_patch_preferences_opt_out_false(self, operator_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={"wa_opt_out": False},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json().get("wa_opt_out") is False

        me = requests.get(f"{API}/auth/me", headers=operator_session["h"], timeout=20)
        assert me.status_code == 200
        # wa_opt_out can be False or missing — both equivalent
        assert not me.json().get("wa_opt_out")

    def test_preferences_requires_auth(self):
        r = requests.patch(f"{API}/auth/preferences", json={"wa_opt_out": True}, timeout=20)
        assert r.status_code in (401, 403)

    def test_preferences_validation_missing_field(self, operator_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={},
            timeout=20,
        )
        assert r.status_code in (400, 422)


# ============================================================
# GET /api/executive/whatsapp-stats
# ============================================================
class TestWhatsAppStats:
    def test_operator_forbidden(self, operator_session):
        r = requests.get(f"{API}/executive/whatsapp-stats", headers=operator_session["h"], timeout=30)
        assert r.status_code == 403

    def test_koord_returns_full_shape(self, koord_session):
        r = requests.get(f"{API}/executive/whatsapp-stats", headers=koord_session["h"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "total", "sent", "failed", "skipped", "success_rate",
            "sent_24h", "sent_7d", "sent_30d",
            "by_event", "recent_failures", "quota_remaining",
            "timeline",
        ]:
            assert k in d, f"missing key {k} in stats response: {list(d.keys())}"

        assert isinstance(d["total"], int)
        assert isinstance(d["sent"], int)
        assert isinstance(d["failed"], int)
        assert isinstance(d["skipped"], int)
        assert isinstance(d["success_rate"], (int, float))
        assert isinstance(d["by_event"], list)
        assert isinstance(d["recent_failures"], list)
        assert isinstance(d["timeline"], list)
        # 14 day timeline
        assert len(d["timeline"]) == 14
        for row in d["timeline"]:
            assert "date" in row and "sent" in row and "failed" in row
        assert len(d["recent_failures"]) <= 10
        # success rate consistency
        if d["total"]:
            expected = round((d["sent"] / d["total"]) * 100, 1)
            assert abs(d["success_rate"] - expected) < 0.2

    def test_date_filter_narrows(self, koord_session):
        # Use date range in 2000 — should yield 0 logs
        r = requests.get(
            f"{API}/executive/whatsapp-stats?from_date=2000-01-01&to_date=2000-01-02",
            headers=koord_session["h"], timeout=30,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 0
        assert d["sent"] == 0
        assert d["failed"] == 0

    def test_date_filter_today_returns_some(self, koord_session):
        today = datetime.now(timezone.utc).date().isoformat()
        r = requests.get(
            f"{API}/executive/whatsapp-stats?from_date={today}&to_date={today}",
            headers=koord_session["h"], timeout=30,
        )
        assert r.status_code == 200
        # only assert shape, not magnitude
        assert "total" in r.json()


# ============================================================
# /api/admin/test-whatsapp logs to wa_logs
# ============================================================
class TestAdminTestWhatsApp:
    def test_test_wa_writes_to_logs(self, koord_session, monkeypatch):
        # Monkey-patch send_whatsapp to avoid live quota burn
        # Since tests are out-of-process from backend, we instead use the
        # endpoint and rely on Fonnte being either disabled or assert ONLY the
        # log presence. We compare counters before/after.
        before = requests.get(
            f"{API}/executive/whatsapp-stats", headers=koord_session["h"], timeout=30,
        ).json()
        total_before = before["total"]

        # Use an invalid phone so Fonnte will fail-soft and we don't burn quota
        # OR send to a fixed test number; we use a clearly fake one to minimize spend.
        r = requests.post(
            f"{API}/admin/test-whatsapp",
            headers=koord_session["h"],
            json={"target": "62000000000000", "message": "TEST_PHASE6 unit test ping"},
            timeout=30,
        )
        assert r.status_code == 200, r.text

        time.sleep(0.5)
        after = requests.get(
            f"{API}/executive/whatsapp-stats", headers=koord_session["h"], timeout=30,
        ).json()
        assert after["total"] >= total_before + 1, "test-whatsapp did not create a wa_logs row"

        # event_type=test must be in by_event bucket
        events = [e["event"] for e in after["by_event"]]
        assert "test" in events, f"event_type 'test' not in by_event: {events}"

    def test_test_wa_forbidden_for_operator(self, operator_session):
        r = requests.post(
            f"{API}/admin/test-whatsapp",
            headers=operator_session["h"],
            json={"target": "6280000000", "message": "x"},
            timeout=20,
        )
        assert r.status_code == 403


# ============================================================
# notify_operator_wa skip-logic via real ticket creation
# Operator opts OUT, then creates a ticket → wa_logs gets
# skipped=True detail='operator_opted_out'
# ============================================================
class TestOptOutSkipsWhatsApp:
    def test_opt_out_skips_send_on_create(self, koord_session, operator_session, first_layanan):
        # 1. Opt out operator
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={"wa_opt_out": True},
            timeout=20,
        )
        assert r.status_code == 200

        # 2. Snapshot stats
        before = requests.get(
            f"{API}/executive/whatsapp-stats",
            headers=koord_session["h"],
            timeout=30,
        ).json()
        quota_before = before.get("quota_remaining")
        skipped_before = before.get("skipped", 0)

        # 3. Create ticket as operator WITH a phone — but opt-out should skip live send
        payload = {
            "layanan_id": first_layanan["id"],
            "judul": "TEST_PHASE6 opt-out ticket",
            "deskripsi": "TEST_PHASE6 deskripsi opt-out",
            "prioritas": "Normal",
            "form_data": {"no_whatsapp": "6281234567890"},
        }
        cr = requests.post(f"{API}/tickets", headers=operator_session["h"], json=payload, timeout=30)
        assert cr.status_code in (200, 201), cr.text
        ticket = cr.json()
        ticket_number = ticket.get("ticket_number")
        assert ticket_number

        # 4. Wait briefly for the async insert
        time.sleep(1.0)

        # 5. Check stats — skipped should have grown by at least 1; quota unchanged
        after = requests.get(
            f"{API}/executive/whatsapp-stats",
            headers=koord_session["h"],
            timeout=30,
        ).json()
        assert after.get("skipped", 0) >= skipped_before + 1, (
            f"skipped did not increment after opt-out create: before={skipped_before} after={after.get('skipped')}"
        )

        # quota_remaining MAY be None on either side; only assert non-decrease if both ints
        if isinstance(quota_before, int) and isinstance(after.get("quota_remaining"), int):
            assert after["quota_remaining"] >= quota_before, (
                f"WA quota decreased while operator was opted-out: {quota_before} -> {after['quota_remaining']}"
            )

    def test_opt_in_again_enables_send(self, operator_session):
        r = requests.patch(
            f"{API}/auth/preferences",
            headers=operator_session["h"],
            json={"wa_opt_out": False},
            timeout=20,
        )
        assert r.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=operator_session["h"], timeout=20).json()
        assert not me.get("wa_opt_out")


# ============================================================
# notify_operator_wa: no phone => skipped=no_phone
# ============================================================
class TestNoPhoneSkip:
    def test_create_without_phone_logs_no_phone_skip(self, koord_session, operator_session, first_layanan):
        # Ensure opted-in so the no-phone branch is what triggers the skip
        requests.patch(f"{API}/auth/preferences", headers=operator_session["h"], json={"wa_opt_out": False}, timeout=20)

        before = requests.get(
            f"{API}/executive/whatsapp-stats", headers=koord_session["h"], timeout=30,
        ).json()
        skipped_before = before.get("skipped", 0)

        payload = {
            "layanan_id": first_layanan["id"],
            "judul": "TEST_PHASE6 no-phone ticket",
            "deskripsi": "TEST_PHASE6 no phone",
            "prioritas": "Normal",
            "form_data": {},  # NO no_whatsapp
        }
        cr = requests.post(f"{API}/tickets", headers=operator_session["h"], json=payload, timeout=30)
        assert cr.status_code in (200, 201), cr.text

        time.sleep(1.0)
        after = requests.get(
            f"{API}/executive/whatsapp-stats", headers=koord_session["h"], timeout=30,
        ).json()
        assert after.get("skipped", 0) >= skipped_before + 1
