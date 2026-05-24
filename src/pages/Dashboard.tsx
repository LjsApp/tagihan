import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { formatRp, formatTanggal, type Transaction, type Nota, type Company, type Bank } from "@/lib/nota";
import {
  Loader2, AlertCircle, Clock, Wallet, TrendingUp, X, Filter
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const fmtCompact = (v: number) => `Rp ${new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
const fmtFull = (v: number) => `Rp ${formatRp(v)}`;

export default function Dashboard() {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["analyticsDataV2"],
    queryFn: async () => {
      const [
        { data: transactions },
        { data: notas },
        { data: companies },
        { data: banks }
      ] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: true }),
        supabase.from("notas").select("*").order("tanggal", { ascending: false }),
        supabase.from("companies").select("*"),
        supabase.from("banks").select("*")
      ]);
      return {
        transactions: (transactions as unknown as Transaction[]) || [],
        notas: (notas as unknown as Nota[]) || [],
        companies: (companies as unknown as Company[]) || [],
        banks: (banks as unknown as Bank[]) || []
      };
    }
  });

  const { transactions = [], notas = [], companies = [], banks = [] } = data || {};

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  // All unique customers for sidebar
  const allCustomers = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.customer) set.add(t.customer); });
    return Array.from(set).sort();
  }, [transactions]);

  const toggleCustomer = (c: string) => {
    setSelectedCustomers(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  // Filtered transactions & notas
  const filteredTrx = useMemo(() =>
    selectedCustomers.length === 0
      ? transactions
      : transactions.filter(t => t.customer && selectedCustomers.includes(t.customer)),
    [transactions, selectedCustomers]
  );

  const filteredNotaIds = useMemo(() =>
    new Set(filteredTrx.flatMap(t => t.nota_ids || [])),
    [filteredTrx]
  );

  const filteredNotas = useMemo(() =>
    notas.filter(n => filteredNotaIds.has(n.id)),
    [notas, filteredNotaIds]
  );

  // 1. KPIs
  const kpis = useMemo(() => {
    let outstanding = 0, overdue = 0, collectedThisMonth = 0;
    let totalDays = 0, paidCount = 0;
    const now = new Date();
    filteredTrx.forEach(trx => {
      if (trx.status === "draft") {
        outstanding += (trx.total_akhir || 0);
        if (trx.jatuh_tempo && new Date(trx.jatuh_tempo) < today) overdue += (trx.total_akhir || 0);
      } else if (trx.status === "selesai" && trx.tanggal_tf) {
        const tf = new Date(trx.tanggal_tf);
        if (tf.getMonth() === now.getMonth() && tf.getFullYear() === now.getFullYear())
          collectedThisMonth += (trx.total_akhir || 0);
        const diff = Math.ceil((tf.getTime() - new Date(trx.created_at).getTime()) / 86400000);
        if (diff >= 0) { totalDays += diff; paidCount++; }
      }
    });
    return { outstanding, overdue, collectedThisMonth, dso: paidCount > 0 ? Math.round(totalDays / paidCount) : 0 };
  }, [filteredTrx, today]);

  // 2. AR Aging
  const arAging = useMemo(() => {
    let current = 0, l1 = 0, l2 = 0, l3 = 0;
    filteredTrx.forEach(trx => {
      if (trx.status === "draft" && trx.jatuh_tempo) {
        const diff = Math.floor((today.getTime() - new Date(trx.jatuh_tempo).getTime()) / 86400000);
        const v = trx.total_akhir || 0;
        if (diff <= 0) current += v;
        else if (diff <= 15) l1 += v;
        else if (diff <= 30) l2 += v;
        else l3 += v;
      }
    });
    return [
      { name: "Belum JT", value: current, fill: "#22c55e" },
      { name: "Telat 1-15h", value: l1, fill: "#facc15" },
      { name: "Telat 16-30h", value: l2, fill: "#f97316" },
      { name: "Telat >30h", value: l3, fill: "#ef4444" },
    ].filter(x => x.value > 0);
  }, [filteredTrx, today]);

  // 3. Tren Bulanan
  const monthlySales = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTrx.forEach(trx => {
      const d = new Date(trx.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + (trx.total_akhir || 0);
    });
    return Object.keys(map).sort().map(key => {
      const [y, m] = key.split('-');
      return { name: new Date(Number(y), Number(m) - 1).toLocaleString('id-ID', { month: 'short', year: '2-digit' }), total: map[key] };
    }).slice(-12);
  }, [filteredTrx]);

  // 4. Netto per Divisi — dari divisi_nama di nota
  const divisiData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredNotas.forEach(n => {
      const div = n.divisi_nama?.trim() || "Tanpa Divisi";
      map[div] = (map[div] || 0) + (n.netto || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredNotas]);

  // 5. Penerimaan Bank — dari nama_bank master data
  const bankData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTrx.forEach(trx => {
      if (trx.status === "selesai") {
        const b = banks.find(x => x.id === trx.bank_id);
        const name = b?.nama_bank || "Kas/Tunai";
        map[name] = (map[name] || 0) + (trx.total_akhir || 0);
      }
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTrx, banks]);

  // 6. Komposisi Diskon & Potongan — pisah 3 jenis
  const leakages = useMemo(() => {
    let diskonNota = 0, diskonManual = 0, potonganLain = 0;
    filteredNotas.forEach(n => { diskonNota += Number(n.diskon_nota?.nominal || 0); });
    filteredTrx.forEach(trx => {
      (trx.diskon_manual || []).forEach(d => { diskonManual += Number(d.nilai || 0); });
      (trx.potongan_lain || []).forEach(p => { potonganLain += Number(p.nominal || 0); });
    });
    return [
      { name: "Diskon Nota (5%)", value: diskonNota },
      { name: "Diskon Manual", value: diskonManual },
      { name: "Potongan Lain", value: potonganLain }
    ].filter(l => l.value > 0);
  }, [filteredNotas, filteredTrx]);

  // 7. Top 10 Barang — include harga satuan
  const topItems = useMemo(() => {
    const map: Record<string, { name: string; qty: number; hargaSatuan: number; value: number; count: number }> = {};
    filteredNotas.forEach(n => {
      (n.items || []).forEach(item => {
        const key = (item.nama || "").trim().toUpperCase();
        if (!key) return;
        if (!map[key]) map[key] = { name: item.nama, qty: 0, hargaSatuan: 0, value: 0, count: 0 };
        map[key].qty += (item.qty || 0);
        map[key].value += (item.subtotal || 0);
        map[key].hargaSatuan += (item.harga || 0);
        map[key].count += 1;
      });
    });
    return Object.values(map)
      .map(x => ({ ...x, avgHarga: x.count > 0 ? Math.round(x.hargaSatuan / x.count) : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredNotas]);

  // 8. Jatuh Tempo Segera (next 14 days)
  const alerts = useMemo(() => {
    const next14 = new Date(today); next14.setDate(next14.getDate() + 14);
    return filteredTrx
      .filter(t => t.status !== "selesai" && t.jatuh_tempo)
      .map(t => {
        const jt = new Date(t.jatuh_tempo!);
        const diffDays = Math.ceil((jt.getTime() - today.getTime()) / 86400000);
        return { ...t, isOverdue: jt < today, diffDays };
      })
      .filter(t => t.diffDays <= 14)
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 6);
  }, [filteredTrx, today]);

  if (isLoading) return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-20">
      <AppHeader />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* Page Title */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold uppercase tracking-widest">Dashboard Analitik</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest mt-0.5">Pusat kendali keuangan & piutang</p>
          </div>
          {/* Mobile Filter Toggle Button */}
          <button
            onClick={() => setMobileFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 text-xs border-2 border-dashed px-2 py-1 transition-colors md:hidden ${
              selectedCustomers.length > 0
                ? "border-ink text-ink font-bold"
                : "border-paper-edge text-muted-foreground hover:text-ink"
            }`}
          >
            <Filter className="w-3 h-3" />
            Filter {selectedCustomers.length > 0 && `(${selectedCustomers.length})`}
          </button>
        </div>

        {/* Mobile Filter Drawer (Overlay) */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* backdrop */}
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileFilterOpen(false)}
            />
            {/* panel */}
            <div className="absolute top-0 right-0 bottom-0 w-64 bg-paper border-l-2 border-dashed border-paper-edge p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="label text-xs">Filter Customer</span>
                <button onClick={() => setMobileFilterOpen(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {selectedCustomers.length > 0 && (
                <button
                  onClick={() => setSelectedCustomers([])}
                  className="text-[10px] text-destructive hover:underline mb-3 block"
                >
                  Hapus Filter ({selectedCustomers.length})
                </button>
              )}
              <div className="space-y-2.5">
                {allCustomers.map(c => (
                  <label key={c} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(c)}
                      onChange={() => toggleCustomer(c)}
                      className="mt-0.5 accent-ink shrink-0"
                    />
                    <span className={`text-[10px] uppercase leading-tight break-words group-hover:text-ink transition-colors ${selectedCustomers.includes(c) ? "font-bold text-ink" : "text-muted-foreground"}`}>
                      {c}
                    </span>
                  </label>
                ))}
                {allCustomers.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Belum ada data</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 sm:gap-6">

          {/* SIDEBAR FILTER — Desktop only */}
          <aside className="hidden md:block w-44 lg:w-52 shrink-0">
            <div className="paper p-3 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <span className="label text-[10px]">Filter Customer</span>
              </div>
              {selectedCustomers.length > 0 && (
                <button
                  onClick={() => setSelectedCustomers([])}
                  className="text-[10px] text-destructive hover:underline mb-2 block"
                >
                  Hapus Filter ({selectedCustomers.length})
                </button>
              )}
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {allCustomers.map(c => (
                  <label key={c} className="flex items-start gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(c)}
                      onChange={() => toggleCustomer(c)}
                      className="mt-0.5 accent-ink shrink-0"
                    />
                    <span className={`text-[10px] uppercase leading-tight break-words group-hover:text-ink transition-colors ${selectedCustomers.includes(c) ? "font-bold text-ink" : "text-muted-foreground"}`}>
                      {c}
                    </span>
                  </label>
                ))}
                {allCustomers.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Belum ada data</p>
                )}
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 min-w-0 space-y-4 sm:space-y-6">

            {/* ALERTS */}
            {alerts.length > 0 && (
              <div>
                <p className="label mb-2 text-destructive flex items-center gap-1.5 text-[10px] sm:text-xs">
                  <AlertCircle className="w-3.5 h-3.5" /> Tagihan Segera Jatuh Tempo
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                  {alerts.map(a => (
                    <div key={a.id} className={`paper p-3 border-l-4 ${a.isOverdue ? 'border-l-red-500 bg-red-500/5' : 'border-l-amber-400 bg-amber-400/5'}`}>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[9px] font-bold uppercase truncate">{a.customer || "-"}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 shrink-0 ${a.isOverdue ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>
                          {a.isOverdue ? `Telat ${Math.abs(a.diffDays)}h` : `H-${a.diffDays}`}
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">JT: {formatTanggal(a.jatuh_tempo)}</div>
                      <div className="text-xs font-mono font-bold mt-1">Rp {formatRp(a.total_akhir)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Piutang Berjalan", value: kpis.outstanding, icon: Clock, color: "border-l-blue-500", textColor: "" },
                { label: "Overdue (Tunggakan)", value: kpis.overdue, icon: AlertCircle, color: "border-l-red-500 bg-red-500/5", textColor: "text-red-600" },
                { label: "Masuk Bulan Ini", value: kpis.collectedThisMonth, icon: Wallet, color: "border-l-green-500 bg-green-500/5", textColor: "text-green-600" },
                { label: "Rata-rata Penagihan", value: null, dso: kpis.dso, icon: TrendingUp, color: "border-l-purple-500", textColor: "" },
              ].map((kpi, i) => (
                <div key={i} className={`paper p-3 sm:p-4 border-l-4 ${kpi.color}`}>
                  <div className={`flex items-center justify-between mb-2 ${kpi.textColor || "text-muted-foreground"}`}>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase leading-tight">{kpi.label}</span>
                    <kpi.icon className="w-3.5 h-3.5 shrink-0" />
                  </div>
                  {kpi.dso !== undefined ? (
                    <div className={`text-base sm:text-xl font-mono font-bold ${kpi.textColor || "text-ink"} flex items-baseline gap-1`}>
                      {kpi.dso} <span className="text-xs font-sans text-muted-foreground">Hari</span>
                    </div>
                  ) : (
                    <div className={`text-base sm:text-xl font-mono font-bold ${kpi.textColor || "text-ink"}`}>
                      {fmtCompact(kpi.value!)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* CHARTS ROW 1 */}
            <div className="grid lg:grid-cols-2 gap-4">

              {/* AR Aging */}
              <div className="paper p-4">
                <h3 className="label mb-3 text-center text-[10px]">Jadwal Umur Piutang (AR Aging)</h3>
                <div className="h-48 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={arAging} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} width={55} />
                      <RechartsTooltip formatter={(v: number) => fmtFull(v)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {arAging.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tren Bulanan */}
              <div className="paper p-4">
                <h3 className="label mb-3 text-center text-[10px]">Tren Transaksi 12 Bulan</h3>
                <div className="h-48 sm:h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlySales} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 9, fill: '#888' }} axisLine={false} tickLine={false} width={55} />
                      <RechartsTooltip formatter={(v: number) => fmtFull(v)} />
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: "#3b82f6" }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* CHARTS ROW 2 - 3 pie charts */}
            <div className="grid sm:grid-cols-3 gap-4">

              {/* Netto per Divisi */}
              <div className="paper p-4">
                <h3 className="label mb-2 text-center text-[10px]">Netto per Divisi</h3>
                {divisiData.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-muted-foreground uppercase">Belum ada data</div>
                ) : (
                  <div className="h-40 sm:h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={divisiData} cx="50%" cy="45%" innerRadius="35%" outerRadius="65%" dataKey="value" paddingAngle={2}>
                          {divisiData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => fmtFull(v)} />
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '9px', paddingTop: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Penerimaan Bank */}
              <div className="paper p-4">
                <h3 className="label mb-2 text-center text-[10px]">Penerimaan per Bank</h3>
                {bankData.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-muted-foreground uppercase">Belum ada transaksi selesai</div>
                ) : (
                  <div className="h-40 sm:h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={bankData} cx="50%" cy="45%" outerRadius="65%" dataKey="value" paddingAngle={2}>
                          {bankData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => fmtFull(v)} />
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '9px', paddingTop: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Komposisi Diskon */}
              <div className="paper p-4">
                <h3 className="label mb-2 text-center text-[10px]">Komposisi Diskon & Potongan</h3>
                {leakages.length === 0 ? (
                  <div className="text-center py-8 text-[10px] text-muted-foreground uppercase">Belum ada potongan</div>
                ) : (
                  <div className="h-40 sm:h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leakages} cx="50%" cy="45%" innerRadius="35%" outerRadius="65%" dataKey="value" paddingAngle={2}>
                          {leakages.map((_, i) => <Cell key={i} fill={COLORS[(i + 4) % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip formatter={(v: number) => fmtFull(v)} />
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '9px', paddingTop: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* TOP ITEMS TABLE */}
            <div className="paper p-4">
              <h3 className="label mb-3 text-[10px]">Top 10 Barang / Jasa (Berdasarkan Nilai Penjualan)</h3>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-left text-[10px] sm:text-xs whitespace-nowrap min-w-[520px]">
                  <thead>
                    <tr className="border-b-2 border-paper-edge uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 pr-3 font-bold w-8">#</th>
                      <th className="pb-2 pr-3 font-bold">Nama Barang / Jasa</th>
                      <th className="pb-2 pr-3 font-bold text-right">Total Qty</th>
                      <th className="pb-2 pr-3 font-bold text-right">Harga Satuan</th>
                      <th className="pb-2 font-bold text-right">Total Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-paper-edge/40">
                    {topItems.map((item, i) => (
                      <tr key={i} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2 pr-3 text-muted-foreground font-bold">#{i + 1}</td>
                        <td className="py-2 pr-3 font-bold uppercase truncate max-w-[200px]">{item.name}</td>
                        <td className="py-2 pr-3 text-right font-mono">{item.qty.toLocaleString('id-ID')}</td>
                        <td className="py-2 pr-3 text-right font-mono">Rp {formatRp(item.avgHarga)}</td>
                        <td className="py-2 text-right font-mono font-bold">Rp {formatRp(item.value)}</td>
                      </tr>
                    ))}
                    {topItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground uppercase tracking-widest">
                          Belum ada item
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
