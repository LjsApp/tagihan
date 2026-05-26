import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatRp, formatTanggalLong, type Transaction } from "@/lib/nota";

export const NotificationBell = () => {
  const [overdue, setOverdue] = useState<Transaction[]>([]);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .neq("status", "selesai")
      .lt("jatuh_tempo", today)
      .order("jatuh_tempo", { ascending: true });
    setOverdue((data as unknown as Transaction[]) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("notif-trx")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, load)
      .subscribe();
    const t = setInterval(load, 60000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(t);
    };
  }, []);

  const count = overdue.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 text-muted-foreground hover:text-ink transition-colors"
          aria-label="Notifikasi"
        >
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute top-0 right-0 min-w-[14px] h-[14px] px-0.5 bg-stamp text-paper text-[8px] font-bold flex items-center justify-center border border-ink">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 paper rounded-none border-2 border-ink p-0 bg-paper"
      >
        <div className="p-3 border-b-2 border-dashed border-paper-edge">
          <div className="label">Notifikasi Jatuh Tempo</div>
          <div className="text-xs text-muted-foreground mt-1">
            {count === 0 ? "Tidak ada transaksi jatuh tempo." : `${count} transaksi telah jatuh tempo`}
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {overdue.map((t) => (
            <Link
              key={t.id}
              to={`/transaksi/${t.id}`}
              className="block p-3 border-b border-dashed border-paper-edge hover:bg-ink/5"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold uppercase truncate text-sm">
                    {t.customer || "(Tanpa nama)"}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-stamp font-bold mt-0.5">
                    JT {formatTanggalLong(t.jatuh_tempo)}
                  </div>
                </div>
                <div className="num text-xs shrink-0">Rp {formatRp(t.total_akhir)}</div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
