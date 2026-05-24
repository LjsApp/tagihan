import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { formatRp, formatTanggal, type Transaction, type Nota, type Company } from "@/lib/nota";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface FlattenedItem {
  notaId: string;
  trxId: string;
  tanggal: string;
  customer: string;
  pc: number;
  qty: number;
  satuan: string;
  namaBarang: string;
  harga: number;
  subtotal: number;
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["analyticsData"],
    queryFn: async () => {
      const [
        { data: transactions },
        { data: notas },
        { data: companies }
      ] = await Promise.all([
        supabase.from("transactions").select("*").order("created_at", { ascending: false }),
        supabase.from("notas").select("*").order("tanggal", { ascending: false }),
        supabase.from("companies").select("*")
      ]);

      return {
        transactions: (transactions as unknown as Transaction[]) || [],
        notas: (notas as unknown as Nota[]) || [],
        companies: (companies as unknown as Company[]) || []
      };
    }
  });

  const { transactions = [], notas = [], companies = [] } = data || {};

  // 1. Data Processing for "Netto per Divisi"
  const nettoPerDivisi = useMemo(() => {
    const divMap: Record<string, number> = {};
    transactions.forEach(trx => {
      const comp = companies.find(c => c.id === trx.company_id);
      const divisi = comp?.kategori || "Tanpa Divisi";
      divMap[divisi] = (divMap[divisi] || 0) + (trx.total_akhir || 0);
    });
    return Object.entries(divMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, companies]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ef4444'];

  // 2. Data Processing for "Diskon 5% per Customer"
  const diskonPerCustomer = useMemo(() => {
    const custMap: Record<string, number> = {};
    notas.forEach(n => {
      if (n.nama_customer && n.diskon_nota?.nominal) {
        custMap[n.nama_customer] = (custMap[n.nama_customer] || 0) + Number(n.diskon_nota.nominal);
      }
    });
    return Object.entries(custMap)
      .map(([customer, total]) => ({ customer, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10
  }, [notas]);

  // 3. Data Processing for "Rata-rata Telat Bayar per Customer"
  const latePaymentStats = useMemo(() => {
    const stats: Record<string, { totalDays: number; count: number }> = {};
    transactions.forEach(trx => {
      if (trx.status === "selesai" && trx.tanggal_tf && trx.jatuh_tempo && trx.customer) {
        const tfDate = new Date(trx.tanggal_tf);
        const jtDate = new Date(trx.jatuh_tempo);
        const diffTime = tfDate.getTime() - jtDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Only count if actually late (diffDays > 0)
        if (diffDays > 0) {
          if (!stats[trx.customer]) stats[trx.customer] = { totalDays: 0, count: 0 };
          stats[trx.customer].totalDays += diffDays;
          stats[trx.customer].count += 1;
        }
      }
    });
    
    return Object.entries(stats)
      .map(([customer, s]) => ({
        customer,
        avgDays: Math.round(s.totalDays / s.count)
      }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 10);
  }, [transactions]);

  // 4. Overdue / Nearing Due Date Transactions
  const alerts = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    return transactions
      .filter(t => t.status !== "selesai" && t.jatuh_tempo)
      .map(t => {
        const jt = new Date(t.jatuh_tempo!);
        const isOverdue = jt < today;
        const diffTime = jt.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...t, isOverdue, diffDays };
      })
      .filter(t => t.diffDays <= 7)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [transactions]);

  // 5. Flattened Items Table
  const allItems = useMemo(() => {
    const items: FlattenedItem[] = [];
    notas.forEach(nota => {
      const trx = transactions.find(t => (t.nota_ids || []).includes(nota.id));
      (nota.items || []).forEach(item => {
        items.push({
          notaId: nota.id,
          trxId: trx?.id || "",
          tanggal: nota.tanggal,
          customer: nota.nama_customer || trx?.customer || "-",
          pc: item.pc || 0,
          qty: item.qty || 0,
          satuan: item.satuan || "-",
          namaBarang: item.nama_barang || "-",
          harga: item.harga || 0,
          subtotal: item.subtotal || 0,
        });
      });
    });
    return items.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()).slice(0, 50); // limit to latest 50 for performance
  }, [notas, transactions]);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-6">
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold uppercase tracking-widest">Dashboard Analitik</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Pantauan dan metrik transaksi</p>
        </div>

        {/* ALERTS SECTION */}
        {alerts.length > 0 && (
          <div className="mb-8">
            <div className="label mb-3 flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Perhatian: Jatuh Tempo
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {alerts.map(a => (
                <div key={a.id} className={`paper p-4 border-2 ${a.isOverdue ? 'border-destructive bg-destructive/5' : 'border-warning bg-warning/5'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold uppercase text-sm truncate">{a.customer || "Tanpa Nama"}</div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest ${a.isOverdue ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}`}>
                      {a.isOverdue ? `Telat ${Math.abs(a.diffDays)} hr` : `H-${a.diffDays}`}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                    JT: {formatTanggal(a.jatuh_tempo)}
                  </div>
                  <div className="text-sm num font-bold">
                    Rp {formatRp(a.total_akhir)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          
          {/* CHART: NETTO PER DIVISI */}
          <div className="paper p-5">
            <h3 className="label mb-4 text-center">Total Netto per Divisi</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nettoPerDivisi}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {nettoPerDivisi.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => `Rp ${formatRp(value)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART: LATE PAYMENTS */}
          <div className="paper p-5">
            <h3 className="label mb-4 text-center">Rata-rata Telat Bayar (Hari) per Customer</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latePaymentStats} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" />
                  <YAxis dataKey="customer" type="category" width={100} tick={{ fontSize: 10 }} />
                  <RechartsTooltip />
                  <Bar dataKey="avgDays" fill="#ef4444" name="Rata-rata Hari" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* TOP DISCOUNTS */}
          <div className="paper p-5 lg:col-span-1">
            <h3 className="label mb-4">Total Diskon 5% per Customer (Top 10)</h3>
            <div className="space-y-3">
              {diskonPerCustomer.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">Belum ada data diskon</div>
              ) : diskonPerCustomer.map((d, i) => (
                <div key={d.customer} className="flex justify-between items-center border-b border-dashed border-paper-edge pb-2">
                  <div className="text-xs font-bold uppercase truncate pr-2">
                    {i+1}. {d.customer}
                  </div>
                  <div className="text-xs num font-bold whitespace-nowrap">
                    Rp {formatRp(d.total)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RECENT ITEMS TABLE */}
          <div className="paper p-5 lg:col-span-2 overflow-hidden">
            <h3 className="label mb-4">Rincian Item Terakhir (Top 50)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b-2 border-paper-edge uppercase tracking-widest text-muted-foreground">
                    <th className="pb-2 font-bold pr-4">Tgl</th>
                    <th className="pb-2 font-bold pr-4">Customer</th>
                    <th className="pb-2 font-bold pr-4">Barang</th>
                    <th className="pb-2 font-bold pr-4">PC / Qty</th>
                    <th className="pb-2 font-bold pr-4 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-edge/50">
                  {allItems.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2 pr-4 text-[10px]">{formatTanggal(item.tanggal)}</td>
                      <td className="py-2 pr-4 font-bold uppercase truncate max-w-[150px]">{item.customer}</td>
                      <td className="py-2 pr-4 truncate max-w-[200px]">{item.namaBarang}</td>
                      <td className="py-2 pr-4 text-[10px]">
                        {item.pc} {item.satuan} / {item.qty} {item.satuan}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono font-bold">
                        Rp {formatRp(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                  {allItems.length === 0 && (
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
        </div>

      </main>
    </div>
  );
}
