import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // If already logged in, redirect
  const from = (location.state as any)?.from?.pathname || "/";

  // Check if session exists on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession(true);
    });
  }, []);

  if (session) return <Navigate to={from} replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email dan password wajib diisi");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Email atau password salah"
        : error.message
      );
      setLoading(false);
    } else {
      toast.success("Login berhasil");
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background texture lines already in body via CSS */}
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-lg font-bold uppercase tracking-widest">Note Scanner Pro</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
            Sistem Manajemen Nota
          </p>
        </div>

        {/* Login Form */}
        <div className="paper p-6">
          <div className="border-b-2 border-dashed border-[hsl(var(--paper-edge))] pb-3 mb-5 text-center">
            <span className="label">Masuk ke Sistem</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full border-2 border-[hsl(var(--paper-edge))] bg-[hsl(var(--paper))] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[hsl(var(--ink))] transition-colors"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div>
              <label className="label block mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-2 border-[hsl(var(--paper-edge))] bg-[hsl(var(--paper))] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[hsl(var(--ink))] transition-colors"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-[hsl(var(--ink))] text-[hsl(var(--paper))] py-2.5 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? "Masuk..." : "Masuk"}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t-2 border-dashed border-[hsl(var(--paper-edge))] text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
              Hubungi administrator untuk mendapatkan akses
            </p>
          </div>
        </div>

        <div className="text-center mt-4 text-[10px] text-muted-foreground uppercase tracking-widest">
          © 2026 Note Scanner Pro
        </div>
      </div>
    </div>
  );
}
