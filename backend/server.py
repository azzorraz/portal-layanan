"""Dapodik Ticketing System - FastAPI backend."""
from __future__ import annotations

from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import base64
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, Response, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pydantic import BaseModel, Field, EmailStr

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)

# ---------- Setup ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Dapodik Ticketing API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("dapodik")

# ---------- Constants ----------
STATUSES = ["Draft", "Diajukan", "Diproses", "Menunggu Dokumen", "Revisi", "Disetujui", "Selesai", "Ditolak"]
PRIORITIES = ["Rendah", "Normal", "Tinggi", "Mendesak"]
ROLES = ["operator", "koordinator"]

DEFAULT_SERVICES = [
    ("Approval Perubahan Status Kepegawaian Dapodik", 5),
    ("Approval Request Hapus Akun PTK", 2),
    ("Approval Permintaan Reset Akun PTK", 1),
    ("Approval Permintaan Reset Akun Sekolah", 1),
    ("Approval Input Siswa Pindah Rombel", 3),
    ("Approval Perubahan Jabatan PTK", 3),
    ("Approval Input Siswa Baru", 3),
    ("Approval Penugasan Kepala Sekolah", 5),
    ("Approval Pengajuan Mutasi Guru", 3),
    ("Approval Input Jam Tambahan di Sekolah Lain", 3),
    ("Approval Input Kenaikan Gaji Berkala atau Kenaikan Pangkat", 5),
]

DEFAULT_KECAMATAN = ["Bogor Tengah", "Bogor Utara", "Bogor Selatan", "Bogor Barat", "Bogor Timur", "Tanah Sareal"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def doc_to_public(doc: dict, drop: tuple = ("password_hash",)) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    for k in drop:
        doc.pop(k, None)
    return doc


# ---------- Pydantic Schemas ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class KecamatanIn(BaseModel):
    nama: str


class SekolahIn(BaseModel):
    nama: str
    npsn: Optional[str] = None
    kecamatan: str
    jenjang: Optional[str] = None
    alamat: Optional[str] = None


class OperatorIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    sekolah_id: str
    phone: Optional[str] = None


class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    sekolah_id: Optional[str] = None
    phone: Optional[str] = None
    active: Optional[bool] = None


class LayananIn(BaseModel):
    nama: str
    sla_days: int = Field(ge=1, le=60)
    deskripsi: Optional[str] = None


class AttachmentIn(BaseModel):
    filename: str
    mime: str
    data_base64: str  # raw base64 (no data: prefix)


class TicketCreate(BaseModel):
    layanan_id: str
    judul: str
    deskripsi: str
    prioritas: Literal["Rendah", "Normal", "Tinggi", "Mendesak"] = "Normal"
    attachments: List[AttachmentIn] = []


class StatusChange(BaseModel):
    status: Literal["Draft", "Diajukan", "Diproses", "Menunggu Dokumen", "Revisi", "Disetujui", "Selesai", "Ditolak"]
    catatan: Optional[str] = None


class CommentIn(BaseModel):
    content: str


# ---------- Helpers ----------
async def next_ticket_number() -> str:
    year = datetime.now(timezone.utc).year
    res = await db.counters.find_one_and_update(
        {"_id": f"tickets-{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (res or {}).get("seq", 1)
    return f"TCK-{year}-{seq:06d}"


async def log_activity(ticket_id: str, actor: dict, kind: str, message: str, meta: Optional[dict] = None):
    await db.activities.insert_one({
        "ticket_id": ticket_id,
        "actor_id": actor["id"],
        "actor_name": actor.get("name", actor.get("email")),
        "actor_role": actor.get("role"),
        "kind": kind,
        "message": message,
        "meta": meta or {},
        "created_at": iso(now_utc()),
    })


async def notify(user_id: str, ticket_id: Optional[str], title: str, body: str):
    await db.notifications.insert_one({
        "user_id": user_id,
        "ticket_id": ticket_id,
        "title": title,
        "body": body,
        "read": False,
        "created_at": iso(now_utc()),
    })


async def compute_due_at(layanan_id: str, submitted_at: datetime) -> Optional[str]:
    try:
        lay = await db.services.find_one({"_id": ObjectId(layanan_id)})
    except Exception:
        return None
    if not lay:
        return None
    return iso(submitted_at + timedelta(days=int(lay.get("sla_days", 3))))


def sla_state(due_at_iso: Optional[str], status: str) -> str:
    if status in ("Selesai", "Disetujui", "Ditolak"):
        return "selesai"
    if not due_at_iso:
        return "tidak_diatur"
    due = datetime.fromisoformat(due_at_iso)
    now = now_utc()
    if now > due:
        return "terlambat"
    remaining = (due - now).total_seconds()
    if remaining < 24 * 3600:
        return "hampir_terlambat"
    return "tepat_waktu"


async def enrich_ticket(t: dict) -> dict:
    out = doc_to_public(t)
    out["sla_state"] = sla_state(out.get("due_at"), out.get("status"))
    return out


# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("active", True) or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    user_id = str(user["_id"])
    token = create_access_token(user_id, user["email"], user["role"])
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False, samesite="lax",
        max_age=12 * 3600, path="/",
    )
    return {
        "token": token,
        "user": doc_to_public(user),
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    # enrich with school
    if user.get("sekolah_id"):
        try:
            s = await db.sekolah.find_one({"_id": ObjectId(user["sekolah_id"])})
            if s:
                user["sekolah"] = doc_to_public(s)
        except Exception:
            pass
    return user


@api.post("/auth/change-password")
async def change_password(payload: ChangePasswordIn, user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not doc or not verify_password(payload.old_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama tidak sesuai")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": iso(now_utc())}},
    )
    return {"ok": True}


# ---------- Kecamatan ----------
@api.get("/kecamatan")
async def list_kecamatan(_: dict = Depends(get_current_user)):
    items = await db.kecamatan.find().sort("nama", 1).to_list(500)
    return [doc_to_public(i) for i in items]


@api.post("/kecamatan")
async def create_kecamatan(payload: KecamatanIn, _: dict = Depends(require_role("koordinator"))):
    exists = await db.kecamatan.find_one({"nama": payload.nama})
    if exists:
        raise HTTPException(status_code=400, detail="Kecamatan sudah ada")
    res = await db.kecamatan.insert_one({"nama": payload.nama, "created_at": iso(now_utc())})
    return doc_to_public(await db.kecamatan.find_one({"_id": res.inserted_id}))


@api.delete("/kecamatan/{kid}")
async def delete_kecamatan(kid: str, _: dict = Depends(require_role("koordinator"))):
    await db.kecamatan.delete_one({"_id": ObjectId(kid)})
    return {"ok": True}


# ---------- Sekolah ----------
@api.get("/sekolah")
async def list_sekolah(q: Optional[str] = None, kecamatan: Optional[str] = None, _: dict = Depends(get_current_user)):
    filt: dict = {}
    if q:
        filt["nama"] = {"$regex": q, "$options": "i"}
    if kecamatan:
        filt["kecamatan"] = kecamatan
    items = await db.sekolah.find(filt).sort("nama", 1).to_list(2000)
    return [doc_to_public(i) for i in items]


@api.post("/sekolah")
async def create_sekolah(payload: SekolahIn, _: dict = Depends(require_role("koordinator"))):
    doc = payload.model_dump()
    doc["created_at"] = iso(now_utc())
    res = await db.sekolah.insert_one(doc)
    return doc_to_public(await db.sekolah.find_one({"_id": res.inserted_id}))


@api.put("/sekolah/{sid}")
async def update_sekolah(sid: str, payload: SekolahIn, _: dict = Depends(require_role("koordinator"))):
    await db.sekolah.update_one({"_id": ObjectId(sid)}, {"$set": {**payload.model_dump(), "updated_at": iso(now_utc())}})
    return doc_to_public(await db.sekolah.find_one({"_id": ObjectId(sid)}))


@api.delete("/sekolah/{sid}")
async def delete_sekolah(sid: str, _: dict = Depends(require_role("koordinator"))):
    await db.sekolah.delete_one({"_id": ObjectId(sid)})
    return {"ok": True}


# ---------- Operators (users) ----------
@api.get("/operators")
async def list_operators(q: Optional[str] = None, _: dict = Depends(require_role("koordinator"))):
    filt = {"role": "operator"}
    if q:
        filt["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"email": {"$regex": q, "$options": "i"}}]
    items = await db.users.find(filt).sort("name", 1).to_list(2000)
    # enrich with sekolah
    out = []
    for it in items:
        pub = doc_to_public(it)
        if pub.get("sekolah_id"):
            try:
                s = await db.sekolah.find_one({"_id": ObjectId(pub["sekolah_id"])})
                if s:
                    pub["sekolah"] = doc_to_public(s)
            except Exception:
                pass
        out.append(pub)
    return out


@api.post("/operators")
async def create_operator(payload: OperatorIn, _: dict = Depends(require_role("koordinator"))):
    email_low = payload.email.lower()
    if await db.users.find_one({"email": email_low}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    # ensure one operator per sekolah
    if await db.users.find_one({"role": "operator", "sekolah_id": payload.sekolah_id}):
        raise HTTPException(status_code=400, detail="Sekolah ini sudah memiliki akun operator")
    sekolah = await db.sekolah.find_one({"_id": ObjectId(payload.sekolah_id)})
    if not sekolah:
        raise HTTPException(status_code=404, detail="Sekolah tidak ditemukan")
    doc = {
        "name": payload.name,
        "email": email_low,
        "password_hash": hash_password(payload.password),
        "role": "operator",
        "sekolah_id": payload.sekolah_id,
        "phone": payload.phone,
        "active": True,
        "created_at": iso(now_utc()),
    }
    res = await db.users.insert_one(doc)
    return doc_to_public(await db.users.find_one({"_id": res.inserted_id}))


@api.put("/operators/{uid}")
async def update_operator(uid: str, payload: OperatorUpdate, _: dict = Depends(require_role("koordinator"))):
    update: dict = {}
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        update["password_hash"] = hash_password(data.pop("password"))
    if "email" in data and data["email"]:
        data["email"] = data["email"].lower()
    update.update(data)
    update["updated_at"] = iso(now_utc())
    if "sekolah_id" in update and update["sekolah_id"]:
        clash = await db.users.find_one({
            "role": "operator",
            "sekolah_id": update["sekolah_id"],
            "_id": {"$ne": ObjectId(uid)},
        })
        if clash:
            raise HTTPException(status_code=400, detail="Sekolah ini sudah memiliki akun operator")
    if "email" in update and update["email"]:
        clash = await db.users.find_one({
            "email": update["email"],
            "_id": {"$ne": ObjectId(uid)},
        })
        if clash:
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": update})
    return doc_to_public(await db.users.find_one({"_id": ObjectId(uid)}))


@api.delete("/operators/{uid}")
async def delete_operator(uid: str, _: dict = Depends(require_role("koordinator"))):
    await db.users.delete_one({"_id": ObjectId(uid), "role": "operator"})
    return {"ok": True}


# ---------- Layanan ----------
@api.get("/layanan")
async def list_layanan(_: dict = Depends(get_current_user)):
    items = await db.services.find().sort("nama", 1).to_list(500)
    return [doc_to_public(i) for i in items]


@api.post("/layanan")
async def create_layanan(payload: LayananIn, _: dict = Depends(require_role("koordinator"))):
    res = await db.services.insert_one({**payload.model_dump(), "created_at": iso(now_utc())})
    return doc_to_public(await db.services.find_one({"_id": res.inserted_id}))


@api.put("/layanan/{lid}")
async def update_layanan(lid: str, payload: LayananIn, _: dict = Depends(require_role("koordinator"))):
    await db.services.update_one({"_id": ObjectId(lid)}, {"$set": {**payload.model_dump(), "updated_at": iso(now_utc())}})
    return doc_to_public(await db.services.find_one({"_id": ObjectId(lid)}))


@api.delete("/layanan/{lid}")
async def delete_layanan(lid: str, _: dict = Depends(require_role("koordinator"))):
    await db.services.delete_one({"_id": ObjectId(lid)})
    return {"ok": True}


# ---------- Tickets ----------
async def _enrich_one(t: dict) -> dict:
    out = doc_to_public(t)
    out["sla_state"] = sla_state(out.get("due_at"), out.get("status"))
    return out


@api.post("/tickets")
async def create_ticket(payload: TicketCreate, user: dict = Depends(get_current_user)):
    if user["role"] != "operator":
        raise HTTPException(status_code=403, detail="Hanya operator yang dapat membuat pengajuan")
    layanan = await db.services.find_one({"_id": ObjectId(payload.layanan_id)})
    if not layanan:
        raise HTTPException(status_code=404, detail="Jenis layanan tidak ditemukan")
    sekolah = None
    if user.get("sekolah_id"):
        sekolah = await db.sekolah.find_one({"_id": ObjectId(user["sekolah_id"])})

    submitted_at = now_utc()
    ticket_number = await next_ticket_number()
    due_at = iso(submitted_at + timedelta(days=int(layanan.get("sla_days", 3))))

    doc = {
        "ticket_number": ticket_number,
        "judul": payload.judul,
        "deskripsi": payload.deskripsi,
        "layanan_id": payload.layanan_id,
        "layanan_nama": layanan["nama"],
        "sla_days": int(layanan.get("sla_days", 3)),
        "prioritas": payload.prioritas,
        "status": "Diajukan",
        "operator_id": user["id"],
        "operator_name": user["name"],
        "sekolah_id": user.get("sekolah_id"),
        "sekolah_nama": (sekolah or {}).get("nama"),
        "kecamatan": (sekolah or {}).get("kecamatan"),
        "submitted_at": iso(submitted_at),
        "due_at": due_at,
        "created_at": iso(submitted_at),
        "updated_at": iso(submitted_at),
        "closed_at": None,
    }
    res = await db.tickets.insert_one(doc)
    tid = str(res.inserted_id)

    # Save attachments
    for att in payload.attachments[:10]:
        await db.attachments.insert_one({
            "ticket_id": tid,
            "filename": att.filename,
            "mime": att.mime,
            "data_base64": att.data_base64,
            "uploaded_by": user["id"],
            "uploaded_at": iso(now_utc()),
        })

    await log_activity(tid, user, "created", f"Pengajuan dibuat: {payload.judul}")
    # notify all koordinator
    async for k in db.users.find({"role": "koordinator"}):
        await notify(str(k["_id"]), tid, "Pengajuan Baru", f"{ticket_number} - {payload.judul}")

    saved = await db.tickets.find_one({"_id": res.inserted_id})
    return await _enrich_one(saved)


@api.get("/tickets")
async def list_tickets(
    q: Optional[str] = None,
    status: Optional[str] = None,
    layanan_id: Optional[str] = None,
    kecamatan: Optional[str] = None,
    sekolah_id: Optional[str] = None,
    operator_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    sla_filter: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    user: dict = Depends(get_current_user),
):
    filt: dict = {}
    if user["role"] == "operator":
        filt["operator_id"] = user["id"]
    if q:
        filt["$or"] = [
            {"ticket_number": {"$regex": q, "$options": "i"}},
            {"judul": {"$regex": q, "$options": "i"}},
            {"sekolah_nama": {"$regex": q, "$options": "i"}},
            {"operator_name": {"$regex": q, "$options": "i"}},
            {"layanan_nama": {"$regex": q, "$options": "i"}},
        ]
    if status:
        filt["status"] = status
    if layanan_id:
        filt["layanan_id"] = layanan_id
    if kecamatan:
        filt["kecamatan"] = kecamatan
    if sekolah_id:
        filt["sekolah_id"] = sekolah_id
    if operator_id:
        filt["operator_id"] = operator_id
    if from_date or to_date:
        rng = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date + "T23:59:59"
        filt["submitted_at"] = rng

    total = await db.tickets.count_documents(filt)
    cursor = db.tickets.find(filt).sort("submitted_at", -1).skip(skip).limit(limit)
    items = [await _enrich_one(t) async for t in cursor]
    if sla_filter:
        items = [i for i in items if i["sla_state"] == sla_filter]
    return {"items": items, "total": total}


@api.get("/tickets/{tid}")
async def get_ticket(tid: str, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    if user["role"] == "operator" and t.get("operator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    enriched = await _enrich_one(t)
    activities = await db.activities.find({"ticket_id": tid}).sort("created_at", 1).to_list(1000)
    attachments = await db.attachments.find({"ticket_id": tid}, {"data_base64": 0}).sort("uploaded_at", 1).to_list(100)
    enriched["activities"] = [doc_to_public(a) for a in activities]
    enriched["attachments"] = [doc_to_public(a) for a in attachments]
    return enriched


@api.post("/tickets/{tid}/status")
async def change_status(tid: str, payload: StatusChange, user: dict = Depends(require_role("koordinator"))):
    t = await db.tickets.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    old = t.get("status")
    update = {"status": payload.status, "updated_at": iso(now_utc())}
    if payload.status in ("Selesai", "Disetujui", "Ditolak"):
        update["closed_at"] = iso(now_utc())
    await db.tickets.update_one({"_id": ObjectId(tid)}, {"$set": update})
    msg = f"Status diubah: {old} → {payload.status}"
    if payload.catatan:
        msg += f" — {payload.catatan}"
    await log_activity(tid, user, "status_change", msg, {"from": old, "to": payload.status, "catatan": payload.catatan})
    await notify(t["operator_id"], tid, "Status Pengajuan Diperbarui", f"{t['ticket_number']}: {payload.status}")
    saved = await db.tickets.find_one({"_id": ObjectId(tid)})
    return await _enrich_one(saved)


@api.post("/tickets/{tid}/comments")
async def add_comment(tid: str, payload: CommentIn, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    if user["role"] == "operator" and t.get("operator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    await log_activity(tid, user, "comment", payload.content)
    # notify counterpart
    if user["role"] == "operator":
        async for k in db.users.find({"role": "koordinator"}):
            await notify(str(k["_id"]), tid, "Komentar baru dari operator", f"{t['ticket_number']}")
    else:
        await notify(t["operator_id"], tid, "Komentar baru dari koordinator", f"{t['ticket_number']}")
    return {"ok": True}


@api.post("/tickets/{tid}/attachments")
async def add_attachment(tid: str, payload: AttachmentIn, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    if user["role"] == "operator" and t.get("operator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    if payload.mime not in ("application/pdf", "image/jpeg", "image/png", "image/jpg"):
        raise HTTPException(status_code=400, detail="Format file tidak didukung")
    # ~5MB raw limit
    if len(payload.data_base64) > 7_500_000:
        raise HTTPException(status_code=400, detail="Ukuran file maksimum 5MB")
    res = await db.attachments.insert_one({
        "ticket_id": tid,
        "filename": payload.filename,
        "mime": payload.mime,
        "data_base64": payload.data_base64,
        "uploaded_by": user["id"],
        "uploaded_at": iso(now_utc()),
    })
    await log_activity(tid, user, "attachment", f"Mengunggah dokumen: {payload.filename}")
    a = await db.attachments.find_one({"_id": res.inserted_id}, {"data_base64": 0})
    return doc_to_public(a)


@api.get("/tickets/{tid}/attachments/{aid}/download")
async def download_attachment(tid: str, aid: str, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"_id": ObjectId(tid)})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket tidak ditemukan")
    if user["role"] == "operator" and t.get("operator_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Akses ditolak")
    a = await db.attachments.find_one({"_id": ObjectId(aid), "ticket_id": tid})
    if not a:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data = base64.b64decode(a["data_base64"])
    return StreamingResponse(
        io.BytesIO(data),
        media_type=a["mime"],
        headers={"Content-Disposition": f'attachment; filename="{a["filename"]}"'},
    )


# ---------- Notifications ----------
@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": [doc_to_public(i) for i in items], "unread": unread}


@api.post("/notifications/mark-read")
async def mark_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- Dashboard ----------
@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    base: dict = {}
    if user["role"] == "operator":
        base["operator_id"] = user["id"]

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    total = await db.tickets.count_documents(base)
    today = await db.tickets.count_documents({**base, "submitted_at": {"$gte": today_start}})
    diproses = await db.tickets.count_documents({**base, "status": {"$in": ["Diajukan", "Diproses", "Menunggu Dokumen"]}})
    revisi = await db.tickets.count_documents({**base, "status": "Revisi"})
    selesai = await db.tickets.count_documents({**base, "status": {"$in": ["Selesai", "Disetujui"]}})
    ditolak = await db.tickets.count_documents({**base, "status": "Ditolak"})

    # SLA
    open_filter = {**base, "status": {"$nin": ["Selesai", "Disetujui", "Ditolak"]}}
    open_tickets = await db.tickets.find(open_filter, {"due_at": 1, "status": 1}).to_list(5000)
    on_time = almost = late = 0
    for t in open_tickets:
        s = sla_state(t.get("due_at"), t.get("status"))
        if s == "tepat_waktu":
            on_time += 1
        elif s == "hampir_terlambat":
            almost += 1
        elif s == "terlambat":
            late += 1

    # Monthly: last 6 months counts
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        start = datetime(y, m, 1, tzinfo=timezone.utc)
        if m == 12:
            end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(y, m + 1, 1, tzinfo=timezone.utc)
        count = await db.tickets.count_documents({
            **base,
            "submitted_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
        })
        months.append({"label": start.strftime("%b %Y"), "month": start.strftime("%Y-%m"), "count": count})

    # by status (for pie/legend)
    by_status = []
    for st in STATUSES:
        c = await db.tickets.count_documents({**base, "status": st})
        if c > 0:
            by_status.append({"status": st, "count": c})

    return {
        "total": total,
        "today": today,
        "diproses": diproses,
        "revisi": revisi,
        "selesai": selesai,
        "ditolak": ditolak,
        "sla": {"on_time": on_time, "almost": almost, "late": late},
        "monthly": months,
        "by_status": by_status,
    }


# ---------- Reports ----------
def _build_ticket_filter(
    from_date: Optional[str], to_date: Optional[str], status: Optional[str],
    layanan_id: Optional[str], kecamatan: Optional[str],
) -> dict:
    filt: dict = {}
    if from_date or to_date:
        rng = {}
        if from_date:
            rng["$gte"] = from_date
        if to_date:
            rng["$lte"] = to_date + "T23:59:59"
        filt["submitted_at"] = rng
    if status:
        filt["status"] = status
    if layanan_id:
        filt["layanan_id"] = layanan_id
    if kecamatan:
        filt["kecamatan"] = kecamatan
    return filt


@api.get("/reports/excel")
async def report_excel(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    status: Optional[str] = None, layanan_id: Optional[str] = None,
    kecamatan: Optional[str] = None,
    _: dict = Depends(require_role("koordinator")),
):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = Workbook()
    ws = wb.active
    ws.title = "Laporan Pengajuan"
    headers = ["No. Ticket", "Tanggal", "Sekolah", "Kecamatan", "Operator", "Jenis Layanan", "Prioritas", "Status", "SLA (hari)", "Jatuh Tempo", "Selesai"]
    ws.append(headers)
    head_fill = PatternFill("solid", fgColor="09090B")
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = head_fill
        c.alignment = Alignment(horizontal="center")

    filt = _build_ticket_filter(from_date, to_date, status, layanan_id, kecamatan)
    cursor = db.tickets.find(filt).sort("submitted_at", -1)
    async for t in cursor:
        ws.append([
            t.get("ticket_number"),
            t.get("submitted_at", "")[:10],
            t.get("sekolah_nama") or "-",
            t.get("kecamatan") or "-",
            t.get("operator_name") or "-",
            t.get("layanan_nama") or "-",
            t.get("prioritas"),
            t.get("status"),
            t.get("sla_days"),
            (t.get("due_at") or "")[:10],
            (t.get("closed_at") or "")[:10] if t.get("closed_at") else "-",
        ])
    for col_idx in range(1, len(headers) + 1):
        ws.column_dimensions[chr(64 + col_idx)].width = 18

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"laporan-pengajuan-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/reports/pdf")
async def report_pdf(
    from_date: Optional[str] = None, to_date: Optional[str] = None,
    status: Optional[str] = None, layanan_id: Optional[str] = None,
    kecamatan: Optional[str] = None,
    _: dict = Depends(require_role("koordinator")),
):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=24, bottomMargin=24, leftMargin=24, rightMargin=24)
    styles = getSampleStyleSheet()
    title = Paragraph("<b>Laporan Pengajuan Layanan Dapodik</b>", styles["Title"])
    subtitle = Paragraph(
        f"Periode: {from_date or '-'} s.d. {to_date or '-'} &nbsp;&nbsp;|&nbsp;&nbsp; Dibuat: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        styles["Normal"],
    )

    rows = [["No. Ticket", "Tanggal", "Sekolah", "Operator", "Layanan", "Prioritas", "Status"]]
    filt = _build_ticket_filter(from_date, to_date, status, layanan_id, kecamatan)
    cursor = db.tickets.find(filt).sort("submitted_at", -1)
    async for t in cursor:
        rows.append([
            t.get("ticket_number"),
            (t.get("submitted_at") or "")[:10],
            (t.get("sekolah_nama") or "-")[:30],
            (t.get("operator_name") or "-")[:25],
            (t.get("layanan_nama") or "-")[:35],
            t.get("prioritas"),
            t.get("status"),
        ])
    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#09090B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E4E4E7")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    doc.build([title, Spacer(1, 6), subtitle, Spacer(1, 12), table])
    buf.seek(0)
    fname = f"laporan-pengajuan-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ---------- Health ----------
@api.get("/")
async def root():
    return {"status": "ok", "service": "Dapodik Ticketing API"}


# ---------- Seed ----------
async def seed():
    # indexes
    await db.users.create_index("email", unique=True)
    await db.tickets.create_index([("ticket_number", 1)], unique=True)
    await db.tickets.create_index([("submitted_at", -1)])
    await db.tickets.create_index([("operator_id", 1)])
    await db.activities.create_index([("ticket_id", 1), ("created_at", 1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    # kecamatan
    for k in DEFAULT_KECAMATAN:
        if not await db.kecamatan.find_one({"nama": k}):
            await db.kecamatan.insert_one({"nama": k, "created_at": iso(now_utc())})

    # services
    for nama, sla in DEFAULT_SERVICES:
        if not await db.services.find_one({"nama": nama}):
            await db.services.insert_one({"nama": nama, "sla_days": sla, "deskripsi": None, "created_at": iso(now_utc())})

    # admin koordinator
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pass = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "name": "Koordinator Tim",
            "email": admin_email,
            "password_hash": hash_password(admin_pass),
            "role": "koordinator",
            "active": True,
            "created_at": iso(now_utc()),
        })
    elif not verify_password(admin_pass, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_pass)}},
        )

    # sample sekolah + operators
    sample_sekolah = [
        {"nama": "SDN 01 Bogor Tengah", "npsn": "20220001", "kecamatan": "Bogor Tengah", "jenjang": "SD"},
        {"nama": "SMPN 02 Bogor Utara", "npsn": "20220002", "kecamatan": "Bogor Utara", "jenjang": "SMP"},
        {"nama": "SMAN 03 Bogor Selatan", "npsn": "20220003", "kecamatan": "Bogor Selatan", "jenjang": "SMA"},
    ]
    sekolah_ids = []
    for s in sample_sekolah:
        existing = await db.sekolah.find_one({"npsn": s["npsn"]})
        if not existing:
            res = await db.sekolah.insert_one({**s, "created_at": iso(now_utc())})
            sekolah_ids.append(str(res.inserted_id))
        else:
            sekolah_ids.append(str(existing["_id"]))

    sample_ops = [
        {"name": "Budi Santoso", "email": "operator1@dapodik.id", "password": "operator123", "sekolah_id": sekolah_ids[0]},
        {"name": "Siti Aminah", "email": "operator2@dapodik.id", "password": "operator123", "sekolah_id": sekolah_ids[1]},
        {"name": "Ahmad Rifai", "email": "operator3@dapodik.id", "password": "operator123", "sekolah_id": sekolah_ids[2]},
    ]
    for op in sample_ops:
        if not await db.users.find_one({"email": op["email"]}):
            await db.users.insert_one({
                "name": op["name"],
                "email": op["email"],
                "password_hash": hash_password(op["password"]),
                "role": "operator",
                "sekolah_id": op["sekolah_id"],
                "active": True,
                "created_at": iso(now_utc()),
            })

    logger.info("Seed complete")


@app.on_event("startup")
async def on_startup():
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# Mount router and middleware
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
