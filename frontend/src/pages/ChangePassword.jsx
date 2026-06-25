import { useState, useEffect } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { MessageSquare, KeyRound } from "lucide-react";

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();

  // Password section
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [busyPwd, setBusyPwd] = useState(false);

  // WA opt-out section
  const [waOptOut, setWaOptOut] = useState(false);
  const [koordPhone, setKoordPhone] = useState("");
  const [savingPref, setSavingPref] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (user && typeof user.wa_opt_out === "boolean") setWaOptOut(user.wa_opt_out);
    if (user?.phone) setKoordPhone(user.phone);
  }, [user]);

  const submitPwd = async (e) => {
    e.preventDefault();
    if (newP !== confirmP) { toast.error("Konfirmasi password tidak cocok"); return; }
    if (newP.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    setBusyPwd(true);
    try {
      await api.post("/auth/change-password", { old_password: oldP, new_password: newP });
      toast.success("Password berhasil diubah");
      nav("/dashboard");
    } catch (e2) { toast.error(apiError(e2)); }
    finally { setBusyPwd(false); }
  };

  const toggleWa = async (val) => {
    setWaOptOut(val);
    setSavingPref(true);
    try {
      await api.patch("/auth/preferences", { wa_opt_out: val });
      await refresh();
      toast.success(val ? "Notifikasi WhatsApp dimatikan" : "Notifikasi WhatsApp diaktifkan");
    } catch (e) {
      toast.error(apiError(e));
      setWaOptOut(!val);
    } finally {
      setSavingPref(false);
    }
  };

  const saveKoordPhone = async () => {
    setSavingPhone(true);
    try {
      await api.patch("/auth/preferences", { phone: koordPhone.trim() });
      await refresh();
      toast.success("Nomor WhatsApp koordinator tersimpan");
    } catch (e) { toast.error(apiError(e)); }
    finally { setSavingPhone(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Akun</div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Profil & Preferensi</h1>
        <p className="text-sm text-zinc-500 mt-1">Kelola password dan preferensi notifikasi Anda.</p>
      </div>

      <Card className="border-zinc-200 shadow-none p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-md bg-emerald-50 text-emerald-700 inline-flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900">Notifikasi WhatsApp</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Terima update status pengajuan dan komentar koordinator langsung di WhatsApp.</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 rounded-md bg-zinc-50 border border-zinc-200">
          <div>
            <div className="text-sm font-medium text-zinc-900">Terima notifikasi WhatsApp</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {waOptOut
                ? "Saat ini DIMATIKAN — Anda hanya menerima notifikasi di aplikasi."
                : "AKTIF — Anda akan menerima pesan WhatsApp pada nomor yang Anda isi di formulir pengajuan."}
            </div>
          </div>
          <Switch
            checked={!waOptOut}
            disabled={savingPref}
            onCheckedChange={(v) => toggleWa(!v)}
            data-testid="wa-optin-switch"
            aria-label="Aktifkan notifikasi WhatsApp"
          />
        </div>

        {user?.role === "koordinator" && (
          <div className="mt-4 pt-4 border-t border-zinc-100">
            <Label className="text-xs uppercase tracking-wider text-zinc-500">No. WhatsApp Koordinator (untuk alert quota & sistem)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="tel" value={koordPhone} onChange={(e) => setKoordPhone(e.target.value)}
                placeholder="08xxxxxxxxxx" className="h-10 flex-1"
                data-testid="koord-phone-input"
              />
              <Button onClick={saveKoordPhone} disabled={savingPhone} className="bg-zinc-950 hover:bg-zinc-800" data-testid="save-koord-phone">
                {savingPhone ? "..." : "Simpan"}
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">Nomor ini akan menerima notifikasi sistem seperti peringatan quota WhatsApp rendah.</p>
          </div>
        )}
      </Card>

      <Card className="border-zinc-200 shadow-none p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-md bg-zinc-100 text-zinc-700 inline-flex items-center justify-center flex-shrink-0">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-900">Ganti Password</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Minimum 6 karakter. Logout dari semua perangkat dianjurkan setelah ganti password.</p>
          </div>
        </div>
        <form onSubmit={submitPwd} className="space-y-4" data-testid="change-password-form">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Password Lama</Label>
            <Input type="password" required value={oldP} onChange={(e) => setOldP(e.target.value)} className="h-10 mt-1" data-testid="old-password-input" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Password Baru</Label>
            <Input type="password" required minLength={6} value={newP} onChange={(e) => setNewP(e.target.value)} className="h-10 mt-1" data-testid="new-password-input" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-500">Konfirmasi Password Baru</Label>
            <Input type="password" required value={confirmP} onChange={(e) => setConfirmP(e.target.value)} className="h-10 mt-1" data-testid="confirm-password-input" />
          </div>
          <div className="pt-2 border-t border-zinc-100 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => nav(-1)}>Batal</Button>
            <Button type="submit" disabled={busyPwd} className="bg-zinc-950 hover:bg-zinc-800" data-testid="submit-change-password">
              {busyPwd ? "Memproses..." : "Simpan Password Baru"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
