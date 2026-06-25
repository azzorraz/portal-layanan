import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiError } from "@/lib/api";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, School2, UserCog } from "lucide-react";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("operator"); // "operator" | "koordinator"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await login(identifier.trim(), password);
      toast.success("Berhasil masuk");
      navigate("/dashboard");
    } catch (e2) {
      setErr(apiError(e2, "Gagal masuk"));
    } finally {
      setBusy(false);
    }
  };

  const isOperator = mode === "operator";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Form pane */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-sm reveal">
          <div className="flex items-center gap-2 mb-10">
            <div className="h-9 w-9 rounded-md bg-blue-600 text-white inline-flex items-center justify-center font-bold tracking-tighter">DP</div>
            <div>
              <div className="font-display font-semibold text-zinc-900">Portal Layanan Dapodik</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">One Stop Service</div>
            </div>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-950">
            Masuk ke ruang kerja Anda
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Kelola seluruh pengajuan layanan Dapodik dalam satu tempat.</p>

          {/* Role tabs */}
          <div className="mt-6 grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-md" data-testid="login-mode-tabs">
            <button
              type="button"
              onClick={() => { setMode("operator"); setIdentifier(""); setErr(""); }}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium transition-colors ${
                isOperator ? "bg-white text-blue-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
              }`}
              data-testid="login-mode-operator"
            >
              <School2 className="h-4 w-4" /> Operator
            </button>
            <button
              type="button"
              onClick={() => { setMode("koordinator"); setIdentifier(""); setErr(""); }}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium transition-colors ${
                !isOperator ? "bg-white text-blue-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
              }`}
              data-testid="login-mode-koordinator"
            >
              <UserCog className="h-4 w-4" /> Koordinator
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-xs uppercase tracking-wider text-zinc-500">
                {isOperator ? "NPSN Sekolah" : "Email Koordinator"}
              </Label>
              <Input
                id="identifier"
                type={isOperator ? "text" : "email"}
                inputMode={isOperator ? "numeric" : "email"}
                required autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isOperator ? "Contoh: 20220001" : "admin@dapodik.id"}
                data-testid="login-identifier-input"
                className="h-11"
              />
              {isOperator && (
                <p className="text-[11px] text-zinc-500">Gunakan NPSN sekolah Anda. Password default: <span className="font-mono">123456</span></p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-zinc-500">Password</Label>
              <div className="relative">
                <Input
                  id="password" type={showPwd ? "text" : "password"} required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                  className="h-11 pr-10"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-900" data-testid="toggle-password-visibility">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {err && (
              <div data-testid="login-error" className="text-sm rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2">
                {err}
              </div>
            )}

            <Button type="submit" disabled={busy} data-testid="login-submit-button" className="w-full h-11 bg-blue-600 hover:bg-blue-700">
              {busy ? "Memproses..." : "Masuk"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-100 text-xs text-zinc-500 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 text-blue-500" />
            <p>Akun didaftarkan oleh Koordinator. Hubungi tim Dapodik untuk mengaktifkan akses operator sekolah Anda.</p>
          </div>
        </div>
      </div>

      {/* Visual pane */}
      <div className="hidden lg:flex relative items-center justify-center bg-blue-900 text-white p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 30%, rgba(96,165,250,0.55), transparent 45%), radial-gradient(circle at 75% 70%, rgba(59,130,246,0.45), transparent 50%)",
          }}
        />
        <div className="absolute inset-0" style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }} />
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-[11px] uppercase tracking-[0.15em] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-300 animate-pulse" />
            Live Operations
          </div>
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Satu pusat layanan untuk seluruh pengajuan Dapodik.
          </h2>
          <p className="mt-4 text-blue-100 text-sm leading-relaxed">
            Pantau status, SLA, dan riwayat setiap ticket secara real-time — menggantikan komunikasi WhatsApp yang tidak terstruktur.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-10">
            {[
              { k: "Tickets/bulan", v: "500+" },
              { k: "Rata-rata SLA", v: "< 3 hari" },
              { k: "Transparansi", v: "100%" },
            ].map((m) => (
              <div key={m.k} className="rounded-md border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-blue-200">{m.k}</div>
                <div className="font-display text-lg font-semibold mt-1">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
