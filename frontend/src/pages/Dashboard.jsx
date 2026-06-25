import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, Inbox, Loader2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { STATUS_STYLES } from "@/lib/format";

const SLOT_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const SLA_TRAFFIC = {
  emerald: { ring: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", glow: "shadow-emerald-100" },
  amber: { ring: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", glow: "shadow-amber-100" },
  red: { ring: "border-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", glow: "shadow-red-100" },
};

function SlaTrafficCard({ color, label, value, hint, testId }) {
  const c = SLA_TRAFFIC[color];
  return (
    <Card data-testid={testId} className={`p-5 border-2 ${c.ring} ${c.bg} shadow-none hover:shadow ${c.glow} transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className={`text-[11px] uppercase tracking-[0.14em] font-semibold ${c.text}`}>{label}</div>
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot} animate-pulse`} />
      </div>
      <div className={`mt-3 font-display text-4xl font-semibold tracking-tight ${c.text}`}>{value}</div>
      <div className="text-xs text-zinc-600 mt-1">{hint}</div>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, accent, testId, sublabel }) {
  return (
    <Card data-testid={testId} className="p-5 border-zinc-200 shadow-none hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">{label}</div>
        <div className={`h-7 w-7 rounded-md inline-flex items-center justify-center ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-950" data-testid={`${testId}-value`}>
        {value}
      </div>
      {sublabel && <div className="text-xs text-zinc-500 mt-1">{sublabel}</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats");
        setStats(data);
      } catch (e) { setErr(apiError(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8" data-testid="dashboard-skeleton">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-zinc-200 rounded animate-pulse" />
          <div className="h-9 w-80 bg-zinc-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-lg border border-zinc-200 bg-white p-5 animate-pulse">
              <div className="h-2.5 w-16 bg-zinc-200 rounded" />
              <div className="h-8 w-12 bg-zinc-200 rounded mt-4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-lg border-2 border-zinc-200 bg-white p-5 animate-pulse">
              <div className="h-2.5 w-20 bg-zinc-200 rounded" />
              <div className="h-9 w-16 bg-zinc-200 rounded mt-3" />
            </div>
          ))}
        </div>
        <div className="h-80 rounded-lg border border-zinc-200 bg-white animate-pulse" />
      </div>
    );
  }
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!stats) return null;

  const slaData = [
    { name: "Tepat Waktu", value: stats.sla.on_time },
    { name: "Hampir Terlambat", value: stats.sla.almost },
    { name: "Terlambat", value: stats.sla.late },
  ];
  const slaTotal = slaData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Dashboard</div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
            Selamat datang, {user?.name?.split(" ")[0] || "Pengguna"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Ringkasan pengajuan layanan Dapodik secara real-time.</p>
        </div>
        {user?.role === "operator" && (
          <Button asChild className="bg-zinc-950 hover:bg-zinc-800">
            <Link to="/tickets/new" data-testid="dashboard-new-ticket-button">+ Buat Pengajuan</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard testId="stat-total" icon={FileText} label="Total Pengajuan" value={stats.total} accent="bg-zinc-100 text-zinc-700" />
        <StatCard testId="stat-today" icon={Inbox} label="Hari Ini" value={stats.today} accent="bg-blue-50 text-blue-700" />
        <StatCard testId="stat-diproses" icon={Activity} label="Diproses" value={stats.diproses} accent="bg-amber-50 text-amber-700" />
        <StatCard testId="stat-revisi" icon={AlertTriangle} label="Revisi" value={stats.revisi} accent="bg-orange-50 text-orange-700" />
        <StatCard testId="stat-selesai" icon={CheckCircle2} label="Selesai" value={stats.selesai} accent="bg-emerald-50 text-emerald-700" />
        <StatCard testId="stat-ditolak" icon={XCircle} label="Ditolak" value={stats.ditolak} accent="bg-red-50 text-red-700" />
      </div>

      {/* SLA Traffic Light */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-3">SLA Indicator</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SlaTrafficCard
            testId="sla-on-time"
            color="emerald"
            label="Tepat Waktu"
            value={stats.sla.on_time}
            hint="Pengajuan berjalan sesuai target SLA"
          />
          <SlaTrafficCard
            testId="sla-almost"
            color="amber"
            label="Hampir Terlambat"
            value={stats.sla.almost}
            hint="Sisa waktu < 24 jam — perlu prioritas"
          />
          <SlaTrafficCard
            testId="sla-late"
            color="red"
            label="Terlambat"
            value={stats.sla.late}
            hint="Sudah melewati batas SLA — eskalasi segera"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-zinc-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Grafik 6 Bulan Terakhir</div>
              <h3 className="font-display text-lg font-medium tracking-tight">Pengajuan per Bulan</h3>
            </div>
          </div>
          <div className="h-72" data-testid="monthly-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                />
                <Bar dataKey="count" fill="#09090b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">SLA Monitoring</div>
          <h3 className="font-display text-lg font-medium tracking-tight">Status SLA Berjalan</h3>
          <div className="h-48 mt-2" data-testid="sla-chart">
            {slaTotal > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slaData} dataKey="value" innerRadius={36} outerRadius={64} paddingAngle={2}>
                    {slaData.map((_, i) => <Cell key={i} fill={SLOT_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <Clock className="h-6 w-6 text-zinc-300 mb-2" />
                <div className="text-xs text-zinc-500">Tidak ada pengajuan berjalan</div>
              </div>
            )}
          </div>
          <div className="space-y-2 mt-2">
            {slaData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-zinc-700">
                  <span className="w-2 h-2 rounded-full" style={{ background: SLOT_COLORS[i] }} />
                  {s.name}
                </span>
                <span className="font-mono font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {stats.by_status?.length > 0 && (
        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Distribusi Status</div>
              <h3 className="font-display text-lg font-medium tracking-tight">Pengajuan per Status</h3>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {stats.by_status.map((s) => {
              const st = STATUS_STYLES[s.status] || STATUS_STYLES.Draft;
              return (
                <div key={s.status} className={`px-3 py-2 rounded-md border ${st.border} ${st.bg}`}>
                  <div className={`text-xs ${st.text} font-medium flex items-center gap-1.5`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {s.status}
                  </div>
                  <div className="font-mono text-lg font-semibold mt-0.5">{s.count}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
