import { useEffect, useState } from "react";
import { api, apiError, API_BASE } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText as FileTextIcon } from "lucide-react";
import { STATUS_LIST } from "@/lib/format";
import { toast } from "sonner";

export default function Reports() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [layananId, setLayananId] = useState("all");
  const [kecamatan, setKecamatan] = useState("all");
  const [layananOpts, setLayananOpts] = useState([]);
  const [kecOpts, setKecOpts] = useState([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [{ data: lay }, { data: kec }] = await Promise.all([api.get("/layanan"), api.get("/kecamatan")]);
        setLayananOpts(lay); setKecOpts(kec);
      } catch { /* noop */ }
    })();
  }, []);

  const setPreset = (preset) => {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    let from = new Date(now);
    if (preset === "today") from = now;
    else if (preset === "week") from.setDate(now.getDate() - 7);
    else if (preset === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (preset === "year") { from = new Date(now.getFullYear(), 0, 1); }
    setFromDate(fmt(from)); setToDate(fmt(now));
  };

  const buildParams = () => {
    const p = new URLSearchParams();
    if (fromDate) p.set("from_date", fromDate);
    if (toDate) p.set("to_date", toDate);
    if (status !== "all") p.set("status", status);
    if (layananId !== "all") p.set("layanan_id", layananId);
    if (kecamatan !== "all") p.set("kecamatan", kecamatan);
    return p.toString();
  };

  const downloadReport = async (type) => {
    setBusy(type);
    try {
      const res = await api.get(`/reports/${type}?${buildParams()}`, { responseType: "blob" });
      const cd = res.headers["content-disposition"] || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const filename = m ? m[1] : `laporan.${type === "excel" ? "xlsx" : "pdf"}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Laporan diunduh");
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Laporan</div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Generate Laporan Pengajuan</h1>
        <p className="text-sm text-zinc-500 mt-1">Pilih periode dan filter, lalu ekspor ke Excel atau PDF.</p>
      </div>

      <Card className="border-zinc-200 shadow-none p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreset("today")} data-testid="preset-today">Hari Ini</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("week")} data-testid="preset-week">7 Hari</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("month")} data-testid="preset-month">Bulan Ini</Button>
          <Button variant="outline" size="sm" onClick={() => setPreset("year")} data-testid="preset-year">Tahun Ini</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Dari Tanggal</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 mt-1" data-testid="report-from-date" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Sampai Tanggal</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 mt-1" data-testid="report-to-date" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Layanan</Label>
            <Select value={layananId} onValueChange={setLayananId}>
              <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {layananOpts.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Kecamatan</Label>
            <Select value={kecamatan} onValueChange={setKecamatan}>
              <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {kecOpts.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-zinc-100">
          <Button onClick={() => downloadReport("excel")} disabled={busy === "excel"} className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="download-excel-button">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" /> {busy === "excel" ? "Memproses..." : "Unduh Excel"}
          </Button>
          <Button onClick={() => downloadReport("pdf")} disabled={busy === "pdf"} className="bg-red-600 hover:bg-red-700 text-white" data-testid="download-pdf-button">
            <FileTextIcon className="h-4 w-4 mr-1.5" /> {busy === "pdf" ? "Memproses..." : "Unduh PDF"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
