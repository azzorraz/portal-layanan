# PRD — Sistem Manajemen Approval & Ticketing Layanan Dapodik

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
- ✅ Master Data CRUD: Sekolah, Operator, Layanan & SLA **(dengan checklist editor)**, Kecamatan.
- ✅ **Knowledge Base / FAQ**: kategori + artikel (CRUD penuh untuk koord, read untuk operator), markdown sederhana, view counter, pencarian + filter kategori.
- ✅ **Audit Log global** (/audit): semua CRUD master data + ticket status_change + assignment tercatat dengan actor, entity, action, summary, timestamp; filter entity/action/tanggal/search.
- ✅ In-app notifications, Reports Excel + PDF.
- ✅ Workflow: Draft / Diajukan / Diproses / Menunggu Dokumen / Revisi / Disetujui / Selesai / Ditolak.
- ✅ E2E test: **49/49** backend + 100% frontend flows.

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
