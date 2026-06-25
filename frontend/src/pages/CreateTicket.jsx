import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Paperclip, Upload, X } from "lucide-react";

const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];
const MAX_BYTES = 5 * 1024 * 1024;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result;
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CreateTicket() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [layananOpts, setLayananOpts] = useState([]);
  const [layananId, setLayananId] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [prioritas, setPrioritas] = useState("Normal");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/layanan");
        setLayananOpts(data);
      } catch (e) { toast.error(apiError(e)); }
    })();
  }, []);

  const selectedLayanan = layananOpts.find((l) => l.id === layananId);

  const onFiles = (e) => {
    const list = Array.from(e.target.files || []);
    for (const f of list) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name}: format tidak didukung`); return; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: melebihi 5MB`); return; }
    }
    setFiles((prev) => [...prev, ...list].slice(0, 10));
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!layananId) { toast.error("Pilih jenis layanan"); return; }
    setBusy(true);
    try {
      const attachments = [];
      for (const f of files) {
        const b64 = await fileToBase64(f);
        attachments.push({ filename: f.name, mime: f.type, data_base64: b64 });
      }
      const { data } = await api.post("/tickets", {
        layanan_id: layananId, judul, deskripsi, prioritas, attachments,
      });
      toast.success(`Pengajuan dibuat: ${data.ticket_number}`);
      nav(`/tickets/${data.id}`);
    } catch (e2) {
      toast.error(apiError(e2));
    } finally {
      setBusy(false);
    }
  };

  if (user?.role !== "operator") {
    return <div className="text-sm text-zinc-500">Hanya operator yang dapat membuat pengajuan.</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Pengajuan Baru</div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Buat Pengajuan Layanan Dapodik</h1>
      </div>

      <Card className="border-zinc-200 shadow-none p-6">
        <form onSubmit={submit} className="space-y-5" data-testid="create-ticket-form">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Jenis Layanan</Label>
            <Select value={layananId} onValueChange={setLayananId}>
              <SelectTrigger data-testid="select-layanan" className="h-10 mt-1"><SelectValue placeholder="Pilih jenis layanan..." /></SelectTrigger>
              <SelectContent>
                {layananOpts.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nama} <span className="text-zinc-500 ml-2">• SLA {l.sla_days} hari</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLayanan && (
              <div className="mt-2 text-xs text-zinc-500">SLA target: <span className="font-medium text-zinc-700">{selectedLayanan.sla_days} hari kerja</span></div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Judul Pengajuan</Label>
            <Input
              required value={judul} onChange={(e) => setJudul(e.target.value)}
              placeholder="Contoh: Reset akun PTK an. Budi Santoso"
              data-testid="input-judul" className="h-10 mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Deskripsi</Label>
            <Textarea
              required value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)}
              rows={5} placeholder="Jelaskan detail pengajuan..."
              data-testid="input-deskripsi" className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Prioritas</Label>
            <Select value={prioritas} onValueChange={setPrioritas}>
              <SelectTrigger className="h-10 mt-1" data-testid="select-prioritas"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Rendah", "Normal", "Tinggi", "Mendesak"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Lampiran Dokumen</Label>
            <div className="mt-1 border-2 border-dashed border-zinc-200 rounded-md p-4 text-center hover:border-zinc-300 transition-colors">
              <input id="file-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={onFiles} className="hidden" data-testid="input-file" />
              <label htmlFor="file-upload" className="cursor-pointer text-sm text-zinc-600 inline-flex items-center gap-2">
                <Upload className="h-4 w-4" /> Pilih file (PDF, JPG, PNG — maks 5MB per file)
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-md bg-zinc-50 border border-zinc-200 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-zinc-500 flex-shrink-0">({Math.round(f.size / 1024)} KB)</span>
                    </span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-zinc-500 hover:text-red-600">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100">
            <Button type="button" variant="outline" onClick={() => nav(-1)}>Batal</Button>
            <Button type="submit" disabled={busy} className="bg-zinc-950 hover:bg-zinc-800" data-testid="submit-ticket-button">
              {busy ? "Mengirim..." : "Kirim Pengajuan"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
