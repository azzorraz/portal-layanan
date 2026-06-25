"""End-to-end backend tests for Dapodik Ticketing API.

Covers: auth (login/logout/me/change-password), kecamatan, sekolah, operator,
layanan, tickets (create/list/get/status/comment/attachment/download), notifications,
dashboard stats, reports (Excel/PDF), role gating, and access control.
"""
import os
import base64
import io
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OP1 = {"email": "operator1@dapodik.id", "password": "operator123"}
OP2 = {"email": "operator2@dapodik.id", "password": "operator123"}
OP3 = {"email": "operator3@dapodik.id", "password": "operator123"}


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_koord(self):
        d = login(KOORD)
        assert d["user"]["role"] == "koordinator"
        assert d["token"]

    def test_login_op1(self):
        d = login(OP1)
        assert d["user"]["role"] == "operator"
        assert d["user"].get("sekolah_id")

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "x@y.z", "password": "bad"})
        assert r.status_code == 401

    def test_me(self):
        tok = login(KOORD)["token"]
        r = requests.get(f"{API}/auth/me", headers=hdr(tok))
        assert r.status_code == 200
        assert r.json()["email"] == KOORD["email"]

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_logout(self):
        tok = login(KOORD)["token"]
        r = requests.post(f"{API}/auth/logout", headers=hdr(tok))
        assert r.status_code == 200

    def test_change_password_wrong_old(self):
        tok = login(OP3)["token"]
        r = requests.post(f"{API}/auth/change-password",
                          headers=hdr(tok),
                          json={"old_password": "WRONG", "new_password": "newpass123"})
        assert r.status_code == 400


# ---------- Kecamatan ----------
class TestKecamatan:
    def test_list(self):
        tok = login(KOORD)["token"]
        r = requests.get(f"{API}/kecamatan", headers=hdr(tok))
        assert r.status_code == 200
        assert len(r.json()) >= 6

    def test_create_and_delete(self):
        tok = login(KOORD)["token"]
        nama = "TEST_Kec_Bogor_Selatan_X"
        r = requests.post(f"{API}/kecamatan", headers=hdr(tok), json={"nama": nama})
        assert r.status_code == 200, r.text
        kid = r.json()["id"]
        # cleanup
        d = requests.delete(f"{API}/kecamatan/{kid}", headers=hdr(tok))
        assert d.status_code == 200


# ---------- Sekolah ----------
class TestSekolah:
    def test_create_list(self):
        tok = login(KOORD)["token"]
        payload = {"nama": "TEST_Sekolah_X", "npsn": "TEST99999", "kecamatan": "Bogor Barat", "jenjang": "SD"}
        r = requests.post(f"{API}/sekolah", headers=hdr(tok), json=payload)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]
        # list
        lst = requests.get(f"{API}/sekolah", headers=hdr(tok)).json()
        assert any(s["id"] == sid for s in lst)
        # cleanup
        requests.delete(f"{API}/sekolah/{sid}", headers=hdr(tok))


# ---------- Layanan ----------
class TestLayanan:
    def test_list_default(self):
        tok = login(KOORD)["token"]
        r = requests.get(f"{API}/layanan", headers=hdr(tok))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 11

    def test_create_update_delete(self):
        tok = login(KOORD)["token"]
        r = requests.post(f"{API}/layanan", headers=hdr(tok),
                          json={"nama": "TEST_Layanan_X", "sla_days": 4})
        assert r.status_code == 200, r.text
        lid = r.json()["id"]
        u = requests.put(f"{API}/layanan/{lid}", headers=hdr(tok),
                         json={"nama": "TEST_Layanan_X", "sla_days": 7})
        assert u.status_code == 200
        assert u.json()["sla_days"] == 7
        d = requests.delete(f"{API}/layanan/{lid}", headers=hdr(tok))
        assert d.status_code == 200

    def test_operator_cannot_create_layanan(self):
        tok = login(OP1)["token"]
        r = requests.post(f"{API}/layanan", headers=hdr(tok), json={"nama": "x", "sla_days": 3})
        assert r.status_code == 403


# ---------- Operators (users) ----------
class TestOperators:
    def test_op_list_requires_koord(self):
        tok = login(OP1)["token"]
        r = requests.get(f"{API}/operators", headers=hdr(tok))
        assert r.status_code == 403

    def test_create_dup_email_and_dup_sekolah(self):
        tok = login(KOORD)["token"]
        # need a fresh sekolah
        s = requests.post(f"{API}/sekolah", headers=hdr(tok),
                          json={"nama": "TEST_S_OP", "npsn": "TESTOP123", "kecamatan": "Bogor Timur", "jenjang": "SD"}).json()
        sid = s["id"]
        try:
            payload = {"name": "TEST OP", "email": "TEST_op_new@dapodik.id", "password": "secret123", "sekolah_id": sid}
            r = requests.post(f"{API}/operators", headers=hdr(tok), json=payload)
            assert r.status_code == 200, r.text
            uid = r.json()["id"]
            # duplicate email
            r2 = requests.post(f"{API}/operators", headers=hdr(tok), json=payload)
            assert r2.status_code == 400
            # duplicate sekolah_id with new email
            r3 = requests.post(f"{API}/operators", headers=hdr(tok),
                               json={**payload, "email": "TEST_op_new2@dapodik.id"})
            assert r3.status_code == 400
            # cleanup user + sekolah
            requests.delete(f"{API}/operators/{uid}", headers=hdr(tok))
        finally:
            requests.delete(f"{API}/sekolah/{sid}", headers=hdr(tok))


# ---------- Tickets ----------
@pytest.fixture(scope="module")
def koord_tok():
    return login(KOORD)["token"]


@pytest.fixture(scope="module")
def op1_tok():
    return login(OP1)["token"]


@pytest.fixture(scope="module")
def op2_tok():
    return login(OP2)["token"]


@pytest.fixture(scope="module")
def created_ticket(op1_tok, koord_tok):
    # get a service id
    services = requests.get(f"{API}/layanan", headers=hdr(op1_tok)).json()
    lid = services[0]["id"]
    # small PNG base64 (1x1)
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    )
    payload = {
        "layanan_id": lid,
        "judul": "TEST Pengajuan otomatis",
        "deskripsi": "Deskripsi otomatis dari test backend.",
        "prioritas": "Normal",
        "attachments": [{"filename": "pixel.png", "mime": "image/png", "data_base64": png_b64}],
    }
    r = requests.post(f"{API}/tickets", headers=hdr(op1_tok), json=payload)
    assert r.status_code == 200, r.text
    return r.json()


class TestTickets:
    def test_create_returns_ticket_number_and_status(self, created_ticket):
        t = created_ticket
        assert t["status"] == "Diajukan"
        assert t["ticket_number"].startswith("TCK-")
        assert t["sla_state"] in ("tepat_waktu", "hampir_terlambat", "terlambat")

    def test_get_ticket_with_attachments(self, created_ticket, op1_tok):
        tid = created_ticket["id"]
        r = requests.get(f"{API}/tickets/{tid}", headers=hdr(op1_tok))
        assert r.status_code == 200
        d = r.json()
        assert len(d["attachments"]) >= 1
        assert any(a["kind"] == "created" for a in d["activities"])

    def test_operator_cannot_see_others(self, created_ticket, op2_tok):
        tid = created_ticket["id"]
        r = requests.get(f"{API}/tickets/{tid}", headers=hdr(op2_tok))
        assert r.status_code == 403

    def test_operator_only_sees_own_in_list(self, op2_tok):
        r = requests.get(f"{API}/tickets", headers=hdr(op2_tok))
        assert r.status_code == 200
        op2 = login(OP2)["user"]
        for it in r.json()["items"]:
            assert it["operator_id"] == op2["id"]

    def test_koord_can_filter_status(self, koord_tok):
        r = requests.get(f"{API}/tickets?status=Diajukan", headers=hdr(koord_tok))
        assert r.status_code == 200
        for it in r.json()["items"]:
            assert it["status"] == "Diajukan"

    def test_change_status_creates_activity_and_notif(self, created_ticket, koord_tok, op1_tok):
        tid = created_ticket["id"]
        r = requests.post(f"{API}/tickets/{tid}/status", headers=hdr(koord_tok),
                          json={"status": "Diproses", "catatan": "Sedang ditinjau"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Diproses"
        # operator should get notification
        n = requests.get(f"{API}/notifications", headers=hdr(op1_tok))
        assert n.status_code == 200
        assert n.json()["unread"] >= 1

    def test_comment(self, created_ticket, op1_tok, koord_tok):
        tid = created_ticket["id"]
        r = requests.post(f"{API}/tickets/{tid}/comments", headers=hdr(op1_tok),
                          json={"content": "TEST komentar"})
        assert r.status_code == 200
        # verify activity
        det = requests.get(f"{API}/tickets/{tid}", headers=hdr(op1_tok)).json()
        assert any(a["kind"] == "comment" and "TEST" in a["message"] for a in det["activities"])

    def test_change_to_selesai_sets_closed_at(self, created_ticket, koord_tok):
        tid = created_ticket["id"]
        r = requests.post(f"{API}/tickets/{tid}/status", headers=hdr(koord_tok),
                          json={"status": "Selesai"})
        assert r.status_code == 200
        det = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
        assert det["closed_at"]
        assert det["sla_state"] == "selesai"

    def test_attachment_download(self, created_ticket, op1_tok):
        tid = created_ticket["id"]
        det = requests.get(f"{API}/tickets/{tid}", headers=hdr(op1_tok)).json()
        aid = det["attachments"][0]["id"]
        r = requests.get(f"{API}/tickets/{tid}/attachments/{aid}/download", headers=hdr(op1_tok))
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/png")
        # PNG signature
        assert r.content[:4] == b"\x89PNG"

    def test_operator_cannot_change_status(self, created_ticket, op1_tok):
        tid = created_ticket["id"]
        r = requests.post(f"{API}/tickets/{tid}/status", headers=hdr(op1_tok),
                          json={"status": "Selesai"})
        assert r.status_code == 403


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats_shape(self, koord_tok):
        r = requests.get(f"{API}/dashboard/stats", headers=hdr(koord_tok))
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "today", "diproses", "revisi", "selesai", "ditolak", "sla", "monthly", "by_status"):
            assert k in d
        assert len(d["monthly"]) == 6
        assert set(d["sla"].keys()) == {"on_time", "almost", "late"}


# ---------- Reports ----------
class TestReports:
    def test_excel(self, koord_tok):
        r = requests.get(f"{API}/reports/excel", headers=hdr(koord_tok))
        assert r.status_code == 200
        assert "spreadsheetml.sheet" in r.headers["content-type"]
        # XLSX is zip; signature PK
        assert r.content[:2] == b"PK"

    def test_pdf(self, koord_tok):
        r = requests.get(f"{API}/reports/pdf", headers=hdr(koord_tok))
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"

    def test_reports_blocked_for_operator(self, op1_tok):
        r = requests.get(f"{API}/reports/excel", headers=hdr(op1_tok))
        assert r.status_code == 403
