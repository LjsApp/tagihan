import { Link, useNavigate } from "react-router-dom";
import { Receipt, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AppHeader = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Keluar dari sistem");
    navigate("/login", { replace: true });
  };

  return (
    <>
      <header className="border-b-2 border-dashed border-paper-edge bg-paper sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
            <div className="leading-tight">
              <div className="font-bold uppercase tracking-widest text-sm">catatanku</div>
            </div>
          </Link>

          {/* Right-side actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleLogout}
              title="Keluar"
              className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
};
