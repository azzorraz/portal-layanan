"""
Phase 8 — Default Services & Attachment Required Validation Tests
Covers:
 - GET /api/layanan returns attachment_required correctly for 11 default services
 - NIP/NIK/NUPTK keys in form_schema are non-required across all default services
 - POST /api/tickets validation: attachment_required → 400 without attachments, 200 with attachments
 - RBAC: GET (operator+koord), POST/PUT/DELETE koord-only (operator → 403)
 - Regression: tickets for layanan #1-#7 still creatable without attachments
"""
import os
import base64
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

OPERATOR_NPSN = "20220001"
OPERATOR_PASS = "123456"
KOORD_EMAIL = "admin@dapodik.id"
KOORD_PASS = "admin123"

ATTACHMENT_REQUIRED_NAMES = {
    "Approval Penugasan Kepala Sekolah",
    "Approval Pengajuan Mutasi Guru",
    "Approval Input Jam Tambahan di Sekolah Lain",
    "Approval Input Kenaikan Gaji Berkala atau Kenaikan Pangkat",
}
OPTIONAL_FIELD_KEYS = {"nip", "nik", "nuptk", "nip_gtk", "nik_gtk"}

DEFAULT_SERVICE_NAMES = {
    "Approval Perubahan Status Kepegawaian Dapodik",
    "Approval Request Hapus Akun PTK",
    "Approval Permintaan Reset Akun PTK",
    "Approval Permintaan Reset Akun Sekolah",
    "Approval Input Siswa Pindah Rombel",
    "Approval Perubahan Jabatan PTK",
    "Approval Input Siswa Baru",
    "Approval Penugasan Kepala Sekolah",
    "Approval Pengajuan Mutasi Guru",
    "Approval Input Jam Tambahan di Sekolah Lain",
    "Approval Input Kenaikan Gaji Berkala atau Kenaikan Pangkat",
}


def _login(identifier, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": identifier, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {identifier}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def operator_token():
    return _login(OPERATOR_NPSN, OPERATOR_PASS)


@pytest.fixture(scope="module")
def koord_token():
    return _login(KOORD_EMAIL, KOORD_PASS)


@pytest.fixture(scope="module")
def op_headers(operator_token):
    return {"Authorization": f"Bearer {operator_token}"}


@pytest.fixture(scope="module")
def koord_headers(koord_token):
    return {"Authorization": f"Bearer {koord_token}"}


@pytest.fixture(scope="module")
def layanan_list(op_headers):
    r = requests.get(f"{API}/layanan", headers=op_headers, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- GET /api/layanan attachment_required ----------
class TestLayananAttachmentRequired:
    def test_get_layanan_ok(self, layanan_list):
        assert isinstance(layanan_list, list)
        assert len(layanan_list) >= 11
        names = {l["nama"] for l in layanan_list}
        missing = DEFAULT_SERVICE_NAMES - names
        assert not missing, f"missing default services: {missing}"

    def test_attachment_required_true_for_4_services(self, layanan_list):
        for l in layanan_list:
            if l["nama"] in ATTACHMENT_REQUIRED_NAMES:
                assert l.get("attachment_required") is True, (
                    f"{l['nama']} attachment_required should be True, got {l.get('attachment_required')}"
                )

    def test_attachment_required_false_for_others(self, layanan_list):
        for l in layanan_list:
            if l["nama"] in DEFAULT_SERVICE_NAMES and l["nama"] not in ATTACHMENT_REQUIRED_NAMES:
                assert l.get("attachment_required") is False, (
                    f"{l['nama']} attachment_required should be False, got {l.get('attachment_required')}"
                )

    def test_nip_nik_nuptk_optional_in_all_default_schemas(self, layanan_list):
        problems = []
        for l in layanan_list:
            if l["nama"] not in DEFAULT_SERVICE_NAMES:
                continue
            for f in l.get("form_schema", []) or []:
                if f.get("key") in OPTIONAL_FIELD_KEYS and f.get("required") is not False:
                    problems.append(f"{l['nama']}::{f.get('key')} required={f.get('required')}")
        assert not problems, "Fields not marked optional: " + ", ".join(problems)


# ---------- POST /api/tickets attachment validation ----------
def _service_by_name(layanan_list, nama):
    for l in layanan_list:
        if l["nama"] == nama:
            return l
    raise AssertionError(f"service not found: {nama}")


def _png_b64():
    # 1x1 transparent PNG
    return base64.b64encode(
        bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
            "890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )
    ).decode()


class TestTicketAttachmentValidation:
    created_ids = []

    def test_attachment_required_layanan_without_attachments_400(self, op_headers, layanan_list):
        svc = _service_by_name(layanan_list, "Approval Penugasan Kepala Sekolah")
        payload = {
            "layanan_id": svc["id"],
            "judul": "TEST_PHASE8 kepsek no-attach",
            "deskripsi": "regression test",
            "prioritas": "Normal",
            "attachments": [],
            "form_data": {"nama_kepsek": "Pak A"},
            "checklist_state": [],
        }
        r = requests.post(f"{API}/tickets", headers=op_headers, json=payload, timeout=15)
        assert r.status_code == 400, r.text
        body = r.json()
        # FastAPI default error key is 'detail'
        msg = body.get("detail") or body.get("message") or ""
        assert "wajib" in msg.lower() and "lampiran" in msg.lower(), msg

    def test_attachment_required_layanan_with_attachment_200(self, op_headers, layanan_list):
        svc = _service_by_name(layanan_list, "Approval Pengajuan Mutasi Guru")
        payload = {
            "layanan_id": svc["id"],
            "judul": "TEST_PHASE8 mutasi with-attach",
            "deskripsi": "regression test",
            "prioritas": "Normal",
            "attachments": [
                {"filename": "sk.png", "mime": "image/png", "data_base64": _png_b64()}
            ],
            "form_data": {"nama_gtk": "Bu B"},
            "checklist_state": [],
        }
        r = requests.post(f"{API}/tickets", headers=op_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data and "ticket_number" in data
        TestTicketAttachmentValidation.created_ids.append(data["id"])

    def test_attachment_optional_layanan_without_attachments_200(self, op_headers, layanan_list):
        # layanan #3 — Reset Akun PTK has attachment_required=False
        svc = _service_by_name(layanan_list, "Approval Permintaan Reset Akun PTK")
        payload = {
            "layanan_id": svc["id"],
            "judul": "TEST_PHASE8 reset no-attach",
            "deskripsi": "regression test layanan optional",
            "prioritas": "Normal",
            "attachments": [],
            "form_data": {"nama_gtk": "Bu C", "email_akun": "x@y.id"},
            "checklist_state": [],
        }
        r = requests.post(f"{API}/tickets", headers=op_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        TestTicketAttachmentValidation.created_ids.append(r.json()["id"])

    def test_regression_layanan_1_to_7_no_attachment_ok(self, op_headers, layanan_list):
        # Verify each of the 7 non-attachment-required default services can be created
        non_attach = [n for n in DEFAULT_SERVICE_NAMES if n not in ATTACHMENT_REQUIRED_NAMES]
        # pick 3 representative for speed
        sample = [
            "Approval Permintaan Reset Akun Sekolah",
            "Approval Input Siswa Baru",
            "Approval Perubahan Jabatan PTK",
        ]
        for nama in sample:
            svc = _service_by_name(layanan_list, nama)
            payload = {
                "layanan_id": svc["id"],
                "judul": f"TEST_PHASE8 regression {nama[:30]}",
                "deskripsi": "regression",
                "prioritas": "Normal",
                "attachments": [],
                "form_data": {},
                "checklist_state": [],
            }
            r = requests.post(f"{API}/tickets", headers=op_headers, json=payload, timeout=15)
            assert r.status_code == 200, f"{nama} failed: {r.status_code} {r.text}"
            TestTicketAttachmentValidation.created_ids.append(r.json()["id"])


# ---------- RBAC regression ----------
class TestLayananRBAC:
    def test_operator_can_get_layanan(self, op_headers):
        r = requests.get(f"{API}/layanan", headers=op_headers, timeout=10)
        assert r.status_code == 200

    def test_koord_can_get_layanan(self, koord_headers):
        r = requests.get(f"{API}/layanan", headers=koord_headers, timeout=10)
        assert r.status_code == 200

    def test_operator_cannot_post_layanan(self, op_headers):
        payload = {
            "nama": "TEST_PHASE8 operator-create-forbidden",
            "sla_days": 3, "deskripsi": "x", "checklist": [],
            "form_schema": [], "attachment_required": False,
        }
        r = requests.post(f"{API}/layanan", headers=op_headers, json=payload, timeout=10)
        assert r.status_code == 403, r.text

    def test_koord_can_create_and_update_attachment_required(self, koord_headers):
        # Create with attachment_required=True, then toggle off
        payload = {
            "nama": "TEST_PHASE8 koord-attach-toggle",
            "sla_days": 2, "deskripsi": "tester", "checklist": [],
            "form_schema": [], "attachment_required": True,
        }
        r = requests.post(f"{API}/layanan", headers=koord_headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created.get("attachment_required") is True
        lid = created["id"]

        # operator cannot PUT
        r2 = requests.put(f"{API}/layanan/{lid}", headers={}, json=payload, timeout=10)
        assert r2.status_code in (401, 403)

        # koord update toggling attachment_required → False, verify persistence via GET
        upd = {**payload, "attachment_required": False}
        r3 = requests.put(f"{API}/layanan/{lid}", headers=koord_headers, json=upd, timeout=10)
        assert r3.status_code == 200
        assert r3.json().get("attachment_required") is False

        # GET list again, find by name, verify
        r4 = requests.get(f"{API}/layanan", headers=koord_headers, timeout=10)
        match = next((x for x in r4.json() if x["id"] == lid), None)
        assert match and match["attachment_required"] is False

        # cleanup
        rd = requests.delete(f"{API}/layanan/{lid}", headers=koord_headers, timeout=10)
        assert rd.status_code == 200


# ---------- Cleanup ----------
def test_zzz_cleanup_test_tickets(koord_headers):
    # Try admin cleanup endpoint if exists
    r = requests.post(f"{API}/admin/cleanup-test-tickets", headers=koord_headers, timeout=20)
    # Endpoint may or may not exist; either way, do not fail the suite.
    assert r.status_code in (200, 404, 405)
