import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, Trash2, Layers, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRp, formatTanggal, type Transaction } from "@/lib/nota";
import { toast } from "sonner";

import type { TransactionGroup } from "@/lib/nota";

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "selesai">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [limit, setLimit] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading: loading } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const [{ data, error }, { data: gs }] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("transaction_groups").select("*").order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      return {
        transactions: (data as unknown as Transaction[]) || [],
        groups: (gs as unknown as TransactionGroup[]) || [],
      };
    },
  });

  const transactions = data?.transactions || [];
  const groups = data?.groups || [];

  const handleNew = async () => {
    const { data, error } = await supabase
      .from("transactions")
      .insert({ status: "draft" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate(`/transaksi/${data.id}`);
  };

  const handleNewGroup = async () => {
    const { data, error } = await supabase
      .from("transaction_groups")
      .insert({ nama: "Group baru" })
      .select()
      .single();
    if (error) return toast.error(error.message);
    navigate(`/group/${data.id}`);
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Hapus transaksi ini?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Transaksi dihapus");
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Hapus group ini? Transaksi tidak akan dihapus, hanya dilepas.")) return;
    await supabase.from("transactions").update({ group_id: null }).eq("group_id", id);
    const { error } = await supabase.from("transaction_groups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Group dihapus");
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
  };

  const filtered = transactions.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search && !(t.customer || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && t.created_at < dateFrom) return false;
    if (dateTo && t.created_at.slice(0, 10) > dateTo) return false;
    return true;
  });

  const totalPages = limit > 0 ? Math.ceil(filtered.length / limit) : 1;
  const paginated = limit > 0 ? filtered.slice((currentPage - 1) * limit, currentPage * limit) : filtered;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, dateFrom, dateTo, limit]);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="paper p-5 mb-5">
          <div className="text-center divider-dashed pb-3 mb-3 border-t-0 border-b-2">
            <h1 className="text-xl">Daftar Transaksi</h1>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
              Kelola perincian tagihan
            </p>
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 border-2 border-paper-edge bg-paper rounded-none"
                />
              </div>
              <div className="flex gap-1 border-2 border-paper-edge bg-paper">
                {(["all", "draft", "selesai"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-2 text-xs uppercase tracking-widest font-bold transition-colors ${
                      statusFilter === s
                        ? "bg-ink text-paper"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    {s === "all" ? "Semua" : s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 border-2 border-paper-edge bg-paper px-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={e => setDateFrom(e.target.value)} 
                  className="w-[120px] border-none shadow-none focus-visible:ring-0 h-9 text-xs" 
                />
                <span className="text-muted-foreground">-</span>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={e => setDateTo(e.target.value)} 
                  className="w-[120px] border-none shadow-none focus-visible:ring-0 h-9 text-xs" 
                />
              </div>
              <select 
                value={limit} 
                onChange={e => setLimit(Number(e.target.value))}
                className="border-2 border-paper-edge bg-paper text-xs uppercase tracking-widest px-3 h-10 outline-none hover:border-ink cursor-pointer"
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={0}>Semua</option>
              </select>
              <div className="flex-1"></div>
              <Button
                onClick={handleNewGroup}
                variant="outline"
                className="rounded-none border-2 border-ink uppercase tracking-widest text-xs font-bold"
              >
                <Layers className="w-4 h-4 mr-1" /> Group Bayar
              </Button>
              <Button
                onClick={handleNew}
                className="bg-ink text-paper hover:bg-ink/90 rounded-none border-2 border-ink uppercase tracking-widest text-xs font-bold"
              >
                <Plus className="w-4 h-4 mr-1" /> Transaksi Baru
              </Button>
            </div>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="paper p-4 mb-5">
            <div className="label mb-2">Group Pembayaran ({groups.length})</div>
            <div className="grid gap-3">
              {groups.map((g) => {
                const trxInGroup = transactions.filter(t => t.group_id === g.id);
                return (
                  <div key={g.id} className="paper p-4 hover:border-ink transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <Link to={`/group/${g.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 border ${
                              g.bukti_tf_url
                                ? "border-success text-success"
                                : "border-muted-foreground text-muted-foreground"
                            }`}
                          >
                            {g.bukti_tf_url ? "SELESAI" : "DRAFT"}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {formatTanggal(g.created_at)}
                          </span>
                        </div>
                        <div className="font-bold uppercase truncate flex items-center gap-2">
                          <Layers className="w-4 h-4 shrink-0 text-muted-foreground" />
                          {g.nama || "(Tanpa nama)"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {trxInGroup.length === 0 ? "Belum ada transaksi" : (
                            <span>
                              Gabungan {trxInGroup.length} transaksi
                              {trxInGroup.some(t => t.customer) ? ` (${Array.from(new Set(trxInGroup.map(t => t.customer).filter(Boolean))).join(', ')})` : ''}
                            </span>
                          )}
                        </div>
                      </Link>
                      <div className="text-right shrink-0">
                        <div className="num text-lg">
                          Rp {formatRp(trxInGroup.reduce((s,t) => s + Number(t.total_akhir||0), 0))}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteGroup(g.id); }}
                          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1 ml-auto mt-1"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground uppercase tracking-widest text-xs">
            Memuat...
          </div>
        ) : filtered.length === 0 ? (
          <div className="paper p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <div className="uppercase tracking-widest text-sm font-bold mb-1">Belum ada transaksi</div>
            <p className="text-xs text-muted-foreground mb-4">
              Mulai dengan membuat transaksi baru dan scan nota.
            </p>
            <Button
              onClick={handleNew}
              className="bg-ink text-paper hover:bg-ink/90 rounded-none border-2 border-ink uppercase tracking-widest text-xs font-bold"
            >
              <Plus className="w-4 h-4 mr-1" /> Buat Transaksi
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {paginated.map((t) => (
              <div key={t.id} className="paper p-4 hover:border-ink transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <Link to={`/transaksi/${t.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 border ${
                          t.status === "selesai"
                            ? "border-success text-success"
                            : "border-muted-foreground text-muted-foreground"
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {formatTanggal(t.created_at)}
                      </span>
                    </div>
                    <div className="font-bold uppercase truncate">
                      {t.customer || "(Tanpa nama customer)"}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      JT: {formatTanggal(t.jatuh_tempo)} · {(t.nota_ids || []).length} nota
                    </div>
                  </Link>
                  <div className="text-right shrink-0">
                    <div className="num text-lg">Rp {formatRp(t.total_akhir)}</div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1 ml-auto mt-1"
                    >
                      <Trash2 className="w-3 h-3" /> Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Pagination Controls */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between pt-4 pb-10">
            <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest">
              Total: {filtered.length} transaksi
            </div>
            {limit > 0 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-none border-2 border-paper-edge hover:border-ink px-2 h-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-[10px] sm:text-xs uppercase tracking-widest font-bold px-2">
                  Halaman {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-none border-2 border-paper-edge hover:border-ink px-2 h-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
