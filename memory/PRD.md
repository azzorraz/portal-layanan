# PRD — Portal Layanan Dapodik

## Original Problem Statement
Aplikasi web modern untuk mengelola seluruh pengajuan layanan Dapodik dari Operator Sekolah kepada Koordinator Tim, menggantikan workflow WhatsApp dengan One-Stop Service ticket system. Skala target: 100–500+ pengajuan/bulan.

## User Personas
1. **Operator Sekolah** — satu akun per sekolah; membuat dan memantau pengajuan miliknya sendiri.
2. **Koordinator (Admin)** — melihat seluruh pengajuan, review/approve/reject, kelola master data, lihat dashboard & generate laporan.

## Architecture
- Backend: FastAPI + Motor (async MongoDB), JWT auth (bcrypt + PyJWT), bearer token via `Authorization` header.
- Frontend: React 19 + React Router 7 + TanStack Query (config only), Recharts, Shadcn UI (Radix), Tailwind, Sonner toaster, Lucide icons.
- Storage: dokumen di-encode base64 di MongoDB (`attachments` collection). Max 5MB, PDF/JPG/PNG.
- Design: Swiss / high-contrast, Light theme; fonts Geist + Manrope + JetBrains Mono.

## Implemented (2026-02 / Feb 25 2026)
- ✅ JWT auth: login, logout, /me, change-password; role-based gating (`operator`, `koordinator`).
- ✅ Seed: 1 koordinator + 3 operator + 3 sekolah + 6 kecamatan + 11 default layanan dengan SLA + default checklist per layanan.
- ✅ Tickets: create (operator only) with attachments + checklist; list with filter & search & SLA filter & **infinite scroll** (PAGE_SIZE=30); detail page with timeline (GitHub-Issue style), status change (koord only) with audit trail; comments; per-ticket attachment upload/download; **assignment ke koordinator**; **checklist progress dengan toggle**.
- ✅ Auto ticket number `TCK-YYYY-NNNNNN` via Mongo counter.
- ✅ SLA computation + **traffic-light cards** (hijau/kuning/merah) di Dashboard.
- ✅ Dashboard: 6 stat cards, monthly bar chart, SLA pie chart, status distribution, **+ loading skeleton**.
- ✅ **Dashboard Pimpinan** (/executive): stats eksekutif (total, selesai, avg processing hours, SLA compliance, by-kecamatan, by-layanan, top sekolah, workload per petugas, avg-per-layanan).
- ✅ Master Data CRUD: Sekolah, Operator, Layanan & SLA **(dengan checklist editor & attachment_required toggle)**, Kecamatan.
- ✅ **Knowledge Base / FAQ**: kategori + artikel (CRUD penuh untuk koord, read untuk operator), markdown sederhana, view counter, pencarian + filter kategori.
- ✅ **Audit Log global** (/audit): semua CRUD master data + ticket status_change + assignment tercatat dengan actor, entity, action, summary, timestamp; filter entity/action/tanggal/search.
- ✅ In-app notifications, Reports Excel + PDF.
- ✅ Workflow: Draft / Diajukan / Diproses / Menunggu Dokumen / Revisi / Disetujui / Selesai / Ditolak.
- ✅ Fonnte WhatsApp integration (notifikasi event), delivery stats dashboard, low-quota alert, resend mechanism, operator opt-out preferences.

## Implemented Phase 8 (2026-06-25)
- ✅ DEFAULT_SERVICES upgraded to 4-tuple: `(nama, sla_hari, checklist, attachment_required)`. Seed loop fixed (was crashing on startup with 3-tuple unpack).
- ✅ Layanan model: tambah field `attachment_required: bool`. CRUD + toggle UI di Master Data → Layanan & SLA (`data-testid="layanan-attachment-required-toggle"`).
- ✅ NIP/NIK/NUPTK/NIP_GTK/NIK_GTK di semua 11 default layanan dipaksa `required=false` baik di seed baru maupun normalisasi in-place untuk dokumen lama.
- ✅ POST /api/tickets validasi: jika `layanan.attachment_required=True` dan `attachments` kosong → 400 "Layanan ini wajib menyertakan lampiran dokumen (SK/KTP)."
- ✅ CreateTicket.jsx: "Nama Operator" sekarang **editable** (terisi awal dari user.name tapi tidak readonly). Lampiran label menampilkan asterisk merah + hint untuk layanan attachment_required.
- ✅ Layanan yg `attachment_required=true`: #8 Penugasan Kepala Sekolah, #9 Pengajuan Mutasi Guru, #10 Input Jam Tambahan di Sekolah Lain, #11 Kenaikan Gaji Berkala/KP.
- ✅ E2E test Phase 8: **13/13 backend pytest pass** + frontend flow 100% (operator + koord).

## Implemented Phase 9 — Rebrand + NPSN Auth + Blue Theme (2026-06-25)
- ✅ **Rebranding**: nama aplikasi resmi **"Portal Layanan Dapodik"** (sebelumnya "Dapodik Ticketing"). Updated di Login, Layout sidebar, header mobile, browser tab title.
- ✅ **Operator login via NPSN**: POST /api/auth/login menerima `identifier` (email ATAU NPSN). Operator login menggunakan NPSN sekolah (cth `20220001`) + password default `123456`. Backend resolve NPSN → cari sekolah → cari user role=operator dgn sekolah_id terkait.
- ✅ **Koordinator baru**: `admin@dapodik.id` / `admin123` (env `ADMIN_EMAIL`, `ADMIN_PASSWORD`). Akun lama `koordinator@dapodik.id` di-set `active=false` oleh seed (preserve tapi non-aktif).
- ✅ **Login UI**: 2 tab toggle (Operator/Koordinator), dynamic label/placeholder/hint sesuai mode (NPSN vs Email).
- ✅ **Tema biru-putih**: Primary accent `bg-blue-600` (tombol, active sidebar, avatar, DP logo). Visual pane login → `bg-blue-900`. Netral abu-abu dipertahankan untuk text/border/surface agar tetap minimalist.
- ✅ Idempotent seed: existing operator password di-reset ke `123456` jika tidak match; admin koord baru auto-promoted; legacy koord auto-deactivated.
- ✅ E2E test Phase 9: **23/23 backend pytest pass** (10 phase9 + 13 phase8 regression) + frontend flow 100%.

## Backlog (Next Phases)
### P1
- Integrasi notifikasi WhatsApp + Email (Twilio/Resend) saat status berubah / revisi diminta.
- Password reset via email (forgot password flow).
- Pagination + infinite scroll di /tickets bila > 1000 records.
- Bulk action: koordinator approve/reject multiple tickets.

### P2
- Dashboard pimpinan (read-only, multi-koordinator).
- Integrasi API Dapodik (auto-populate PTK/Siswa).
- Object storage migration untuk attachments (saat ini base64 di Mongo).
- Audit log eksport CSV per ticket.
- SLA business-hours (skip weekend/libur nasional).
- Komentar mention (@user) + threading.

### P3
- Mobile app (PWA installable).
- Role tambahan: "Asisten Koordinator" dengan permission terbatas.
- Webhook untuk integrasi sistem eksternal.

## Test Credentials
Lihat `/app/memory/test_credentials.md`.
