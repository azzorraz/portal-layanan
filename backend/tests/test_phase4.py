"""Phase 4 backend tests: bulk-delete, bulk-priority, dynamic form (layanan.form_schema, ticket.form_data)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OP1 = {"email": "operator1@dapodik.id", "password": "operator123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def koord_tok():
    return _login(KOORD)["token"]


@pytest.fixture(scope="module")
def op1_tok():
    return _login(OP1)["token"]


@pytest.fixture(scope="module")
def layanan_list(koord_tok):
    r = requests.get(f"{API}/layanan", headers=hdr(koord_tok))
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def layanan_id(layanan_list):
    return layanan_list[0]["id"]


def _create_tickets(op_tok, lid, n=3, prefix="TEST_P4", form_data=None):
    ids = []
    nums = []
    for i in range(n):
        payload = {
            "layanan_id": lid,
            "judul": f"{prefix}_{i}",
            "deskripsi": f"phase4 ticket {i}",
            "prioritas": "Normal",
            "attachments": [],
            "checklist_state": [],
            "form_data": form_data or {},
        }
        r = requests.post(f"{API}/tickets", headers=hdr(op_tok), json=payload)
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])
        nums.append(r.json()["ticket_number"])
    return ids, nums


# ---------------- BULK DELETE ----------------
class TestBulkDelete:
    def test_empty_array_returns_422(self, koord_tok):
        r = requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": []})
        assert r.status_code == 422

    def test_operator_forbidden(self, op1_tok, layanan_id):
        # Create one to give a valid id (operator owns these)
        ids, _ = _create_tickets(op1_tok, layanan_id, n=1, prefix="TEST_P4_DEL_GUARD")
        r = requests.post(f"{API}/tickets/bulk-delete", headers=hdr(op1_tok), json={"ticket_ids": ids})
        assert r.status_code == 403
        # cleanup via koord
        koord = _login(KOORD)["token"]
        requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord), json={"ticket_ids": ids})

    def test_bulk_delete_success_and_cascade(self, koord_tok, op1_tok, layanan_id):
        ids, nums = _create_tickets(op1_tok, layanan_id, n=3, prefix="TEST_P4_DEL")
        # also touch one to create activities (status change)
        first = ids[0]
        r = requests.post(f"{API}/tickets/{first}/status", headers=hdr(koord_tok),
                          json={"status": "Diproses", "catatan": "for cascade test"})
        assert r.status_code == 200, r.text

        # Delete
        r = requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": ids})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["deleted"] == len(ids)

        # Verify GET on each returns 404
        for tid in ids:
            g = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok))
            assert g.status_code == 404, f"Ticket {tid} should be gone, got {g.status_code}"

    def test_bulk_delete_audit_log(self, koord_tok):
        r = requests.get(f"{API}/audit", headers=hdr(koord_tok), params={"action": "bulk_delete", "limit": 5})
        assert r.status_code == 200
        body = r.json()
        items = body.get("items", body) if isinstance(body, dict) else body
        assert len(items) >= 1
        assert items[0]["action"] == "bulk_delete"

    def test_bulk_delete_nonexistent_ids(self, koord_tok):
        # All invalid → deleted=0 still 200
        r = requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok),
                          json={"ticket_ids": ["000000000000000000000000"]})
        assert r.status_code == 200
        assert r.json()["deleted"] == 0


# ---------------- BULK PRIORITY ----------------
class TestBulkPriority:
    def test_empty_array_returns_422(self, koord_tok):
        r = requests.post(f"{API}/tickets/bulk-priority", headers=hdr(koord_tok),
                          json={"ticket_ids": [], "prioritas": "Tinggi"})
        assert r.status_code == 422

    def test_invalid_prioritas_returns_422(self, koord_tok, op1_tok, layanan_id):
        ids, _ = _create_tickets(op1_tok, layanan_id, n=1, prefix="TEST_P4_PRIO_INV")
        r = requests.post(f"{API}/tickets/bulk-priority", headers=hdr(koord_tok),
                          json={"ticket_ids": ids, "prioritas": "Bogus"})
        assert r.status_code == 422
        # cleanup
        requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": ids})

    def test_operator_forbidden(self, op1_tok, layanan_id, koord_tok):
        ids, _ = _create_tickets(op1_tok, layanan_id, n=1, prefix="TEST_P4_PRIO_GUARD")
        r = requests.post(f"{API}/tickets/bulk-priority", headers=hdr(op1_tok),
                          json={"ticket_ids": ids, "prioritas": "Tinggi"})
        assert r.status_code == 403
        requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": ids})

    def test_bulk_priority_success(self, koord_tok, op1_tok, layanan_id):
        ids, _ = _create_tickets(op1_tok, layanan_id, n=3, prefix="TEST_P4_PRIO")
        try:
            r = requests.post(f"{API}/tickets/bulk-priority", headers=hdr(koord_tok),
                              json={"ticket_ids": ids, "prioritas": "Tinggi"})
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["ok"] is True
            assert body["updated"] == len(ids)
            # Verify each
            for tid in ids:
                t = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok)).json()
                assert t["prioritas"] == "Tinggi"
            # Activity meta.bulk=true
            acts = requests.get(f"{API}/tickets/{ids[0]}", headers=hdr(koord_tok)).json().get("activities", [])
            pc = [a for a in acts if a.get("kind") == "priority_change"]
            assert any((a.get("meta") or {}).get("bulk") is True for a in pc)
            # Audit log
            au = requests.get(f"{API}/audit", headers=hdr(koord_tok), params={"action": "bulk_priority", "limit": 5}).json()
            items = au.get("items", au) if isinstance(au, dict) else au
            assert len(items) >= 1 and items[0]["action"] == "bulk_priority"
        finally:
            requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": ids})

    def test_bulk_priority_skips_already_target(self, koord_tok, op1_tok, layanan_id):
        ids, _ = _create_tickets(op1_tok, layanan_id, n=2, prefix="TEST_P4_PRIO_SKIP")
        try:
            r = requests.post(f"{API}/tickets/bulk-priority", headers=hdr(koord_tok),
                              json={"ticket_ids": ids, "prioritas": "Normal"})
            assert r.status_code == 200
            # Already Normal → updated should be 0
            assert r.json()["updated"] == 0
        finally:
            requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": ids})


# ---------------- DYNAMIC FORM ----------------
class TestLayananFormSchema:
    def test_layanan_returns_form_schema(self, layanan_list):
        assert isinstance(layanan_list, list) and len(layanan_list) > 0
        for l in layanan_list:
            assert "form_schema" in l, f"Layanan {l.get('nama')} missing form_schema key"
            assert isinstance(l["form_schema"], list)

    def test_mutasi_guru_has_seeded_schema(self, layanan_list):
        mutasi = next((l for l in layanan_list if "Mutasi Guru" in l["nama"]), None)
        if mutasi is None:
            pytest.skip("'Approval Pengajuan Mutasi Guru' layanan not present in seed")
        schema = mutasi["form_schema"]
        assert len(schema) >= 10, f"Expected >=10 fields, got {len(schema)}"
        keys = {f["key"] for f in schema}
        expected = {"nama_sekolah", "nama_operator", "no_whatsapp", "nama_gtk", "nip",
                    "nik", "nuptk", "no_sk", "tanggal_sk", "tmt_tugas",
                    "diangkat_sebagai", "mapel", "unit_kerja_lama", "unit_kerja_baru", "upload_sk_ktp"}
        missing = expected - keys
        assert not missing, f"Missing keys: {missing}"
        # diangkat_sebagai must be select with options Guru/Tenaga Kependidikan
        diangkat = next(f for f in schema if f["key"] == "diangkat_sebagai")
        assert diangkat["type"] == "select"
        assert "Guru" in diangkat["options"]
        assert "Tenaga Kependidikan" in diangkat["options"]

    def test_field_shape(self, layanan_list):
        any_with_schema = next((l for l in layanan_list if l["form_schema"]), None)
        if not any_with_schema:
            pytest.skip("no layanan with schema")
        f = any_with_schema["form_schema"][0]
        for k in ("key", "label", "type", "required", "options"):
            assert k in f, f"FormField missing {k}"


class TestLayananCRUDSchema:
    def test_create_layanan_with_schema(self, koord_tok):
        payload = {
            "nama": "TEST_P4_LAY_SCHEMA",
            "sla_days": 5,
            "deskripsi": "test schema persistence",
            "checklist": ["a", "b"],
            "form_schema": [
                {"key": "nama_pemohon", "label": "Nama Pemohon", "type": "text", "required": True, "options": []},
                {"key": "jenis", "label": "Jenis", "type": "select", "required": True, "options": ["A", "B"]},
            ],
        }
        r = requests.post(f"{API}/layanan", headers=hdr(koord_tok), json=payload)
        assert r.status_code == 200, r.text
        created = r.json()
        lid = created["id"]
        try:
            assert len(created["form_schema"]) == 2
            assert created["form_schema"][1]["type"] == "select"
            assert created["form_schema"][1]["options"] == ["A", "B"]

            # Update — add field, modify another
            upd = {
                **payload,
                "form_schema": [
                    {"key": "nama_pemohon", "label": "Nama Pemohon (Updated)", "type": "text", "required": True, "options": []},
                    {"key": "jenis", "label": "Jenis", "type": "select", "required": False, "options": ["A", "B", "C"]},
                    {"key": "catatan", "label": "Catatan", "type": "textarea", "required": False, "options": []},
                ],
            }
            r2 = requests.put(f"{API}/layanan/{lid}", headers=hdr(koord_tok), json=upd)
            assert r2.status_code == 200, r2.text
            updated = r2.json()
            assert len(updated["form_schema"]) == 3
            assert updated["form_schema"][0]["label"] == "Nama Pemohon (Updated)"
            assert updated["form_schema"][1]["required"] is False
            assert "C" in updated["form_schema"][1]["options"]
        finally:
            requests.delete(f"{API}/layanan/{lid}", headers=hdr(koord_tok))


class TestTicketFormData:
    def test_create_ticket_persists_form_data(self, op1_tok, koord_tok, layanan_list):
        # Pick layanan with schema if exists, else any
        lay = next((l for l in layanan_list if l["form_schema"]), layanan_list[0])
        lid = lay["id"]
        sample = {
            "nama_sekolah": "SDN 01 Bogor Tengah",
            "nama_operator": "Budi Santoso",
            "nama_gtk": "Pak Joko",
            "nip": "1234567890",
            "diangkat_sebagai": "Guru",
        }
        payload = {
            "layanan_id": lid, "judul": "TEST_P4_FORMDATA",
            "deskripsi": "form_data persistence", "prioritas": "Normal",
            "attachments": [], "checklist_state": [], "form_data": sample,
        }
        r = requests.post(f"{API}/tickets", headers=hdr(op1_tok), json=payload)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        try:
            g = requests.get(f"{API}/tickets/{tid}", headers=hdr(koord_tok))
            assert g.status_code == 200
            t = g.json()
            assert "form_data" in t
            for k, v in sample.items():
                assert t["form_data"].get(k) == v, f"key {k} mismatch"
        finally:
            requests.post(f"{API}/tickets/bulk-delete", headers=hdr(koord_tok), json={"ticket_ids": [tid]})
