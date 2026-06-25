import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/Badges";
import { STATUS_LIST, fmtDate } from "@/lib/format";
import { Filter, Loader2, Plus, Search, UserCheck, Workflow, X } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 30;

const SLA_OPTIONS = [
  { value: "all", label: "Semua SLA" },
  { value: "tepat_waktu", label: "Tepat Waktu" },
  { value: "hampir_terlambat", label: "Hampir Terlambat" },
  { value: "terlambat", label: "Terlambat" },
];

export default function TicketsList() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [layananId, setLayananId] = useState("all");
  const [kecamatan, setKecamatan] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [layananOpts, setLayananOpts] = useState([]);
  const [kecOpts, setKecOpts] = useState([]);
  const sentinelRef = useRef(null);
  const [selected, setSelected] = useState(new Set());

  const isKoor = user?.role === "koordinator";
  const toggleSel = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((prev) => {
    if (prev.size === items.length) return new Set();
    return new Set(items.map((i) => i.id));
  });
  const clearSelection = () => setSelected(new Set());

  const buildParams = (skipVal) => {
    const params = { limit: PAGE_SIZE, skip: skipVal };
    if (q) params.q = q;
    if (status !== "all") params.status = status;
    if (layananId !== "all") params.layanan_id = layananId;
    if (kecamatan !== "all") params.kecamatan = kecamatan;
    if (slaFilter !== "all") params.sla_filter = slaFilter;
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    return params;
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/tickets", { params: buildParams(0) });
      setItems(data.items); setTotal(data.total); setSkip(data.items.length);
      setHasMore(data.items.length === PAGE_SIZE);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data } = await api.get("/tickets", { params: buildParams(skip) });
      setItems((prev) => [...prev, ...data.items]);
      setSkip((s) => s + data.items.length);
      setHasMore(data.items.length === PAGE_SIZE);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [{ data: lay }, { data: kec }] = await Promise.all([
          api.get("/layanan"),
          api.get("/kecamatan"),
        ]);
        setLayananOpts(lay);
        setKecOpts(kec);
      } catch { /* noop */ }
    })();
  }, []);

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [status, layananId, kecamatan, slaFilter]);

  // Infinite scroll observer
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hasMore, skip, loadingMore]);

  // clear selection when filters change
  useEffect(() => { setSelected(new Set()); }, [status, layananId, kecamatan, slaFilter, fromDate, toDate, q]);

  const hasFilter = status !== "all" || layananId !== "all" || kecamatan !== "all" || slaFilter !== "all" || fromDate || toDate || q;

  const clear = () => {
    setQ(""); setStatus("all"); setLayananId("all"); setKecamatan("all"); setSlaFilter("all"); setFromDate(""); setToDate("");
    setTimeout(load, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Daftar</div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Tickets</h1>
          <p className="text-sm text-zinc-500 mt-1">{total} pengajuan ditemukan</p>
        </div>
        {user?.role === "operator" && (
          <Button asChild className="bg-zinc-950 hover:bg-zinc-800">
            <Link to="/tickets/new" data-testid="tickets-new-button">
              <Plus className="h-4 w-4 mr-1.5" /> Buat Pengajuan
            </Link>
          </Button>
        )}
      </div>

      <Card className="border-zinc-200 shadow-none p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Pencarian</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                data-testid="tickets-search-input"
                placeholder="Cari no. ticket, sekolah, operator, layanan..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                className="pl-9 h-10"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10 mt-1" data-testid="filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Layanan</Label>
              <Select value={layananId} onValueChange={setLayananId}>
                <SelectTrigger className="h-10 mt-1" data-testid="filter-layanan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Layanan</SelectItem>
                  {layananOpts.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {user?.role === "koordinator" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Kecamatan</Label>
                <Select value={kecamatan} onValueChange={setKecamatan}>
                  <SelectTrigger className="h-10 mt-1" data-testid="filter-kecamatan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    {kecOpts.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">SLA</Label>
              <Select value={slaFilter} onValueChange={setSlaFilter}>
                <SelectTrigger className="h-10 mt-1" data-testid="filter-sla"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SLA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Dari</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 mt-1" data-testid="filter-from-date" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Sampai</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 mt-1" data-testid="filter-to-date" />
          </div>
          <Button onClick={load} className="bg-zinc-950 hover:bg-zinc-800 h-10" data-testid="apply-filter-button">
            <Filter className="h-4 w-4 mr-1.5" /> Terapkan
          </Button>
          {hasFilter && (
            <Button variant="outline" onClick={clear} className="h-10" data-testid="clear-filter-button">
              <X className="h-4 w-4 mr-1.5" /> Reset
            </Button>
          )}
        </div>
      </Card>

      <Card className="border-zinc-200 shadow-none overflow-hidden">
        {isKoor && selected.size > 0 && (
          <BulkActionBar
            count={selected.size}
            ticketIds={Array.from(selected)}
            onClear={clearSelection}
            onDone={() => { clearSelection(); load(); }}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                {isKoor && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selected.size === items.length}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                      data-testid="select-all-checkbox"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">No. Ticket</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Judul / Layanan</th>
                {isKoor && (
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Sekolah / Operator</th>
                )}
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Tanggal</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Status</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Prioritas</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">SLA</th>
              </tr>
            </thead>
            <tbody data-testid="tickets-table-body">
              {loading && (
                <tr><td colSpan={isKoor ? 8 : 6} className="px-4 py-12 text-center text-zinc-500">Memuat...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={isKoor ? 8 : 6} className="px-4 py-16 text-center">
                  <div className="text-zinc-500 text-sm">Belum ada pengajuan</div>
                  {user?.role === "operator" && (
                    <Button asChild className="mt-3 bg-zinc-950 hover:bg-zinc-800" size="sm">
                      <Link to="/tickets/new">Buat pengajuan pertama</Link>
                    </Button>
                  )}
                </td></tr>
              )}
              {!loading && items.map((t) => (
                <tr key={t.id} className={`border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors ${selected.has(t.id) ? "bg-blue-50/40" : ""}`} data-testid={`ticket-row-${t.ticket_number}`}>
                  {isKoor && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(t.id)}
                        onChange={() => toggleSel(t.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                        data-testid={`row-checkbox-${t.ticket_number}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link to={`/tickets/${t.id}`} className="ticket-id text-zinc-900 hover:underline font-medium" data-testid={`ticket-link-${t.ticket_number}`}>
                      {t.ticket_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-[320px]">
                    <Link to={`/tickets/${t.id}`} className="text-zinc-900 font-medium hover:underline block truncate">
                      {t.judul}
                    </Link>
                    <div className="text-xs text-zinc-500 truncate">{t.layanan_nama}</div>
                  </td>
                  {isKoor && (
                    <td className="px-4 py-3">
                      <div className="text-zinc-900">{t.sekolah_nama || "—"}</div>
                      <div className="text-xs text-zinc-500">{t.operator_name}{t.assignee_name ? ` • Petugas: ${t.assignee_name}` : ""}</div>
                    </td>
                  )}
                  <td className="px-4 py-3 text-zinc-600">{fmtDate(t.submitted_at)}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} testId={`row-status-${t.ticket_number}`} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={t.prioritas} /></td>
                  <td className="px-4 py-3"><SlaBadge state={t.sla_state} testId={`row-sla-${t.ticket_number}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Infinite scroll sentinel */}
        {items.length > 0 && (
          <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-500" data-testid="infinite-scroll-sentinel">
            {loadingMore ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat lebih banyak...</span>
            ) : hasMore ? (
              <button onClick={loadMore} className="hover:text-zinc-900" data-testid="load-more-button">Muat lebih banyak ({total - items.length} tersisa)</button>
            ) : (
              <span>Semua data dimuat • {items.length} dari {total}</span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function BulkActionBar({ count, ticketIds, onClear, onDone }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-b border-blue-200"
      data-testid="bulk-action-bar"
    >
      <div className="flex items-center gap-2 text-sm text-blue-900">
        <span className="font-semibold" data-testid="bulk-selected-count">{count}</span>
        <span>tiket dipilih</span>
        <button onClick={onClear} className="ml-2 text-blue-700 hover:text-blue-900 inline-flex items-center gap-1" data-testid="bulk-clear-selection">
          <X className="h-3.5 w-3.5" /> bersihkan
        </button>
      </div>
      <div className="flex items-center gap-2">
        <BulkAssignDialog ticketIds={ticketIds} onDone={onDone} />
        <BulkStatusDialog ticketIds={ticketIds} onDone={onDone} />
      </div>
    </div>
  );
}

function BulkAssignDialog({ ticketIds, onDone }) {
  const [open, setOpen] = useState(false);
  const [koords, setKoords] = useState([]);
  const [assigneeId, setAssigneeId] = useState("unassigned");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try { const { data } = await api.get("/koordinators"); setKoords(data); } catch { /* noop */ }
    })();
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/tickets/bulk-assign", {
        ticket_ids: ticketIds,
        assignee_id: assigneeId === "unassigned" ? null : assigneeId,
      });
      toast.success(`${data.updated} tiket diperbarui`);
      setOpen(false);
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="bg-white" data-testid="bulk-assign-button">
          <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Tugaskan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tugaskan {ticketIds.length} Tiket</DialogTitle>
          <DialogDescription>Pilih petugas untuk menangani seluruh tiket yang dipilih.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Petugas</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="h-10 mt-1" data-testid="bulk-assignee-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">— Tidak ditugaskan —</SelectItem>
                {koords.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={submit} disabled={busy} className="bg-zinc-950 hover:bg-zinc-800" data-testid="confirm-bulk-assign">
            {busy ? "Memproses..." : `Tugaskan ${ticketIds.length} Tiket`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkStatusDialog({ ticketIds, onDone }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Diproses");
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!window.confirm(`Ubah status ${ticketIds.length} tiket menjadi "${status}"?`)) return;
    setBusy(true);
    try {
      const { data } = await api.post("/tickets/bulk-status", {
        ticket_ids: ticketIds,
        status,
        catatan: catatan || undefined,
      });
      toast.success(`${data.updated} tiket diperbarui`);
      setOpen(false); setCatatan("");
      onDone();
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-zinc-950 hover:bg-zinc-800" data-testid="bulk-status-button">
          <Workflow className="h-3.5 w-3.5 mr-1.5" /> Ubah Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Status {ticketIds.length} Tiket</DialogTitle>
          <DialogDescription>Perubahan diterapkan ke seluruh tiket terpilih dan tercatat di timeline + audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Status Baru</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 mt-1" data-testid="bulk-status-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Catatan (opsional)</Label>
            <Textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1" data-testid="bulk-status-catatan" placeholder="Catatan untuk semua tiket..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={submit} disabled={busy} className="bg-zinc-950 hover:bg-zinc-800" data-testid="confirm-bulk-status">
            {busy ? "Memproses..." : `Terapkan ke ${ticketIds.length} Tiket`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
