import { useState } from "react";
import { api, apiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function ChangePassword() {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (newP !== confirmP) { toast.error("Konfirmasi password tidak cocok"); return; }
    if (newP.length < 6) { toast.error("Password minimal 6 karakter"); return; }
    setBusy(true);
    try {
      await api.post("/auth/change-password", { old_password: oldP, new_password: newP });
      toast.success("Password berhasil diubah");
      nav("/dashboard");
    } catch (e2) {
      toast.error(apiError(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 font-semibold">Akun</div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">Ganti Password</h1>
      </div>
      <Card className="border-zinc-200 shadow-none p-6">
        <form onSubmit={submit} className="space-y-4" data-testid="change-password-form">
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
            <Button type="submit" disabled={busy} className="bg-zinc-950 hover:bg-zinc-800" data-testid="submit-change-password">
              {busy ? "Memproses..." : "Simpan"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
