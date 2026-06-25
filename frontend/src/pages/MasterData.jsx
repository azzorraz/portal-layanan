import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, GripVertical, Settings2, MessageSquareWarning, Wrench, Send } from "lucide-react";
import { toast } from "sonner";

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-lg font-medium tracking-tight text-zinc-900">{title}</h3>
      {action}
    </div>
  );
}

/* ----- Kecamatan ----- */
function KecamatanTab() {
  const [items, setItems] = useState([]);
  const [nama, setNama] = useState("");
  const load = async () => { try { const { data } = await api.get("/kecamatan"); setItems(data); } catch (e) { toast.error(apiError(e)); } };
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    try { await api.post("/kecamatan", { nama }); setNama(""); toast.success("Ditambahkan"); load(); }
    catch (e2) { toast.error(apiError(e2)); }
  };
  const del = async (id) => { try { await api.delete(`/kecamatan/${id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(apiError(e)); } };
  return (
    <div className="space-y-4">
      <Card className="border-zinc-200 shadow-none p-4">
        <form onSubmit={add} className="flex items-end gap-3" data-testid="kecamatan-form">
          <div className="flex-1">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Nama Kecamatan</Label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} required className="h-10 mt-1" data-testid="kecamatan-name-input" />
          </div>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="add-kecamatan-button"><Plus className="h-4 w-4 mr-1.5" />Tambah</Button>
        </form>
      </Card>
      <Card className="border-zinc-200 shadow-none">
        <table className="w-full text-sm">
          <thead><tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Nama</th>
            <th className="px-4 py-3 w-16"></th>
          </tr></thead>
          <tbody>
            {items.map((k) => (
              <tr key={k.id} className="border-b border-zinc-100">
                <td className="px-4 py-3 text-zinc-900">{k.nama}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(k.id)} className="text-zinc-400 hover:text-red-600" data-testid={`del-kec-${k.id}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={2} className="px-4 py-10 text-center text-zinc-500">Belum ada data</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ----- Layanan ----- */
function LayananTab() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nama: "", sla_days: 3, deskripsi: "", checklist: [], form_schema: [], attachment_required: false });
  const [open, setOpen] = useState(false);
  const [newChecklist, setNewChecklist] = useState("");
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [newField, setNewField] = useState({ key: "", label: "", type: "text", required: true, options: "", help_text: "" });
  const load = async () => { try { const { data } = await api.get("/layanan"); setItems(data); } catch (e) { toast.error(apiError(e)); } };
  useEffect(() => { load(); }, []);
  const openNew = () => { setEditing(null); setForm({ nama: "", sla_days: 3, deskripsi: "", checklist: [], form_schema: [], attachment_required: false }); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ nama: l.nama, sla_days: l.sla_days, deskripsi: l.deskripsi || "", checklist: l.checklist || [], form_schema: l.form_schema || [], attachment_required: !!l.attachment_required }); setOpen(true); };

  const addField = () => {
    if (!newField.key.trim() || !newField.label.trim()) { toast.error("Key & label wajib diisi"); return; }
    const field = {
      key: newField.key.trim().replace(/\s+/g, "_"),
      label: newField.label.trim(),
      type: newField.type,
      required: newField.required,
      options: newField.type === "select" ? newField.options.split(",").map((s) => s.trim()).filter(Boolean) : [],
      help_text: newField.help_text || null,
    };
    setForm({ ...form, form_schema: [...form.form_schema, field] });
    setNewField({ key: "", label: "", type: "text", required: true, options: "", help_text: "" });
  };
  const removeField = (idx) => setForm({ ...form, form_schema: form.form_schema.filter((_, i) => i !== idx) });
  const moveField = (idx, dir) => {
    const arr = [...form.form_schema];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setForm({ ...form, form_schema: arr });
  };
  const save = async () => {
    try {
      if (editing) await api.put(`/layanan/${editing.id}`, form);
      else await api.post("/layanan", form);
      toast.success("Tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus layanan ini?")) return; try { await api.delete(`/layanan/${id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(apiError(e)); } };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700" data-testid="add-layanan-button"><Plus className="h-4 w-4 mr-1.5" /> Tambah Layanan</Button>
      </div>
      <Card className="border-zinc-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Nama Layanan</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">SLA (hari)</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Form</th>
            <th className="px-4 py-3 w-24"></th>
          </tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100" data-testid={`layanan-row-${l.id}`}>
                <td className="px-4 py-3 text-zinc-900">{l.nama}</td>
                <td className="px-4 py-3 font-mono">{l.sla_days}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{(l.form_schema || []).length} fields</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(l)} className="text-zinc-500 hover:text-zinc-900" data-testid={`edit-layanan-${l.id}`}><Pencil className="h-4 w-4 inline" /></button>
                  <button onClick={() => del(l.id)} className="text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">Belum ada data</td></tr>}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Layanan" : "Tambah Layanan"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Nama</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="h-10 mt-1" data-testid="layanan-nama-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">SLA (hari)</Label>
              <Input type="number" min={1} max={60} value={form.sla_days} onChange={(e) => setForm({ ...form, sla_days: parseInt(e.target.value || "1", 10) })} className="h-10 mt-1" data-testid="layanan-sla-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Deskripsi</Label>
              <Input value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className="h-10 mt-1" />
            </div>
            <label className="flex items-center gap-2 px-3 h-10 text-sm bg-zinc-50 border border-zinc-200 rounded-md cursor-pointer" data-testid="layanan-attachment-required-toggle">
              <input
                type="checkbox"
                checked={form.attachment_required}
                onChange={(e) => setForm({ ...form, attachment_required: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span className="text-zinc-800">Wajib lampiran dokumen</span>
              <span className="text-xs text-zinc-500 ml-auto">Operator harus unggah file saat membuat pengajuan</span>
            </label>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Checklist Dokumen Wajib</Label>
              <div className="mt-1 space-y-1.5" data-testid="layanan-checklist-editor">
                {form.checklist.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-md border border-zinc-200">
                    <span className="text-xs text-zinc-400 font-mono w-5">{i + 1}.</span>
                    <span className="flex-1 text-sm text-zinc-800">{c}</span>
                    <button type="button" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, idx) => idx !== i) })} className="text-zinc-400 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newChecklist} onChange={(e) => setNewChecklist(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newChecklist.trim()) {
                        e.preventDefault();
                        setForm({ ...form, checklist: [...form.checklist, newChecklist.trim()] });
                        setNewChecklist("");
                      }
                    }}
                    placeholder="Tambah item checklist..." className="h-9" data-testid="layanan-checklist-input"
                  />
                  <Button type="button" variant="outline" className="h-9" onClick={() => {
                    if (newChecklist.trim()) {
                      setForm({ ...form, checklist: [...form.checklist, newChecklist.trim()] });
                      setNewChecklist("");
                    }
                  }}><Plus className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Form Fields ({form.form_schema.length})</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setSchemaOpen((o) => !o)} data-testid="toggle-schema-editor">
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" /> {schemaOpen ? "Sembunyikan" : "Kelola Form"}
                </Button>
              </div>
              {schemaOpen && (
                <div className="mt-2 space-y-2 border border-zinc-200 rounded-md p-3 bg-zinc-50/50" data-testid="schema-editor">
                  {form.form_schema.length === 0 && (
                    <div className="text-xs text-zinc-500 italic">Belum ada field. Tambahkan di bawah.</div>
                  )}
                  {form.form_schema.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-2 bg-white rounded-md border border-zinc-200" data-testid={`schema-field-${i}`}>
                      <div className="flex flex-col">
                        <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className="text-zinc-300 hover:text-zinc-700 disabled:opacity-30">▲</button>
                        <button type="button" onClick={() => moveField(i, 1)} disabled={i === form.form_schema.length - 1} className="text-zinc-300 hover:text-zinc-700 disabled:opacity-30">▼</button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900 truncate">{f.label} {f.required && <span className="text-red-500">*</span>}</div>
                        <div className="text-[11px] text-zinc-500 font-mono">key: {f.key} • type: {f.type}{f.options?.length ? ` • [${f.options.join(", ")}]` : ""}</div>
                      </div>
                      <button type="button" onClick={() => removeField(i)} className="text-zinc-400 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="border-t border-zinc-200 pt-2 mt-2 grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="add-field-form">
                    <Input value={newField.key} onChange={(e) => setNewField({ ...newField, key: e.target.value })} placeholder="key (snake_case)" className="h-9" data-testid="new-field-key" />
                    <Input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} placeholder="Label" className="h-9" data-testid="new-field-label" />
                    <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v })}>
                      <SelectTrigger className="h-9" data-testid="new-field-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["text", "number", "date", "select", "textarea", "tel", "email"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 px-3 h-9 text-sm bg-white border border-zinc-200 rounded-md">
                      <input type="checkbox" checked={newField.required} onChange={(e) => setNewField({ ...newField, required: e.target.checked })} className="h-4 w-4" />
                      Wajib (required)
                    </label>
                    {newField.type === "select" && (
                      <Input value={newField.options} onChange={(e) => setNewField({ ...newField, options: e.target.value })} placeholder="opsi1, opsi2, opsi3" className="h-9 md:col-span-2" data-testid="new-field-options" />
                    )}
                    <Input value={newField.help_text} onChange={(e) => setNewField({ ...newField, help_text: e.target.value })} placeholder="Petunjuk (opsional)" className="h-9 md:col-span-2" />
                    <Button type="button" onClick={addField} className="md:col-span-2 bg-blue-600 hover:bg-blue-700" data-testid="add-field-button">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Field
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="save-layanan-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----- Sekolah ----- */
function SekolahTab() {
  const [items, setItems] = useState([]);
  const [kecs, setKecs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nama: "", npsn: "", kecamatan: "", jenjang: "", alamat: "" });
  const [open, setOpen] = useState(false);
  const load = async () => { try { const { data } = await api.get("/sekolah"); setItems(data); } catch (e) { toast.error(apiError(e)); } };
  const loadKec = async () => { try { const { data } = await api.get("/kecamatan"); setKecs(data); } catch { /* noop */ } };
  useEffect(() => { load(); loadKec(); }, []);
  const openNew = () => { setEditing(null); setForm({ nama: "", npsn: "", kecamatan: kecs[0]?.nama || "", jenjang: "", alamat: "" }); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ nama: s.nama, npsn: s.npsn || "", kecamatan: s.kecamatan, jenjang: s.jenjang || "", alamat: s.alamat || "" }); setOpen(true); };
  const save = async () => {
    try {
      if (editing) await api.put(`/sekolah/${editing.id}`, form);
      else await api.post("/sekolah", form);
      toast.success("Tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus sekolah?")) return; try { await api.delete(`/sekolah/${id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(apiError(e)); } };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700" data-testid="add-sekolah-button"><Plus className="h-4 w-4 mr-1.5" />Tambah Sekolah</Button>
      </div>
      <Card className="border-zinc-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Nama Sekolah</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">NPSN</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Kecamatan</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Jenjang</th>
            <th className="px-4 py-3 w-24"></th>
          </tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100">
                <td className="px-4 py-3 text-zinc-900">{s.nama}</td>
                <td className="px-4 py-3 font-mono">{s.npsn || "—"}</td>
                <td className="px-4 py-3">{s.kecamatan}</td>
                <td className="px-4 py-3">{s.jenjang || "—"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(s)} className="text-zinc-500 hover:text-zinc-900"><Pencil className="h-4 w-4 inline" /></button>
                  <button onClick={() => del(s.id)} className="text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500">Belum ada data</td></tr>}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Sekolah" : "Tambah Sekolah"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Nama Sekolah</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="h-10 mt-1" data-testid="sekolah-nama-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">NPSN</Label>
              <Input value={form.npsn} onChange={(e) => setForm({ ...form, npsn: e.target.value })} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Kecamatan</Label>
              <Select value={form.kecamatan} onValueChange={(v) => setForm({ ...form, kecamatan: v })}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>{kecs.map((k) => <SelectItem key={k.id} value={k.nama}>{k.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Jenjang</Label>
              <Select value={form.jenjang} onValueChange={(v) => setForm({ ...form, jenjang: v })}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>{["TK", "SD", "SMP", "SMA", "SMK"].map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Alamat</Label>
              <Input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} className="h-10 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="save-sekolah-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----- Operator ----- */
function OperatorTab() {
  const [items, setItems] = useState([]);
  const [sekolahs, setSekolahs] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", sekolah_id: "", phone: "" });
  const load = async () => { try { const { data } = await api.get("/operators"); setItems(data); } catch (e) { toast.error(apiError(e)); } };
  useEffect(() => {
    load();
    (async () => { try { const { data } = await api.get("/sekolah"); setSekolahs(data); } catch { /* noop */ } })();
  }, []);
  const openNew = () => { setEditing(null); setForm({ name: "", email: "", password: "", sekolah_id: sekolahs[0]?.id || "", phone: "" }); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setForm({ name: o.name, email: o.email, password: "", sekolah_id: o.sekolah_id, phone: o.phone || "" }); setOpen(true); };
  const save = async () => {
    try {
      if (editing) {
        const payload = { name: form.name, email: form.email, sekolah_id: form.sekolah_id, phone: form.phone };
        if (form.password) payload.password = form.password;
        await api.put(`/operators/${editing.id}`, payload);
      } else {
        await api.post("/operators", form);
      }
      toast.success("Tersimpan"); setOpen(false); load();
    } catch (e) { toast.error(apiError(e)); }
  };
  const del = async (id) => { if (!window.confirm("Hapus operator?")) return; try { await api.delete(`/operators/${id}`); toast.success("Dihapus"); load(); } catch (e) { toast.error(apiError(e)); } };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700" data-testid="add-operator-button"><Plus className="h-4 w-4 mr-1.5" />Tambah Operator</Button>
      </div>
      <Card className="border-zinc-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Nama</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Email</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Sekolah</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Telepon</th>
            <th className="px-4 py-3 w-24"></th>
          </tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-zinc-100">
                <td className="px-4 py-3 text-zinc-900">{o.name}</td>
                <td className="px-4 py-3">{o.email}</td>
                <td className="px-4 py-3">{o.sekolah?.nama || "—"}</td>
                <td className="px-4 py-3">{o.phone || "—"}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(o)} className="text-zinc-500 hover:text-zinc-900"><Pencil className="h-4 w-4 inline" /></button>
                  <button onClick={() => del(o.id)} className="text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500">Belum ada operator</td></tr>}
          </tbody>
        </table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Operator" : "Tambah Operator"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Nama</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Password {editing && <span className="text-zinc-400 normal-case">(kosongkan jika tidak ganti)</span>}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 mt-1" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Sekolah</Label>
              <Select value={form.sekolah_id} onValueChange={(v) => setForm({ ...form, sekolah_id: v })}>
                <SelectTrigger className="h-10 mt-1"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>{sekolahs.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Telepon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700" data-testid="save-operator-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Admin</div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Master Data</h1>
          <p className="text-sm text-zinc-500 mt-1">Kelola sekolah, operator, layanan, kecamatan, dan SLA.</p>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppTestDialog />
          <CleanupTestTicketsDialog />
        </div>
      </div>
      <Tabs defaultValue="layanan">
        <TabsList>
          <TabsTrigger value="layanan" data-testid="tab-layanan">Layanan & SLA</TabsTrigger>
          <TabsTrigger value="sekolah" data-testid="tab-sekolah">Sekolah</TabsTrigger>
          <TabsTrigger value="operator" data-testid="tab-operator">Operator</TabsTrigger>
          <TabsTrigger value="kecamatan" data-testid="tab-kecamatan">Kecamatan</TabsTrigger>
        </TabsList>
        <TabsContent value="layanan" className="mt-4"><LayananTab /></TabsContent>
        <TabsContent value="sekolah" className="mt-4"><SekolahTab /></TabsContent>
        <TabsContent value="operator" className="mt-4"><OperatorTab /></TabsContent>
        <TabsContent value="kecamatan" className="mt-4"><KecamatanTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function WhatsAppTestDialog() {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("Tes notifikasi WhatsApp dari Dapodik Ticketing.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    if (!target.trim()) { toast.error("Nomor WhatsApp wajib diisi"); return; }
    setBusy(true); setResult(null);
    try {
      const { data } = await api.post("/admin/test-whatsapp", { target, message });
      setResult(data);
      if (data.status) toast.success("WA test terkirim ke antrian");
      else toast.error(data.detail || "Gagal mengirim");
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="open-wa-test"><Send className="h-3.5 w-3.5 mr-1.5" />Tes WA</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tes Integrasi WhatsApp (Fonnte)</DialogTitle>
          <DialogDescription>Kirim pesan tes untuk memastikan token Fonnte aktif dan device terhubung.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Nomor WhatsApp Tujuan</Label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="08xxxxxxxxxx" className="h-10 mt-1" data-testid="wa-test-target" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Pesan</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} className="h-10 mt-1" data-testid="wa-test-message" />
          </div>
          {result && (
            <div className={`text-xs rounded-md border px-3 py-2 ${result.status ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`} data-testid="wa-test-result">
              <div className="font-medium">{result.status ? "Terkirim ke antrian Fonnte" : "Gagal"}</div>
              {result.detail && <div className="font-mono text-[11px] mt-1 break-words">{String(result.detail)}</div>}
              {result.quota && (
                <div className="mt-1 text-[11px] text-zinc-700">
                  Sisa quota: {Object.values(result.quota)[0]?.remaining ?? "—"}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
          <Button onClick={submit} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" data-testid="wa-test-send">
            {busy ? "Mengirim..." : "Kirim Tes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CleanupTestTicketsDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    setBusy(true); setResult(null);
    try {
      const { data } = await api.post("/admin/cleanup-test-tickets");
      setResult(data);
      toast.success(`${data.deleted} tiket dihapus`);
    } catch (e) { toast.error(apiError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" data-testid="open-cleanup-tests">
          <Wrench className="h-3.5 w-3.5 mr-1.5" />Cleanup TEST_
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4" /> Hapus Tiket Testing
          </DialogTitle>
          <DialogDescription>
            Menghapus tiket dengan judul/deskripsi diawali <span className="font-mono">TEST_</span>, <span className="font-mono">TEST-</span>, atau mengandung <span className="font-mono">playwright</span> (case-insensitive). Lampiran, aktivitas, dan notifikasi terkait ikut terhapus.
          </DialogDescription>
        </DialogHeader>
        {result && (
          <div className="text-sm rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2" data-testid="cleanup-result">
            <div className="font-medium">{result.deleted} tiket dihapus</div>
            {result.tickets?.length > 0 && (
              <div className="font-mono text-[11px] mt-1 break-words text-emerald-800">
                {result.tickets.slice(0, 10).join(", ")}{result.tickets.length > 10 ? "..." : ""}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Tutup</Button>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white" data-testid="confirm-cleanup-tests">
            {busy ? "Memproses..." : "Hapus Sekarang"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
