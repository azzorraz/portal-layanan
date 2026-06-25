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
- ✅ Seed: 1 koordinator + 3 operator + 3 sekolah + 6 kecamatan + 11 default layanan dengan SLA.
- ✅ Tickets: create (operator only) with attachments; list with filter & search & SLA filter; detail page with timeline (GitHub-Issue style); status change (koord only) with audit trail; comments; per-ticket attachment upload/download.
- ✅ Auto ticket number `TCK-YYYY-NNNNNN` via Mongo counter.
- ✅ SLA computation: due_at = submitted_at + sla_days; states `tepat_waktu / hampir_terlambat / terlambat / selesai`.
- ✅ Dashboard: 6 stat cards (Total, Hari Ini, Diproses, Revisi, Selesai, Ditolak), monthly bar chart (6 bulan), SLA pie chart, status distribution.
- ✅ Master Data CRUD: Sekolah, Operator (one-per-sekolah validated on create + update), Layanan & SLA, Kecamatan.
- ✅ In-app notifications: bell with unread badge, auto-poll every 25s.
- ✅ Reports: Excel (openpyxl) + PDF (reportlab) download with date-range + status + layanan + kecamatan filters.
- ✅ Workflow: Draft / Diajukan / Diproses / Menunggu Dokumen / Revisi / Disetujui / Selesai / Ditolak.
- ✅ E2E test: 29/29 backend + 100% frontend flows.

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
