"""Phase 9 — Auth (NPSN operator + admin koord) tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- Operator NPSN login ----
def test_operator_npsn_login_success(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220001", "password": "123456"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 0
    assert data["user"]["role"] == "operator"
    assert data["user"]["name"] == "Budi Santoso"
    assert data["user"].get("sekolah_id")
    assert "_id" not in data["user"]


def test_operator_npsn_2_login(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220002", "password": "123456"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["name"] == "Siti Aminah"


def test_operator_npsn_3_login(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220003", "password": "123456"})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["name"] == "Ahmad Rifai"


# ---- Koord admin login ----
def test_koord_admin_login_success(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "admin@dapodik.id", "password": "admin123"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "koordinator"
    assert data["user"]["email"] == "admin@dapodik.id"
    assert "token" in data


# ---- Legacy koord must be deactivated ----
def test_legacy_koord_inactive(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "koordinator@dapodik.id", "password": "koordinator123"})
    assert r.status_code == 401, f"Legacy koord should be inactive: {r.status_code} {r.text}"


# ---- Negative cases ----
def test_unknown_npsn_returns_401(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "99999999", "password": "123456"})
    assert r.status_code == 401
    assert "salah" in r.json().get("detail", "").lower()


def test_known_npsn_wrong_password_returns_401(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220001", "password": "wrongpass"})
    assert r.status_code == 401


def test_known_admin_wrong_password_returns_401(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "admin@dapodik.id", "password": "wrongpass"})
    assert r.status_code == 401


# ---- auth/me works after login ----
def test_auth_me_after_operator_login(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220001", "password": "123456"})
    token = r.json()["token"]
    me = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["role"] == "operator"
    # Should be enriched with sekolah
    assert me.json().get("sekolah", {}).get("npsn") == "20220001"


# ---- Regression: operator can create ticket; attachment_required still enforced ----
def test_regression_attachment_required_still_enforced(s):
    r = s.post(f"{API}/auth/login", json={"identifier": "20220001", "password": "123456"})
    token = r.json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    services = s.get(f"{API}/layanan", headers=h).json()
    # Find one service with attachment_required=true
    req_svc = next((sv for sv in services if sv.get("attachment_required")), None)
    assert req_svc is not None, "Expected at least 1 service with attachment_required=true"
    # Try to create ticket without attachment → 400
    payload = {
        "layanan_id": req_svc["id"],
        "judul": "TEST_PHASE9 regression",
        "deskripsi": "regression check",
        "form_data": {"nama_operator": "Budi", "nama_sekolah": "SDN 01", "npsn": "20220001"},
        "attachments": [],
    }
    r2 = s.post(f"{API}/tickets", json=payload, headers=h)
    assert r2.status_code == 400, r2.text
    assert "lampiran" in r2.json().get("detail", "").lower()
