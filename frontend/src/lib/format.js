// Status & SLA helpers shared across pages
export const STATUS_LIST = [
  "Draft",
  "Diajukan",
  "Diproses",
  "Menunggu Dokumen",
  "Revisi",
  "Disetujui",
  "Selesai",
  "Ditolak",
];

export const STATUS_STYLES = {
  Draft: { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200", dot: "bg-zinc-400" },
  Diajukan: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  Diproses: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  "Menunggu Dokumen": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
  Revisi: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
  Disetujui: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  Selesai: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  Ditolak: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
};

export const PRIORITIES = ["Rendah", "Normal", "Tinggi", "Mendesak"];

export const PRIORITY_STYLES = {
  Rendah: "bg-zinc-100 text-zinc-700 border-zinc-200",
  Normal: "bg-blue-50 text-blue-700 border-blue-200",
  Tinggi: "bg-orange-50 text-orange-700 border-orange-200",
  Mendesak: "bg-red-50 text-red-700 border-red-200",
};

export const SLA_STYLES = {
  tepat_waktu: { label: "Tepat Waktu", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  hampir_terlambat: { label: "Hampir Terlambat", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  terlambat: { label: "Terlambat", cls: "bg-red-50 text-red-700 border-red-200" },
  selesai: { label: "Selesai", cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  tidak_diatur: { label: "—", cls: "bg-zinc-50 text-zinc-500 border-zinc-200" },
};

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function relativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return fmtDate(iso);
}
