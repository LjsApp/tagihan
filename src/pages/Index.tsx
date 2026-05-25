import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileText, Calendar, Trash2, Layers, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Cloud } from "lucide-react";
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

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (id: string) => setExpandedGroups(p => ({ ...p, [id]: !p[id] }));

  const filtered = transactions.filter((t) => {
    if (t.group_id) return false;
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
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="paper p-5 mb-5">
          <div className="text-center divider-dashed pb-3 mb-3 border-t-0 border-b-2">
            <h1 className="text-xl">Daftar Transaksi</h1>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
              Kelola perincian tagihan
            </p>
          </div>

          {/* Search + Status Filter */}
          <div className="flex flex-col gap-2 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-2 border-paper-edge bg-paper rounded-none"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex border-2 border-paper-edge bg-paper">
              {(["all", "draft", "selesai"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 py-2 text-xs uppercase tracking-widest font-bold transition-colors ${
                    statusFilter === s ? "bg-ink text-paper" : "text-muted-foreground hover:text-ink"
                  }`}
                >
                  {s === "all" ? "Semua" : s}
                </button>
              ))}
            </div>

            {/* Date filter row */}
            <div className="flex items-center gap-1 border-2 border-paper-edge bg-paper px-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="flex-1 border-none bg-transparent outline-none h-9 text-xs min-w-0"
              />
              <span className="text-muted-foreground text-xs">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="flex-1 border-none bg-transparent outline-none h-9 text-xs min-w-0"
              />
            </div>

            {/* Limit + Action Buttons in one row */}
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                className="border-2 border-paper-edge bg-paper text-xs uppercase tracking-widest px-2 h-9 outline-none hover:border-ink cursor-pointer shrink-0"
              >
                <option value={10}>10 Baris</option>
                <option value={20}>20 Baris</option>
                <option value={50}>50 Baris</option>
                <option value={0}>Semua</option>
              </select>
              <div className="flex-1" />
              <Button
                onClick={handleNewGroup}
                variant="outline"
                size="sm"
                className="rounded-none border-2 border-ink uppercase tracking-widest text-xs font-bold px-3 h-9"
              >
                <Layers className="w-3.5 h-3.5 mr-1" /> Group
              </Button>
              <Button
                onClick={handleNew}
                size="sm"
                className="bg-ink text-paper hover:bg-ink/90 rounded-none border-2 border-ink uppercase tracking-widest text-xs font-bold px-3 h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Baru
              </Button>
            </div>
          </div>

        </div>

        {groups.length > 0 && (
          <div className="paper p-3 sm:p-4 mb-4">
            <div className="label mb-2 text-[10px] sm:text-xs">Group Pembayaran ({groups.length})</div>
            <div className="grid gap-2">
              {groups.map((g) => {
                const trxInGroup = transactions.filter(t => t.group_id === g.id);
                const customers = Array.from(new Set(trxInGroup.map(t => t.customer).filter(Boolean)));
                const total = trxInGroup.reduce((s, t) => s + Number(t.total_akhir || 0), 0);
                const isExpanded = expandedGroups[g.id];
                
                return (
                  <div key={g.id} className="paper p-3 hover:border-ink transition-colors flex flex-col">
                    <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => toggleGroup(g.id)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border shrink-0 ${
                            g.bukti_tf_url ? "border-success text-success" : "border-muted-foreground text-muted-foreground"
                          }`}>
                            {g.bukti_tf_url ? "SELESAI" : "DRAFT"}
                          </span>
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                            {formatTanggal(g.created_at)}
                          </span>
                          {g.drive_file_id && (
                            <span className="text-[9px] uppercase tracking-widest font-bold text-success flex items-center gap-0.5">
                              <Cloud className="w-3 h-3" /> DRIVE
                            </span>
                          )}
                        </div>
                        <div className="font-bold uppercase flex items-center gap-1.5 text-sm leading-snug hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/group/${g.id}`); }}>
                          <Layers className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                          <span className="break-words">{g.nama || "(Tanpa nama)"}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                          {trxInGroup.length === 0 ? "Belum ada transaksi" : (
                            <>
                              Gabungan {trxInGroup.length} transaksi
                              {customers.length > 0 && (
                                <span className="block text-[9px] mt-0.5 break-words">
                                  {customers.join(" · ")}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <div className="num text-sm sm:text-base font-bold flex items-center gap-2">
                          Rp {formatRp(total)}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                          className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
                      </div>
                    </div>
                    
                    {/* Collapsed Transactions list */}
                    {isExpanded && trxInGroup.length > 0 && (
                      <div className="mt-3 pt-3 border-t-2 border-dashed border-paper-edge grid gap-2 pl-4 border-l-2 border-ink/20">
                        {trxInGroup.map(t => (
                          <Link key={t.id} to={`/transaksi/${t.id}`} className="paper p-2 hover:border-ink transition-colors flex items-center justify-between text-xs min-w-0">
                            <div className="min-w-0 truncate pr-2">
                              <div className="font-bold uppercase truncate">{t.customer || "(Tanpa nama)"}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {formatTanggal(t.created_at)} · {(t.nota_ids || []).length} nota
                              </div>
                            </div>
                            <div className="num font-bold shrink-0">Rp {formatRp(t.total_akhir)}</div>
                          </Link>
                        ))}
                      </div>
                    )}
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
              <div key={t.id} className="paper p-3 hover:border-ink transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/transaksi/${t.id}`} className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 border shrink-0 ${
                        t.status === "selesai"
                          ? "border-success text-success"
                          : "border-muted-foreground text-muted-foreground"
                      }`}>
                        {t.status}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {formatTanggal(t.created_at)}
                      </span>
                      {t.drive_file_id && (
                        <span className="text-[9px] uppercase tracking-widest font-bold text-success flex items-center gap-0.5">
                          <Cloud className="w-3 h-3" /> DRIVE
                        </span>
                      )}
                    </div>
                    <div className="font-bold uppercase truncate text-sm">
                      {t.customer || "(Tanpa nama customer)"}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3 shrink-0" />
                      JT: {formatTanggal(t.jatuh_tempo)} · {(t.nota_ids || []).length} nota
                    </div>
                  </Link>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <div className="num text-sm sm:text-base font-bold">Rp {formatRp(t.total_akhir)}</div>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-[9px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1"
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
