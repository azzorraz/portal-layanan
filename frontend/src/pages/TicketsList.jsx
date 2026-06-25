import { useEffect, useMemo, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge, SlaBadge, PriorityBadge } from "@/components/Badges";
import { STATUS_LIST, fmtDate } from "@/lib/format";
import { Filter, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [layananId, setLayananId] = useState("all");
  const [kecamatan, setKecamatan] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [layananOpts, setLayananOpts] = useState([]);
  const [kecOpts, setKecOpts] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (status !== "all") params.status = status;
      if (layananId !== "all") params.layanan_id = layananId;
      if (kecamatan !== "all") params.kecamatan = kecamatan;
      if (slaFilter !== "all") params.sla_filter = slaFilter;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const { data } = await api.get("/tickets", { params });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">No. Ticket</th>
                <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Judul / Layanan</th>
                {user?.role === "koordinator" && (
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
                <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-500">Memuat...</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-16 text-center">
                  <div className="text-zinc-500 text-sm">Belum ada pengajuan</div>
                  {user?.role === "operator" && (
                    <Button asChild className="mt-3 bg-zinc-950 hover:bg-zinc-800" size="sm">
                      <Link to="/tickets/new">Buat pengajuan pertama</Link>
                    </Button>
                  )}
                </td></tr>
              )}
              {!loading && items.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors" data-testid={`ticket-row-${t.ticket_number}`}>
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
                  {user?.role === "koordinator" && (
                    <td className="px-4 py-3">
                      <div className="text-zinc-900">{t.sekolah_nama || "—"}</div>
                      <div className="text-xs text-zinc-500">{t.operator_name}</div>
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
      </Card>
    </div>
  );
}
