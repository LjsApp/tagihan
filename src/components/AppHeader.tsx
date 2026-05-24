import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Receipt, LogOut, LayoutDashboard, Menu, X, FileText } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AppHeader = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Keluar dari sistem");
    navigate("/login", { replace: true });
  };

  const navLinks = (onClick?: () => void) => (
    <>
      <NavLink
        to="/"
        end
        onClick={onClick}
        className={({ isActive }) =>
          `transition-colors hover:text-ink flex items-center gap-2 text-xs uppercase tracking-widest font-bold ${isActive ? "text-ink border-b-2 border-ink pb-1" : "text-muted-foreground"}`
        }
      >
        <FileText className="w-3.5 h-3.5" /> Transaksi
      </NavLink>
      <NavLink
        to="/dashboard"
        onClick={onClick}
        className={({ isActive }) =>
          `transition-colors hover:text-ink flex items-center gap-2 text-xs uppercase tracking-widest font-bold ${isActive ? "text-ink border-b-2 border-ink pb-1" : "text-muted-foreground"}`
        }
      >
        <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
      </NavLink>
    </>
  );

  return (
    <>
      <header className="border-b-2 border-dashed border-paper-edge bg-paper sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-9 h-9 border-2 border-ink flex items-center justify-center bg-paper">
              <Receipt className="w-4 h-4 text-ink" />
            </div>
            <div className="leading-tight">
              <div className="font-bold uppercase tracking-widest text-sm">Nota Scan</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
                Perincian · Tagihan · Tanda Terima
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks()}
          </nav>

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleLogout}
              title="Keluar"
              className="text-muted-foreground hover:text-destructive p-1.5 transition-colors hidden md:block"
            >
              <LogOut className="w-4 h-4" />
            </button>
            {/* Hamburger - only on mobile */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-1.5 text-muted-foreground hover:text-ink transition-colors"
              title="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t-2 border-dashed border-paper-edge bg-paper px-4 py-4 flex flex-col gap-4">
            {navLinks(() => setMobileOpen(false))}
            <button
              onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Keluar
            </button>
          </div>
        )}
      </header>
    </>
  );
};
