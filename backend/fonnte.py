"""Fonnte WhatsApp gateway integration.

Sends async messages via Fonnte (https://fonnte.com). Designed to be
non-blocking and fail-soft: if the token is missing, disabled, or the API
returns an error, we log and continue without breaking the ticket workflow.
"""
from __future__ import annotations

import os
import re
import logging
from typing import Optional

import httpx

FONNTE_API_URL = "https://api.fonnte.com/send"
logger = logging.getLogger("dapodik.fonnte")


def _enabled() -> bool:
    return os.environ.get("FONNTE_ENABLED", "true").lower() in ("1", "true", "yes") and bool(os.environ.get("FONNTE_API_TOKEN"))


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Strip non-digits and leave Fonnte to apply countryCode."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return None
    # if user typed +62..., countryCode will mishandle; strip leading 62 only if started with +62
    return digits


async def send_whatsapp(
    target: str,
    message: str,
    delay: str = "1-2",
) -> dict:
    """Send a WhatsApp message via Fonnte. Returns Fonnte's response dict or
    {"status": False, "detail": "..."} on error. Never raises.

    Response is always a dict and additionally guaranteed to contain a
    ``quota_remaining`` integer (when parseable from Fonnte response)."""
    if not _enabled():
        return {"status": False, "detail": "fonnte_disabled_or_no_token", "skipped": True}

    phone = normalize_phone(target)
    if not phone:
        return {"status": False, "detail": "invalid_phone", "skipped": True}

    token = os.environ["FONNTE_API_TOKEN"]
    payload = {
        "target": phone,
        "message": message,
        "countryCode": os.environ.get("FONNTE_COUNTRY_CODE", "62"),
        "delay": delay,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                FONNTE_API_URL,
                headers={"Authorization": token},
                data=payload,
            )
            try:
                data = resp.json()
            except Exception:
                data = {"status": False, "detail": resp.text[:200]}
            # extract quota remaining (Fonnte returns nested {<device>: {remaining: int}})
            quota = None
            try:
                q = data.get("quota") or {}
                if isinstance(q, dict):
                    for v in q.values():
                        if isinstance(v, dict) and "remaining" in v:
                            quota = int(v["remaining"])
                            break
            except Exception:
                pass
            if quota is not None:
                data["quota_remaining"] = quota
            if not data.get("status"):
                logger.warning("Fonnte send failed target=%s detail=%s", phone[-4:], data)
            return data
    except Exception as e:  # network / DNS / timeout
        logger.warning("Fonnte exception target=%s err=%s", phone[-4:], e)
        return {"status": False, "detail": str(e)}


async def fetch_device_info() -> dict:
    """Call Fonnte /device endpoint to fetch device + quota info.
    Returns {} on failure."""
    if not _enabled():
        return {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.fonnte.com/device",
                headers={"Authorization": os.environ["FONNTE_API_TOKEN"]},
            )
            return resp.json()
    except Exception as e:
        logger.warning("Fonnte device check failed: %s", e)
        return {}


async def send_whatsapp_many(targets: list[str], message: str, delay: str = "2") -> dict:
    """Send the same message to multiple targets in one Fonnte call.

    Targets are normalized and joined by comma. Skipped if disabled."""
    if not _enabled():
        return {"status": False, "detail": "fonnte_disabled_or_no_token", "skipped": True}
    phones = [p for p in (normalize_phone(t) for t in targets) if p]
    if not phones:
        return {"status": False, "detail": "no_valid_phones", "skipped": True}
    return await send_whatsapp(",".join(phones), message, delay=delay)


# ---------- Template helpers (Indonesian) ----------
def _short(s: str, n: int = 70) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def msg_ticket_created(ticket: dict) -> str:
    return (
        "*Dapodik Ticketing — Pengajuan Diterima*\n"
        f"No. Ticket: *{ticket.get('ticket_number')}*\n"
        f"Layanan: {ticket.get('layanan_nama')}\n"
        f"Judul: {_short(ticket.get('judul'))}\n"
        f"Status: {ticket.get('status')}\n"
        f"SLA: {ticket.get('sla_days')} hari kerja\n\n"
        "Pengajuan Anda sedang menunggu review koordinator. Mohon pantau status melalui aplikasi."
    )


def msg_status_change(ticket: dict, old: str, new: str, catatan: Optional[str] = None) -> str:
    body = (
        "*Dapodik Ticketing — Status Diperbarui*\n"
        f"No. Ticket: *{ticket.get('ticket_number')}*\n"
        f"Layanan: {ticket.get('layanan_nama')}\n"
        f"Status: {old} → *{new}*"
    )
    if catatan:
        body += f"\n\nCatatan koordinator:\n_{_short(catatan, 240)}_"
    return body


def msg_new_comment(ticket: dict, author: str, content: str) -> str:
    return (
        "*Dapodik Ticketing — Komentar Baru*\n"
        f"No. Ticket: *{ticket.get('ticket_number')}*\n"
        f"Dari koordinator: {author}\n\n"
        f"_{_short(content, 300)}_"
    )


def msg_bulk_status(ticket: dict, new: str) -> str:
    return (
        "*Dapodik Ticketing — Status Diperbarui*\n"
        f"No. Ticket: *{ticket.get('ticket_number')}*\n"
        f"Status terbaru: *{new}*"
    )
