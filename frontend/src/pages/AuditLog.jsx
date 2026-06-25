import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format";
import { Activity, Building2, FileText, ShieldCheck, Search, RotateCw, User as UserIcon, BookOpen, MapPin, X } from "lucide-react";
import { toast } from "sonner";

const ENTITY_LABEL = {
  sekolah: { label: "Sekolah", icon: Building2, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  operator: { label: "Operator", icon: UserIcon, cls: "bg-purple-50 text-purple-700 border-purple-200" },
  layanan: { label: "Layanan", icon: FileText, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  kecamatan: { label: "Kecamatan", icon: MapPin, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  ticket: { label: "Ticket", icon: Activity, cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  kb_article: { label: "KB Artikel", icon: BookOpen, cls: "bg-orange-50 text-orange-700 border-orange-200" },
  kb_category: { label: "KB Kategori", icon: BookOpen, cls: "bg-orange-50 text-orange-700 border-orange-200" },
  system: { label: "System", icon: ShieldCheck, cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
};

const ACTION_LABEL = {
  create: { label: "Buat", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  update: { label: "Ubah", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  delete: { label: "Hapus", cls: "bg-red-50 text-red-700 border-red-200" },
  status_change: { label: "Status", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  assign: { label: "Assign", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  bulk_assign: { label: "Bulk Assign", cls: "bg-purple-50 text-purple-700 border-purple-300" },
  bulk_status: { label: "Bulk Status", cls: "bg-amber-50 text-amber-700 border-amber-300" },
  bulk_priority: { label: "Bulk Priority", cls: "bg-blue-50 text-blue-700 border-blue-300" },
  bulk_delete: { label: "Bulk Delete", cls: "bg-red-50 text-red-700 border-red-300" },
  cleanup_test: { label: "Cleanup TEST", cls: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  test_whatsapp: { label: "Test WA", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
};

const ENTITIES = ["sekolah", "operator", "layanan", "kecamatan", "ticket", "kb_article", "kb_category", "system"];
const ACTIONS = ["create", "update", "delete", "status_change", "assign", "bulk_assign", "bulk_status", "bulk_priority", "bulk_delete", "cleanup_test", "test_whatsapp"];

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("all");
  const [action, setAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (q) params.q = q;
      if (entity !== "all") params.entity = entity;
      if (action !== "all") params.action = action;
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      const { data } = await api.get("/audit", { params });
      setItems(data.items); setTotal(data.total);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [entity, action]);

  const clear = () => { setQ(""); setEntity("all"); setAction("all"); setFromDate(""); setToDate(""); setTimeout(load, 0); };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3" /> Audit
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Log Aktivitas</h1>
        <p className="text-sm text-zinc-500 mt-1">{total} catatan • setiap perubahan data tercatat dan tidak dapat diubah.</p>
      </div>

      <Card className="border-zinc-200 shadow-none p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Pencarian</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Cari ringkasan atau nama..." className="pl-9 h-10" data-testid="audit-search-input" />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Entitas</Label>
            <Select value={entity} onValueChange={setEntity}>
              <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {ENTITIES.map((e) => <SelectItem key={e} value={e}>{ENTITY_LABEL[e]?.label || e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Aksi</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_LABEL[a]?.label || a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={load} className="bg-zinc-950 hover:bg-zinc-800 h-10 flex-1" data-testid="audit-apply">
              <RotateCw className="h-4 w-4 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Dari</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Sampai</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 mt-1" />
          </div>
          <Button onClick={load} className="bg-zinc-950 hover:bg-zinc-800 h-10">Terapkan Tanggal</Button>
          {(q || entity !== "all" || action !== "all" || fromDate || toDate) && (
            <Button onClick={clear} variant="outline" className="h-10"><X className="h-4 w-4 mr-1.5" />Reset</Button>
          )}
        </div>
      </Card>

      <Card className="border-zinc-200 shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500 w-44">Waktu</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Aktor</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Entitas</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Aksi</th>
              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Ringkasan</th>
            </tr></thead>
            <tbody data-testid="audit-table-body">
              {loading && <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">Memuat...</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center text-zinc-500">Belum ada catatan</td></tr>}
              {!loading && items.map((a) => {
                const ent = ENTITY_LABEL[a.entity] || { label: a.entity, icon: Activity, cls: "bg-zinc-100 text-zinc-700 border-zinc-200" };
                const act = ACTION_LABEL[a.action] || { label: a.action, cls: "bg-zinc-100 text-zinc-700 border-zinc-200" };
                const Icon = ent.icon;
                return (
                  <tr key={a.id} className="border-b border-zinc-100 hover:bg-zinc-50/60">
                    <td className="px-4 py-3 text-xs font-mono text-zinc-600">{fmtDateTime(a.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="text-zinc-900">{a.actor_name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{a.actor_role}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${ent.cls}`}>
                        <Icon className="h-3 w-3" /> {ent.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${act.cls}`}>{act.label}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{a.summary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
