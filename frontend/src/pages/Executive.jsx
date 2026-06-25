import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, Line, LineChart,
} from "recharts";
import { Loader2, TrendingUp, Building2, Users, CheckCircle2, Clock3, Activity, Crown, MessageSquare, AlertOctagon, CheckCheck, BatteryMedium, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

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
  const [waStats, setWaStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from_date = from;
      if (to) params.to_date = to;
      const [{ data: s }, { data: w }] = await Promise.all([
        api.get("/executive/stats", { params }),
        api.get("/executive/whatsapp-stats", { params }),
      ]);
      setStats(s); setWaStats(w);
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
          <button onClick={load} className="h-10 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium" data-testid="exec-apply">Terapkan</button>
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

      {/* WhatsApp Delivery Stats */}
      {waStats && <WhatsAppStats data={waStats} onRefresh={load} />}
    </div>
  );
}

function WhatsAppStats({ data, onRefresh }) {
  const SEND_PALETTE = { sent: "#10b981", failed: "#ef4444" };
  const quotaLow = data.quota_remaining !== null && data.quota_remaining < 50;
  const [resending, setResending] = useState(null);

  const handleResend = async (logId) => {
    setResending(logId);
    try {
      const { data: res } = await api.post(`/admin/wa-logs/${logId}/resend`);
      if (res.status) toast.success("Pesan terkirim ulang");
      else toast.error(res.detail || "Gagal mengirim ulang");
    } catch (e) { toast.error(apiError(e)); }
    finally {
      setResending(null);
      onRefresh?.();
    }
  };

  return (
    <div className="space-y-4" data-testid="wa-stats-section">
      <div className="flex items-center gap-2 pt-4">
        <div className="h-8 w-8 rounded-md bg-emerald-100 text-emerald-700 inline-flex items-center justify-center">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Channel</div>
          <h2 className="font-display text-xl font-semibold tracking-tight">WhatsApp Delivery</h2>
        </div>
      </div>

      {quotaLow && (
        <Card className="border-amber-300 bg-amber-50 shadow-none p-4" data-testid="wa-quota-low-banner">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-900">Quota WhatsApp Hampir Habis</div>
              <div className="text-sm text-amber-800 mt-0.5">
                Sisa <strong>{data.quota_remaining}</strong> pesan. Segera top-up di dashboard Fonnte untuk menghindari kegagalan notifikasi. Notifikasi alert otomatis telah dikirim ke semua koordinator.
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-zinc-200 shadow-none" data-testid="wa-stat-quota">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">Sisa Quota Fonnte</div>
            <div className="h-7 w-7 rounded-md bg-blue-50 text-blue-700 inline-flex items-center justify-center"><BatteryMedium className="h-3.5 w-3.5" /></div>
          </div>
          <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-950">{data.quota_remaining ?? "—"}</div>
          <div className="text-xs text-zinc-500 mt-1">Pesan tersisa</div>
        </Card>
        <Card className="p-5 border-zinc-200 shadow-none" data-testid="wa-stat-sent">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">Terkirim</div>
            <div className="h-7 w-7 rounded-md bg-emerald-50 text-emerald-700 inline-flex items-center justify-center"><CheckCheck className="h-3.5 w-3.5" /></div>
          </div>
          <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-emerald-700">{data.sent}</div>
          <div className="text-xs text-zinc-500 mt-1">{data.sent_24h} dalam 24 jam • {data.sent_7d} dalam 7 hari</div>
        </Card>
        <Card className="p-5 border-zinc-200 shadow-none" data-testid="wa-stat-failed">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">Gagal</div>
            <div className="h-7 w-7 rounded-md bg-red-50 text-red-700 inline-flex items-center justify-center"><AlertOctagon className="h-3.5 w-3.5" /></div>
          </div>
          <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-red-700">{data.failed}</div>
          <div className="text-xs text-zinc-500 mt-1">{data.skipped} dilewati (opt-out / no phone)</div>
        </Card>
        <Card className="p-5 border-zinc-200 shadow-none" data-testid="wa-stat-success-rate">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-zinc-500">Tingkat Keberhasilan</div>
            <div className="h-7 w-7 rounded-md bg-zinc-100 text-zinc-700 inline-flex items-center justify-center"><CheckCircle2 className="h-3.5 w-3.5" /></div>
          </div>
          <div className="mt-3 font-display text-3xl font-semibold tracking-tight text-zinc-950">{data.success_rate}%</div>
          <div className="text-xs text-zinc-500 mt-1">Dari {data.total} percobaan</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Trend 14 Hari</div>
          <h3 className="font-display text-lg font-medium tracking-tight">Pesan WhatsApp per Hari</h3>
          <div className="h-64 mt-2 min-h-[16rem]">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <LineChart data={data.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" name="Terkirim" stroke={SEND_PALETTE.sent} strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="failed" name="Gagal" stroke={SEND_PALETTE.failed} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-zinc-200 shadow-none">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Per Event</div>
          <h3 className="font-display text-lg font-medium tracking-tight">Distribusi Notifikasi</h3>
          <div className="mt-3 space-y-2">
            {data.by_event.length === 0 && <div className="text-sm text-zinc-500">Belum ada pengiriman</div>}
            {data.by_event.map((e) => {
              const total = e.sent + e.failed;
              const ratio = total ? Math.round((e.sent / total) * 100) : 0;
              return (
                <div key={e.event} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-700 capitalize">{e.event.replace(/_/g, " ")}</span>
                    <span className="font-mono text-zinc-600">{e.sent}/{total} ({ratio}%)</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${ratio}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {data.recent_failures.length > 0 && (
        <Card className="p-6 border-zinc-200 shadow-none" data-testid="wa-recent-failures">
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500">Recent Failures</div>
          <h3 className="font-display text-lg font-medium tracking-tight">10 Kegagalan Terbaru</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-zinc-200">
                <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Waktu</th>
                <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Ticket</th>
                <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Event</th>
                <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Tujuan</th>
                <th className="text-left px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Detail</th>
                <th className="text-right px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Aksi</th>
              </tr></thead>
              <tbody>
                {data.recent_failures.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-100" data-testid={`wa-failure-row-${f.id}`}>
                    <td className="px-2 py-2 text-xs font-mono text-zinc-600">{fmtDateTime(f.created_at)}</td>
                    <td className="px-2 py-2 font-mono text-xs">{f.ticket_number || "—"}</td>
                    <td className="px-2 py-2 text-zinc-700 capitalize">{(f.event_type || "").replace(/_/g, " ")}</td>
                    <td className="px-2 py-2 font-mono text-xs">****{f.phone_last4}</td>
                    <td className="px-2 py-2 text-xs text-red-700 break-all">{f.detail}</td>
                    <td className="px-2 py-2 text-right">
                      <Button
                        size="sm" variant="outline"
                        disabled={resending === f.id || !f.ticket_number || (f.event_type || "").startsWith("test")}
                        onClick={() => handleResend(f.id)}
                        className="h-7 text-xs"
                        data-testid={`wa-resend-${f.id}`}
                      >
                        <RotateCw className={`h-3 w-3 mr-1 ${resending === f.id ? "animate-spin" : ""}`} />
                        {resending === f.id ? "..." : "Kirim Ulang"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
