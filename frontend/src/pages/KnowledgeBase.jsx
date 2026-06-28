import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, BookOpen, Tag, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { relativeTime } from "@/lib/format";

export default function KnowledgeBase() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (kategori !== "all") params.kategori = kategori;
      const { data } = await api.get("/kb/articles", { params });
      setItems(data);
    } catch (e) { toast.error(apiError(e)); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      try { const { data } = await api.get("/kb/categories"); setCats(data); } catch { /* noop */ }
    })();
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [kategori]);

  const isKoor = user?.role === "koordinator";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" /> Pusat Informasi
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Pusat Pengetahuan & FAQ</h1>
          <p className="text-sm text-zinc-500 mt-1">Solusi cepat untuk pertanyaan umum dan panduan penggunaan layanan Dapodik.</p>
        </div>
        {isKoor && (
          <Button onClick={() => navigate("/kb/new")} className="bg-blue-600 hover:bg-blue-700" data-testid="kb-new-button">
            <Plus className="h-4 w-4 mr-1.5" /> Tulis Artikel
          </Button>
        )}
      </div>

      <Card className="border-zinc-200 shadow-none p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Pencarian</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
                placeholder="Cari artikel, FAQ, panduan..." className="pl-9 h-10" data-testid="kb-search-input" />
            </div>
          </div>
          <div className="w-full md:w-56">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Kategori</Label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger className="h-10 mt-1" data-testid="kb-category-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.nama}>{c.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={load} className="bg-blue-600 hover:bg-blue-700 h-10" data-testid="kb-search-button">Cari</Button>
        </div>
      </Card>

      {loading && <div className="text-sm text-zinc-500">Memuat...</div>}
      {!loading && items.length === 0 && (
        <Card className="border-zinc-200 shadow-none p-12 text-center">
          <BookOpen className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
          <div className="text-zinc-700 font-medium">Belum ada artikel</div>
          <div className="text-sm text-zinc-500 mt-1">
            {isKoor ? "Mulai menulis artikel pertama untuk membantu operator." : "Hubungi koordinator untuk menambahkan panduan."}
          </div>
        </Card>
      )}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => (
            <Card key={a.id} className="border-zinc-200 shadow-none p-5 hover:shadow-sm hover:border-zinc-300 transition-all">
              <Link to={`/kb/${a.id}`} className="block group" data-testid={`kb-article-${a.id}`}>
                {a.kategori && (
                  <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full mb-3">
                    <Tag className="h-2.5 w-2.5" /> {a.kategori}
                  </div>
                )}
                <h3 className="font-display text-base font-semibold text-zinc-900 group-hover:underline line-clamp-2">{a.title}</h3>
                <div className="flex items-center justify-between text-xs text-zinc-500 mt-4">
                  <span>{a.author_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{a.views || 0}</span>
                    <span>{relativeTime(a.updated_at)}</span>
                  </span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
