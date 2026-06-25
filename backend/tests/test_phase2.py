"""Phase 2 backend tests: Assignment, Checklist, KB, Audit log, Executive stats, Pagination."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://dapodik-approval.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

KOORD = {"email": "koordinator@dapodik.id", "password": "koordinator123"}
OP1 = {"email": "operator1@dapodik.id", "password": "operator123"}
OP2 = {"email": "operator2@dapodik.id", "password": "operator123"}


def login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def koord_tok():
    return login(KOORD)["token"]


@pytest.fixture(scope="module")
def op1_tok():
    return login(OP1)["token"]


@pytest.fixture(scope="module")
def op2_tok():
    return login(OP2)["token"]


# ---------- Layanan checklist ----------
class TestLayananChecklist:
    def test_layanan_has_checklist_field(self, koord_tok):
        r = requests.get(f"{API}/layanan", headers=hdr(koord_tok))
        assert r.status_code == 200
        items = r.json()
        # at least one default layanan should have checklist seeded
        with_cl = [i for i in items if i.get("checklist")]
        assert len(with_cl) >= 1
        assert isinstance(with_cl[0]["checklist"], list)
        assert all(isinstance(x, str) for x in with_cl[0]["checklist"])

    def test_create_layanan_with_checklist(self, koord_tok):
        payload = {"nama": "TEST_LAY_CL", "sla_days": 3, "checklist": ["A", "B", "C"]}
        r = requests.post(f"{API}/layanan", headers=hdr(koord_tok), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checklist"] == ["A", "B", "C"]
        # update
        u = requests.put(f"{API}/layanan/{d['id']}", headers=hdr(koord_tok),
                         json={"nama": "TEST_LAY_CL", "sla_days": 3, "checklist": ["A", "B"]})
        assert u.status_code == 200
        assert u.json()["checklist"] == ["A", "B"]
        # verify via GET
        items = requests.get(f"{API}/layanan", headers=hdr(koord_tok)).json()
        match = next(i for i in items if i["id"] == d["id"])
        assert match["checklist"] == ["A", "B"]
        # cleanup
        requests.delete(f"{API}/layanan/{d['id']}", headers=hdr(koord_tok))


# ---------- Tickets: create with checklist + checklist update + assignment ----------
@pytest.fixture(scope="module")
def reset_layanan(koord_tok):
    """Returns a layanan with non-empty checklist."""
    items = requests.get(f"{API}/layanan", headers=hdr(koord_tok)).json()
    for it in items:
        if "Reset Akun PTK" in it["nama"] and it.get("checklist"):
            return it
    # fallback: any with checklist
    return next(i for i in items if i.get("checklist"))


@pytest.fixture(scope="module")
def ticket_with_checklist(op1_tok, reset_layanan):
    payload = {
        "layanan_id": reset_layanan["id"],
        "judul": "TEST checklist & assignment",
        "deskripsi": "phase 2 backend test",
        "prioritas": "Normal",
        "checklist_state": [
            {"label": label, "checked": (i == 0)} for i, label in enumerate(reset_layanan["checklist"])
        ],
    }
    r = requests.post(f"{API}/tickets", headers=hdr(op1_tok), json=payload)
    assert r.status_code == 200, r.text
    return r.json()


class TestTicketChecklist:
    def test_create_persists_checklist(self, ticket_with_checklist, reset_layanan):
        t = ticket_with_checklist
        assert isinstance(t.get("checklist"), list)
        assert len(t["checklist"]) == len(reset_layanan["checklist"])
        assert t["checklist"][0]["checked"] is True
        assert t["checklist"][1]["checked"] is False

    def test_create_seeds_checklist_when_state_absent(self, op1_tok, reset_layanan):
        # operator1 may already have one ticket; create another type that has checklist seeded
        r = requests.post(f"{API}/tickets", headers=hdr(op1_tok), json={
            "layanan_id": reset_layanan["id"],
            "judul": "TEST seed checklist auto",
            "deskripsi": "no checklist_state given",
            "prioritas": "Normal",
        })
        assert r.status_code == 200
        d = r.json()
        assert len(d["checklist"]) == len(reset_layanan["checklist"])
        assert all(item["checked"] is False for item in d["checklist"])

    def test_update_checklist_via_endpoint(self, ticket_with_checklist, op1_tok):
        tid = ticket_with_checklist["id"]
        new_items = [{"label": c["label"], "checked": True} for c in ticket_with_checklist["checklist"]]
        r = requests.post(f"{API}/tickets/{tid}/checklist", headers=hdr(op1_tok),
                          json={"items": new_items})
        assert r.status_code == 200, r.text
        # verify persistence via GET
        det = requests.get(f"{API}/tickets/{tid}", headers=hdr(op1_tok)).json()
        assert all(c["checked"] for c in det["checklist"])
        # activity log
        assert any(a["kind"] == "checklist" for a in det["activities"])

    def test_op2_cannot_update_others_checklist(self, ticket_with_checklist, op2_tok):
        tid = ticket_with_checklist["id"]
        r = requests.post(f"{API}/tickets/{tid}/checklist", headers=hdr(op2_tok),
                          json={"items": [{"label": "x", "checked": True}]})
        assert r.status_code == 403


# ---------- Koordinator list & assignment ----------
class TestAssignment:
    def test_list_koordinators_requires_koord(self, op1_tok):
        r = requests.get(f"{API}/koordinators", headers=hdr(op1_tok))
        assert r.status_code == 403

    def test_assignment_flow(self, ticket_with_checklist, koord_tok, op1_tok):
        tid = ticket_with_checklist["id"]
        # get a koordinator id
        koords = requests.get(f"{API}/koordinators", headers=hdr(koord_tok)).json()
        assert len(koords) >= 1
        assignee = koords[0]
        r = requests.post(f"{API}/tickets/{tid}/assign", headers=hdr(koord_tok),
                          json={"assignee_id": assignee["id"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["assignee_id"] == assignee["id"]
        assert body["assignee_name"] == assignee.get("name") or body["assignee_name"] == assignee.get("email")
        # verify via GET
        det = requests.get(f"{API}/tickets/{tid}", headers=hdr(op1_tok)).json()
        assert det["assignee_id"] == assignee["id"]
        assert any(a["kind"] == "assign" for a in det["activities"])

    def test_unassign(self, ticket_with_checklist, koord_tok):
        tid = ticket_with_checklist["id"]
        r = requests.post(f"{API}/tickets/{tid}/assign", headers=hdr(koord_tok),
                          json={"assignee_id": None})
        assert r.status_code == 200
        assert r.json()["assignee_id"] is None

    def test_operator_cannot_assign(self, ticket_with_checklist, op1_tok):
        tid = ticket_with_checklist["id"]
        r = requests.post(f"{API}/tickets/{tid}/assign", headers=hdr(op1_tok), json={"assignee_id": None})
        assert r.status_code == 403


# ---------- Pagination on /tickets ----------
class TestPagination:
    def test_limit_skip(self, koord_tok):
        r1 = requests.get(f"{API}/tickets?limit=5&skip=0", headers=hdr(koord_tok))
        assert r1.status_code == 200
        d1 = r1.json()
        assert "items" in d1 and "total" in d1
        assert len(d1["items"]) <= 5
        if d1["total"] > 5:
            r2 = requests.get(f"{API}/tickets?limit=5&skip=5", headers=hdr(koord_tok))
            d2 = r2.json()
            ids1 = {i["id"] for i in d1["items"]}
            ids2 = {i["id"] for i in d2["items"]}
            assert ids1.isdisjoint(ids2)


# ---------- Executive stats ----------
class TestExecutive:
    def test_executive_requires_koord(self, op1_tok):
        r = requests.get(f"{API}/executive/stats", headers=hdr(op1_tok))
        assert r.status_code == 403

    def test_executive_shape(self, koord_tok):
        r = requests.get(f"{API}/executive/stats", headers=hdr(koord_tok))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "selesai", "ditolak", "diproses",
                  "by_kecamatan", "by_layanan", "top_sekolah",
                  "avg_processing_hours", "sla_compliance_pct",
                  "avg_per_layanan", "workload"):
            assert k in d, f"missing {k}"
        assert isinstance(d["by_kecamatan"], list)
        assert isinstance(d["by_layanan"], list)
        assert isinstance(d["top_sekolah"], list)
        assert isinstance(d["workload"], list)

    def test_executive_date_filter(self, koord_tok):
        r = requests.get(f"{API}/executive/stats?from_date=2020-01-01&to_date=2020-01-02",
                         headers=hdr(koord_tok))
        assert r.status_code == 200
        assert r.json()["total"] == 0


# ---------- Knowledge Base ----------
class TestKB:
    def test_kb_categories_crud(self, koord_tok):
        # create
        r = requests.post(f"{API}/kb/categories", headers=hdr(koord_tok),
                          json={"nama": "TEST_KAT", "deskripsi": "demo"})
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # list
        items = requests.get(f"{API}/kb/categories", headers=hdr(koord_tok)).json()
        assert any(i["id"] == cid for i in items)
        # duplicate
        dup = requests.post(f"{API}/kb/categories", headers=hdr(koord_tok),
                            json={"nama": "TEST_KAT"})
        assert dup.status_code == 400
        # delete
        d = requests.delete(f"{API}/kb/categories/{cid}", headers=hdr(koord_tok))
        assert d.status_code == 200

    def test_kb_operator_cannot_create(self, op1_tok):
        r = requests.post(f"{API}/kb/categories", headers=hdr(op1_tok), json={"nama": "X"})
        assert r.status_code == 403
        r2 = requests.post(f"{API}/kb/articles", headers=hdr(op1_tok),
                           json={"title": "X", "content": "Y"})
        assert r2.status_code == 403

    def test_kb_article_full_crud_and_search(self, koord_tok, op1_tok):
        # create
        r = requests.post(f"{API}/kb/articles", headers=hdr(koord_tok),
                          json={"title": "TEST_KB_UNIQUE_HELLO", "kategori": "Umum",
                                "content": "isi markdown #hello", "tags": ["test", "phase2"]})
        assert r.status_code == 200
        aid = r.json()["id"]
        # operator can view
        g = requests.get(f"{API}/kb/articles/{aid}", headers=hdr(op1_tok))
        assert g.status_code == 200
        assert g.json()["views"] >= 1
        # search
        lst = requests.get(f"{API}/kb/articles?q=TEST_KB_UNIQUE_HELLO", headers=hdr(op1_tok))
        assert lst.status_code == 200
        assert any(i["id"] == aid for i in lst.json())
        # operator listing also works
        lst2 = requests.get(f"{API}/kb/articles", headers=hdr(op1_tok))
        assert lst2.status_code == 200
        # update
        u = requests.put(f"{API}/kb/articles/{aid}", headers=hdr(koord_tok),
                         json={"title": "TEST_KB_UPDATED", "content": "new", "tags": []})
        assert u.status_code == 200
        assert u.json()["title"] == "TEST_KB_UPDATED"
        # operator cannot edit/delete
        bad = requests.put(f"{API}/kb/articles/{aid}", headers=hdr(op1_tok),
                           json={"title": "X", "content": "Y"})
        assert bad.status_code == 403
        bad2 = requests.delete(f"{API}/kb/articles/{aid}", headers=hdr(op1_tok))
        assert bad2.status_code == 403
        # delete
        d = requests.delete(f"{API}/kb/articles/{aid}", headers=hdr(koord_tok))
        assert d.status_code == 200
        # verify gone
        g2 = requests.get(f"{API}/kb/articles/{aid}", headers=hdr(koord_tok))
        assert g2.status_code == 404


# ---------- Audit Log ----------
class TestAudit:
    def test_audit_requires_koord(self, op1_tok):
        r = requests.get(f"{API}/audit", headers=hdr(op1_tok))
        assert r.status_code == 403

    def test_audit_records_master_crud(self, koord_tok):
        # create a sekolah => expect an audit row
        s = requests.post(f"{API}/sekolah", headers=hdr(koord_tok),
                          json={"nama": "TEST_AUDIT_SEK", "npsn": "TESTAUD99",
                                "kecamatan": "Bogor Barat", "jenjang": "SD"}).json()
        sid = s["id"]
        try:
            r = requests.get(f"{API}/audit?entity=sekolah&action=create", headers=hdr(koord_tok))
            assert r.status_code == 200
            d = r.json()
            assert d["total"] >= 1
            assert any(it.get("entity_id") == sid for it in d["items"])
            # filter by q (summary)
            r2 = requests.get(f"{API}/audit?q=TEST_AUDIT_SEK", headers=hdr(koord_tok))
            assert any("TEST_AUDIT_SEK" in (it.get("summary") or "") for it in r2.json()["items"])
        finally:
            requests.delete(f"{API}/sekolah/{sid}", headers=hdr(koord_tok))

    def test_audit_records_ticket_status_and_assign(self, koord_tok, op1_tok, reset_layanan):
        # create ticket
        r = requests.post(f"{API}/tickets", headers=hdr(op1_tok), json={
            "layanan_id": reset_layanan["id"],
            "judul": "TEST audit ticket",
            "deskripsi": "audit",
            "prioritas": "Normal",
        })
        assert r.status_code == 200
        tid = r.json()["id"]
        # status change
        requests.post(f"{API}/tickets/{tid}/status", headers=hdr(koord_tok),
                      json={"status": "Diproses"})
        # assign
        koords = requests.get(f"{API}/koordinators", headers=hdr(koord_tok)).json()
        requests.post(f"{API}/tickets/{tid}/assign", headers=hdr(koord_tok),
                      json={"assignee_id": koords[0]["id"]})
        a1 = requests.get(f"{API}/audit?entity=ticket&action=status_change", headers=hdr(koord_tok)).json()
        a2 = requests.get(f"{API}/audit?entity=ticket&action=assign", headers=hdr(koord_tok)).json()
        assert any(it.get("entity_id") == tid for it in a1["items"])
        assert any(it.get("entity_id") == tid for it in a2["items"])
