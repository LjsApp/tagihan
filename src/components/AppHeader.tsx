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
    <header className="border-b-2 border-dashed border-paper-edge bg-paper">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 border-2 border-ink flex items-center justify-center bg-paper">
            <Receipt className="w-5 h-5 text-ink" />
          </div>
          <div className="leading-tight">
            <div className="font-bold uppercase tracking-widest text-sm">Nota Scan</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Perincian · Tagihan · Tanda Terima
            </div>
          </div>
        </Link>
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
  );
};
