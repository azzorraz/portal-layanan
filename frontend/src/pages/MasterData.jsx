import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Pencil, Plus } from "lucide-react";
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
          <Button type="submit" className="bg-zinc-950 hover:bg-zinc-800" data-testid="add-kecamatan-button"><Plus className="h-4 w-4 mr-1.5" />Tambah</Button>
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
  const [form, setForm] = useState({ nama: "", sla_days: 3, deskripsi: "" });
  const [open, setOpen] = useState(false);
  const load = async () => { try { const { data } = await api.get("/layanan"); setItems(data); } catch (e) { toast.error(apiError(e)); } };
  useEffect(() => { load(); }, []);
  const openNew = () => { setEditing(null); setForm({ nama: "", sla_days: 3, deskripsi: "" }); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ nama: l.nama, sla_days: l.sla_days, deskripsi: l.deskripsi || "" }); setOpen(true); };
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
        <Button onClick={openNew} className="bg-zinc-950 hover:bg-zinc-800" data-testid="add-layanan-button"><Plus className="h-4 w-4 mr-1.5" /> Tambah Layanan</Button>
      </div>
      <Card className="border-zinc-200 shadow-none overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Nama Layanan</th>
            <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-zinc-500">SLA (hari)</th>
            <th className="px-4 py-3 w-24"></th>
          </tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100" data-testid={`layanan-row-${l.id}`}>
                <td className="px-4 py-3 text-zinc-900">{l.nama}</td>
                <td className="px-4 py-3 font-mono">{l.sla_days}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(l)} className="text-zinc-500 hover:text-zinc-900" data-testid={`edit-layanan-${l.id}`}><Pencil className="h-4 w-4 inline" /></button>
                  <button onClick={() => del(l.id)} className="text-zinc-400 hover:text-red-600"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-zinc-500">Belum ada data</td></tr>}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-zinc-950 hover:bg-zinc-800" data-testid="save-layanan-button">Simpan</Button>
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
        <Button onClick={openNew} className="bg-zinc-950 hover:bg-zinc-800" data-testid="add-sekolah-button"><Plus className="h-4 w-4 mr-1.5" />Tambah Sekolah</Button>
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
            <Button onClick={save} className="bg-zinc-950 hover:bg-zinc-800" data-testid="save-sekolah-button">Simpan</Button>
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
        <Button onClick={openNew} className="bg-zinc-950 hover:bg-zinc-800" data-testid="add-operator-button"><Plus className="h-4 w-4 mr-1.5" />Tambah Operator</Button>
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
            <Button onClick={save} className="bg-zinc-950 hover:bg-zinc-800" data-testid="save-operator-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MasterData() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Admin</div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Master Data</h1>
        <p className="text-sm text-zinc-500 mt-1">Kelola sekolah, operator, layanan, kecamatan, dan SLA.</p>
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
