import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiError, API_BASE } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/Badges";
import { fmtDateTime, relativeTime, STATUS_LIST } from "@/lib/format";
import {
  ArrowLeft, Paperclip, MessageSquare, FileText, Calendar, Clock,
  ArrowRight, Upload, Download, Activity as ActivityIcon, User, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];

function activityIcon(kind) {
  if (kind === "status_change") return ArrowRight;
  if (kind === "comment") return MessageSquare;
  if (kind === "attachment") return Paperclip;
  return ActivityIcon;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tickets/${id}`);
      setTicket(data);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await api.post(`/tickets/${id}/comments`, { content: comment.trim() });
      setComment("");
      await load();
      toast.success("Komentar terkirim");
    } catch (e2) { toast.error(apiError(e2)); }
    finally { setPosting(false); }
  };

  const uploadAttachment = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.includes(f.type)) { toast.error("Format tidak didukung"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Maks 5MB"); return; }
    try {
      const b64 = await fileToBase64(f);
      await api.post(`/tickets/${id}/attachments`, { filename: f.name, mime: f.type, data_base64: b64 });
      toast.success("Dokumen terunggah");
      await load();
    } catch (e2) { toast.error(apiError(e2)); }
    e.target.value = "";
  };

  const downloadAtt = async (aid, name) => {
    try {
      const res = await api.get(`/tickets/${id}/attachments/${aid}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiError(e)); }
  };

  if (loading) return <div className="text-sm text-zinc-500">Memuat...</div>;
  if (!ticket) return <div className="text-sm text-red-600">Ticket tidak ditemukan</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/tickets" className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1 mb-3" data-testid="back-to-tickets">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar
        </Link>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="ticket-id text-sm text-zinc-500 font-medium" data-testid="ticket-number">{ticket.ticket_number}</span>
              <StatusBadge status={ticket.status} testId="ticket-status" />
              <SlaBadge state={ticket.sla_state} testId="ticket-sla" />
              <PriorityBadge priority={ticket.prioritas} />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950 mt-2" data-testid="ticket-title">
              {ticket.judul}
            </h1>
          </div>
          {user?.role === "koordinator" && (
            <StatusChangeDialog ticket={ticket} onChanged={load} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column: deskripsi + timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-zinc-200 shadow-none p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-2">Deskripsi</div>
            <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed" data-testid="ticket-description">
              {ticket.deskripsi}
            </div>
          </Card>

          <Card className="border-zinc-200 shadow-none p-6">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-4">Aktivitas</div>
            <div className="relative timeline-rail pl-10 space-y-5" data-testid="ticket-timeline">
              {(ticket.activities || []).map((a) => {
                const Icon = activityIcon(a.kind);
                return (
                  <div key={a.id} className="relative" data-testid={`activity-${a.id}`}>
                    <div className="absolute -left-[26px] top-0 h-8 w-8 rounded-full bg-white border-2 border-zinc-200 flex items-center justify-center">
                      <Icon className="h-3.5 w-3.5 text-zinc-600" />
                    </div>
                    {a.kind === "comment" ? (
                      <Card className="border-zinc-200 shadow-none p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="text-sm font-medium text-zinc-900">{a.actor_name}</div>
                          <div className="text-xs text-zinc-400">{relativeTime(a.created_at)}</div>
                        </div>
                        <div className="text-sm text-zinc-700 whitespace-pre-wrap">{a.message}</div>
                      </Card>
                    ) : (
                      <div className="text-sm text-zinc-600">
                        <span className="font-medium text-zinc-900">{a.actor_name}</span>{" "}
                        <span>{a.message}</span>{" "}
                        <span className="text-xs text-zinc-400 ml-1">• {relativeTime(a.created_at)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {(!ticket.activities || ticket.activities.length === 0) && (
                <div className="text-sm text-zinc-500">Belum ada aktivitas</div>
              )}
            </div>

            <form onSubmit={addComment} className="mt-6 pt-6 border-t border-zinc-100" data-testid="comment-form">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Tambah Komentar</Label>
              <Textarea
                rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="Tulis komentar..." className="mt-1.5"
                data-testid="comment-input"
              />
              <div className="mt-2 flex justify-end">
                <Button type="submit" disabled={posting || !comment.trim()} className="bg-zinc-950 hover:bg-zinc-800" data-testid="submit-comment-button">
                  {posting ? "Mengirim..." : "Kirim Komentar"}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-zinc-200 shadow-none p-5">
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-3">Detail</div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Jenis Layanan</dt>
                <dd className="text-zinc-900 mt-0.5">{ticket.layanan_nama}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Sekolah</dt>
                <dd className="text-zinc-900 mt-0.5">{ticket.sekolah_nama || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Operator</dt>
                <dd className="text-zinc-900 mt-0.5 inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-zinc-400" />{ticket.operator_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Kecamatan</dt>
                <dd className="text-zinc-900 mt-0.5">{ticket.kecamatan || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Diajukan</dt>
                <dd className="text-zinc-900 mt-0.5 inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-zinc-400" />{fmtDateTime(ticket.submitted_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">SLA Target</dt>
                <dd className="text-zinc-900 mt-0.5 inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-zinc-400" />{ticket.sla_days} hari • jatuh tempo {fmtDateTime(ticket.due_at)}</dd>
              </div>
              {ticket.closed_at && (
                <div>
                  <dt className="text-xs text-zinc-500">Ditutup</dt>
                  <dd className="text-zinc-900 mt-0.5">{fmtDateTime(ticket.closed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="border-zinc-200 shadow-none p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Lampiran</div>
              {(user?.role === "operator" || user?.role === "koordinator") && (
                <label className="text-xs text-zinc-700 hover:text-zinc-900 cursor-pointer inline-flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> Upload
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={uploadAttachment} data-testid="upload-attachment-input" />
                </label>
              )}
            </div>
            <div className="space-y-2" data-testid="attachments-list">
              {(ticket.attachments || []).length === 0 && <div className="text-xs text-zinc-500">Belum ada lampiran</div>}
              {(ticket.attachments || []).map((a) => (
                <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-zinc-200 bg-zinc-50 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                    <span className="truncate">{a.filename}</span>
                  </span>
                  <button onClick={() => downloadAtt(a.id, a.filename)} className="text-zinc-700 hover:text-zinc-900" data-testid={`download-${a.id}`}>
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {ticket.status === "Revisi" && user?.role === "operator" && (
            <Card className="border-orange-200 bg-orange-50 shadow-none p-4">
              <div className="text-sm text-orange-800 inline-flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Pengajuan diminta revisi. Silakan tambahkan dokumen / komentar yang diperlukan dan respon kepada koordinator.</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusChangeDialog({ ticket, onChanged }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/tickets/${ticket.id}/status`, { status, catatan: catatan || undefined });
      toast.success("Status diperbarui");
      setOpen(false); setCatatan("");
      onChanged();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-zinc-950 hover:bg-zinc-800" data-testid="change-status-button">Ubah Status</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Status Pengajuan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Status Baru</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 mt-1" data-testid="status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Catatan (opsional)</Label>
            <Textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1" data-testid="status-catatan" placeholder="Tambahkan catatan untuk operator..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={submit} disabled={busy} className="bg-zinc-950 hover:bg-zinc-800" data-testid="confirm-status-change">
            {busy ? "Memproses..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
