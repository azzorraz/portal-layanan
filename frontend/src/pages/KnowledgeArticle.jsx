import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Eye, Tag, Pencil, Trash2, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";

function renderMarkdownLite(md) {
  // very small subset: headings, bold, italic, code, links, lists
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*)$/gm, '<h3 class="font-display text-lg font-semibold mt-5 mb-2 text-zinc-900">$1</h3>')
    .replace(/^## (.*)$/gm, '<h2 class="font-display text-xl font-semibold mt-6 mb-2 text-zinc-900">$1</h2>')
    .replace(/^# (.*)$/gm, '<h1 class="font-display text-2xl font-semibold mt-6 mb-3 text-zinc-950">$1</h1>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[0.875em]">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="text-blue-700 underline" href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mt-3">');
  return `<p>${html}</p>`;
}

export default function KnowledgeArticle({ mode = "view" }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isKoor = user?.role === "koordinator";

  const editing = mode === "new" || mode === "edit";

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(mode !== "new");
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState({ title: "", kategori: "", content: "", tags: "" });
  const [savingForm, setSavingForm] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const loadCats = async () => {
    try { const { data } = await api.get("/kb/categories"); setCats(data); } catch { /* noop */ }
  };

  useEffect(() => {
    loadCats();
    if (mode === "new") return;
    (async () => {
      try {
        const { data } = await api.get(`/kb/articles/${id}`);
        setArticle(data);
        if (mode === "edit") {
          setForm({
            title: data.title, kategori: data.kategori || "",
            content: data.content || "", tags: (data.tags || []).join(", "),
          });
        }
      } catch (e) { toast.error(apiError(e)); nav("/kb"); }
      finally { setLoading(false); }
    })();
  }, [id, mode, nav]);

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error("Judul dan konten wajib diisi"); return; }
    setSavingForm(true);
    try {
      const payload = {
        title: form.title.trim(),
        kategori: form.kategori || null,
        content: form.content,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      let res;
      if (mode === "new") res = await api.post("/kb/articles", payload);
      else res = await api.put(`/kb/articles/${id}`, payload);
      toast.success("Tersimpan");
      nav(`/kb/${res.data.id}`);
    } catch (e) { toast.error(apiError(e)); }
    finally { setSavingForm(false); }
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      const { data } = await api.post("/kb/categories", { nama: newCat.trim() });
      setNewCat(""); setCatDialogOpen(false);
      await loadCats();
      setForm((f) => ({ ...f, kategori: data.nama }));
      toast.success("Kategori ditambahkan");
    } catch (e) { toast.error(apiError(e)); }
  };

  const del = async () => {
    if (!window.confirm("Hapus artikel ini?")) return;
    try { await api.delete(`/kb/articles/${id}`); toast.success("Dihapus"); nav("/kb"); }
    catch (e) { toast.error(apiError(e)); }
  };

  if (loading) return <div className="text-sm text-zinc-500">Memuat...</div>;

  if (editing) {
    return (
      <div className="max-w-3xl space-y-6">
        <Link to={article ? `/kb/${id}` : "/kb"} className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Batal
        </Link>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">{mode === "new" ? "Artikel Baru" : "Edit Artikel"}</div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">{mode === "new" ? "Tulis Artikel KB" : "Edit Artikel"}</h1>
        </div>
        <Card className="border-zinc-200 shadow-none p-6 space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Judul</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 mt-1" data-testid="kb-form-title" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Kategori</Label>
            <div className="flex gap-2 mt-1">
              <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                <SelectTrigger className="h-10 flex-1" data-testid="kb-form-kategori"><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.nama}>{c.nama}</SelectItem>)}
                </SelectContent>
              </Select>
              <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-10"><Plus className="h-4 w-4" /></Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Kategori Baru</DialogTitle></DialogHeader>
                  <Input placeholder="Nama kategori" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Batal</Button>
                    <Button onClick={addCategory} className="bg-zinc-950 hover:bg-zinc-800">Tambah</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Konten (Markdown sederhana didukung)</Label>
            <Textarea
              rows={14} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-1 font-mono text-sm" placeholder="# Heading&#10;**bold** *italic* `kode`&#10;- list&#10;[link](https://...)"
              data-testid="kb-form-content"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Tag (pisahkan dengan koma)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="h-10 mt-1" placeholder="reset, akun, ptk" />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
            <Button variant="outline" onClick={() => nav(article ? `/kb/${id}` : "/kb")}><X className="h-4 w-4 mr-1.5" />Batal</Button>
            <Button onClick={save} disabled={savingForm} className="bg-zinc-950 hover:bg-zinc-800" data-testid="kb-save-button">
              <Save className="h-4 w-4 mr-1.5" /> {savingForm ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!article) return <div className="text-sm text-zinc-500">Artikel tidak ditemukan</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/kb" className="text-xs text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke daftar
      </Link>
      <div>
        {article.kategori && (
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full mb-3">
            <Tag className="h-2.5 w-2.5" /> {article.kategori}
          </div>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">{article.title}</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2">
          <span>oleh {article.author_name}</span>
          <span>•</span>
          <span>{relativeTime(article.updated_at)}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{article.views || 0} kunjungan</span>
        </div>
      </div>
      {isKoor && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => nav(`/kb/${id}/edit`)} data-testid="kb-edit-button"><Pencil className="h-3.5 w-3.5 mr-1.5" />Edit</Button>
          <Button variant="outline" size="sm" onClick={del} className="text-red-700 hover:text-red-800" data-testid="kb-delete-button"><Trash2 className="h-3.5 w-3.5 mr-1.5" />Hapus</Button>
        </div>
      )}
      <Card className="border-zinc-200 shadow-none p-6">
        <div
          className="prose prose-zinc max-w-none text-sm text-zinc-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderMarkdownLite(article.content) }}
        />
        {article.tags?.length > 0 && (
          <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-wrap gap-1.5">
            {article.tags.map((t) => (
              <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs">#{t}</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
