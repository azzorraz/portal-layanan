import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Loader2, TrendingUp, Building2, Users, CheckCircle2, Clock3, Activity, Crown } from "lucide-react";
import { toast } from "sonner";

const PALETTE = ["#09090b", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function StatBlock({ icon: Icon, label, value, hint, accent = "bg-zinc-100 text-zinc-700" }) {
  return (
    <Card className="p-5 border-zinc-200 shadow-none">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">{label}</div>
        <div className={`h-7 w-7 rounded-md inline-flex items-center justify-center ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-950">{value}</div>
      {hint && <div className="text-xs text-zinc-500 mt-1">{hint}</div>}
    </Card>
  );
}

export default function Executive() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from_date = from;
      if (to) params.to_date = to;
      const { data } = await api.get("/executive/stats", { params });
      setStats(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  if (loading || !stats) {
    return <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat data eksekutif...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">
            <Crown className="h-3 w-3" /> Executive
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Dashboard Pimpinan</h1>
          <p className="text-sm text-zinc-500 mt-1">Pandangan eksekutif atas seluruh operasional layanan Dapodik.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Dari</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 mt-1" data-testid="exec-from" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Sampai</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 mt-1" data-testid="exec-to" />
          </div>
          <button onClick={load} className="h-10 px-4 rounded-md bg-zinc-950 hover:bg-zinc-800 text-white text-sm font-medium" data-testid="exec-apply">Terapkan</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBlock icon={TrendingUp} label="Total Pengajuan" value={stats.total} accent="bg-zinc-100 text-zinc-700" />
        <StatBlock icon={CheckCircle2} label="Selesai" value={stats.selesai} accent="bg-emerald-50 text-emerald-700" />
        <StatBlock icon={Activity} label="Sedang Diproses" value={stats.diproses} accent="bg-amber-50 text-amber-700" />
        <StatBlock icon={Clock3} label="Rata-rata Penyelesaian" value={`${stats.avg_processing_hours} jam`} hint={`SLA compliance: ${stats.sla_compliance_pct}%`} accent="bg-blue-50 text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Distribusi</div>
          <h3 className="font-display text-lg font-medium tracking-tight">Pengajuan per Kecamatan</h3>
          <div className="h-72 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.by_kecamatan} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} allowDecimals={false} />
                <YAxis dataKey="kecamatan" type="category" tick={{ fontSize: 11, fill: "#52525b" }} width={120} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }} />
                <Bar dataKey="count" fill="#09090b" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Komposisi</div>
          <h3 className="font-display text-lg font-medium tracking-tight">Per Jenis Layanan</h3>
          <div className="h-72 mt-2">
            {stats.by_layanan.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500">Belum ada data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.by_layanan} dataKey="count" nameKey="layanan" outerRadius={80}>
                    {stats.by_layanan.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1 mt-2 text-xs">
            {stats.by_layanan.slice(0, 5).map((s, i) => (
              <div key={s.layanan} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-zinc-600 truncate">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="truncate">{s.layanan}</span>
                </span>
                <span className="font-mono">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 flex items-center gap-1.5">
            <Building2 className="h-3 w-3" /> Top Sekolah
          </div>
          <h3 className="font-display text-lg font-medium tracking-tight">Pengajuan Terbanyak</h3>
          <div className="mt-3 space-y-2">
            {stats.top_sekolah.slice(0, 8).map((s, i) => (
              <div key={s.sekolah + i} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-50">
                <span className="text-sm text-zinc-700 truncate flex items-center gap-2">
                  <span className="text-zinc-400 font-mono text-xs w-5">{i + 1}.</span>
                  <span className="truncate">{s.sekolah}</span>
                </span>
                <span className="font-mono text-sm font-medium">{s.count}</span>
              </div>
            ))}
            {stats.top_sekolah.length === 0 && <div className="text-sm text-zinc-500">Belum ada data</div>}
          </div>
        </Card>

        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Workload
          </div>
          <h3 className="font-display text-lg font-medium tracking-tight">Beban Petugas</h3>
          <div className="mt-3 space-y-2">
            {stats.workload.map((w) => (
              <div key={w.assignee_id} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-zinc-50">
                <span className="text-sm text-zinc-700 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-zinc-900 text-white text-[10px] font-semibold inline-flex items-center justify-center">
                    {(w.assignee_name || "?").split(" ").map(p => p[0]).slice(0, 2).join("")}
                  </span>
                  {w.assignee_name}
                </span>
                <span className="font-mono text-sm font-medium">{w.count}</span>
              </div>
            ))}
            {stats.workload.length === 0 && <div className="text-sm text-zinc-500">Belum ada tiket yang ditugaskan</div>}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-zinc-200 shadow-none">
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Performa</div>
        <h3 className="font-display text-lg font-medium tracking-tight">Rata-rata Penyelesaian per Layanan</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-zinc-200">
              <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Layanan</th>
              <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Rata-rata (Jam)</th>
              <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Jumlah Selesai</th>
            </tr></thead>
            <tbody>
              {stats.avg_per_layanan.map((r) => (
                <tr key={r.layanan} className="border-b border-zinc-100">
                  <td className="px-2 py-2 text-zinc-900">{r.layanan}</td>
                  <td className="px-2 py-2 text-right font-mono">{r.avg_hours}</td>
                  <td className="px-2 py-2 text-right font-mono">{r.count}</td>
                </tr>
              ))}
              {stats.avg_per_layanan.length === 0 && (
                <tr><td colSpan={3} className="px-2 py-6 text-center text-zinc-500">Belum ada tiket terselesaikan</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
