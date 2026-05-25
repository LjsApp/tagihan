import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { ScanModal } from "@/components/ScanModal";
import { NotaDetailModal } from "@/components/NotaDetailModal";
import { EditNotaModal } from "@/components/EditNotaModal";
import { TandaTerimaModal } from "@/components/TandaTerimaModal";
import { RupiahInput } from "@/components/RupiahInput";
import { CompanyCard } from "@/components/CompanyCard";
import { BankCard } from "@/components/BankCard";
import { PaymentProofCard } from "@/components/PaymentProofCard";
import { PotonganLainCard } from "@/components/PotonganLainCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Camera,
  Eye,
  Pencil,
  Trash2,
  Plus,
  X,
  FileCheck2,
  AlertTriangle,
} from "lucide-react";
import {
  formatRp,
  formatTanggal,
  formatTanggalLong,
  hitungJatuhTempo,
  hitungPotonganLainTotal,
  hitungSubtotal,
  hitungTotalAkhir,
  toISODate,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
  type Company,
  type Bank,
} from "@/lib/nota";
import { toast } from "sonner";

const TransactionPage = () => {
  const { id } = useParams<{ id: string }>();
  const [trx, setTrx] = useState<Transaction | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [detailNota, setDetailNota] = useState<Nota | null>(null);
  const [editNota, setEditNota] = useState<Nota | null>(null);
  const [terimaOpen, setTerimaOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  const loadCompaniesBanks = async () => {
    const [{ data: cs }, { data: bs }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("banks").select("*").order("created_at", { ascending: false }),
    ]);
    setCompanies((cs as unknown as Company[]) || []);
    setBanks((bs as unknown as Bank[]) || []);
  };

  const handleSelectCompany = async (company_id: string | null) => {
    if (!trx) return;
    setTrx({ ...trx, company_id });
    await supabase
      .from("transactions")
      .update({ company_id, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
    loadCompaniesBanks();
  };

  const handleSelectBank = async (bank_id: string | null) => {
    if (!trx) return;
    setTrx({ ...trx, bank_id });
    await supabase
      .from("transactions")
      .update({ bank_id, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
    loadCompaniesBanks();
  };

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: t, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !t) {
      toast.error("Transaksi tidak ditemukan");
      setLoading(false);
      return;
    }
    const trxData = t as unknown as Transaction;
    let loadedNotas: Nota[] = [];
    if (trxData.nota_ids.length > 0) {
      const { data: ns } = await supabase
        .from("notas")
        .select("*")
        .in("id", trxData.nota_ids);
      loadedNotas = (ns as unknown as Nota[]) || [];
    }
    
    // Set both together and then finish loading
    setNotas(loadedNotas);
    setTrx(trxData);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadCompaniesBanks();
  }, [id]);

  // Re-fetch on focus to catch CRUD from cards
  useEffect(() => {
    const onFocus = () => loadCompaniesBanks();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Auto recalc & save when notas / diskon change
  const subtotal = useMemo(() => hitungSubtotal(notas), [notas]);
  const diskon = trx?.diskon_manual || [];
  const potongan = trx?.potongan_lain || [];
  const totalAkhir = useMemo(
    () => hitungTotalAkhir(subtotal, diskon, potongan),
    [subtotal, diskon, potongan],
  );
  const jt = useMemo(() => {
    if (notas.length === 0) return null;
    const company = companies.find((c) => c.id === trx?.company_id);
    const hari = company?.jatuh_tempo_hari ?? 21;
    return hitungJatuhTempo(notas.map((n) => n.tanggal), hari);
  }, [notas, companies, trx?.company_id]);

  // mismatch check item vs total
  const mismatch = useMemo(() => {
    return notas
      .map((n) => {
        const sumItem = n.items.reduce((s, i) => s + (i.subtotal || 0), 0);
        if (n.items.length === 0) return null;
        if (Math.abs(sumItem - n.total) > 1000) return n;
        return null;
      })
      .filter(Boolean) as Nota[];
  }, [notas]);

  useEffect(() => {
    if (loading || !trx) return;
    const newJT = jt ? toISODate(jt) : null;
    const customerFromNotas = notas.find((n) => n.nama_customer)?.nama_customer || trx.customer;
    if (
      trx.subtotal !== subtotal ||
      trx.total_akhir !== totalAkhir ||
      trx.jatuh_tempo !== newJT ||
      trx.customer !== customerFromNotas
    ) {
      supabase
        .from("transactions")
        .update({
          subtotal,
          total_akhir: totalAkhir,
          jatuh_tempo: newJT,
          customer: customerFromNotas,
          updated_at: new Date().toISOString(),
        })
        .eq("id", trx.id)
        .then(({ error }) => {
          if (!error)
            setTrx((t) =>
              t
                ? { ...t, subtotal, total_akhir: totalAkhir, jatuh_tempo: newJT, customer: customerFromNotas }
                : t,
            );
        });
    }
  }, [subtotal, totalAkhir, jt, notas, trx?.id]);

  const handleScanned = async (notaId: string) => {
    if (!trx) return;
    const newIds = [...trx.nota_ids, notaId];
    const { error } = await supabase
      .from("transactions")
      .update({ nota_ids: newIds, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const handleRemoveNota = async (notaId: string) => {
    if (!trx) return;
    if (!confirm("Hapus nota dari transaksi ini?")) return;
    const newIds = trx.nota_ids.filter((x) => x !== notaId);
    await supabase
      .from("transactions")
      .update({ nota_ids: newIds, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
    await supabase.from("notas").delete().eq("id", notaId);
    load();
  };

  const updateDiskon = async (next: DiskonManual[]) => {
    if (!trx) return;
    setTrx({ ...trx, diskon_manual: next });
    await supabase
      .from("transactions")
      .update({ diskon_manual: next as any, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
  };

  const updatePotonganLain = async (next: PotonganLain[]) => {
    if (!trx) return;
    setTrx({ ...trx, potongan_lain: next });
    await supabase
      .from("transactions")
      .update({ potongan_lain: next as any, updated_at: new Date().toISOString() })
      .eq("id", trx.id);
  };

  const addDiskon = () => updateDiskon([...diskon, { tipe: "persen", nilai: 5 }]);
  const removeDiskon = (i: number) => updateDiskon(diskon.filter((_, x) => x !== i));
  const editDiskon = (i: number, patch: Partial<DiskonManual>) =>
    updateDiskon(diskon.map((d, x) => (x === i ? { ...d, ...patch } : d)));

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="text-center py-20 uppercase tracking-widest text-xs text-muted-foreground">
          Memuat...
        </div>
      </div>
    );
  }

  if (!trx) return null;

  return (
    <div className="min-h-screen pb-24 lg:pb-6">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-ink mb-3"
        >
          <ArrowLeft className="w-3 h-3" /> Daftar transaksi
        </Link>

        <div className="grid lg:grid-cols-[1fr,360px] gap-5">
          {/* LEFT */}
          <div>
            <div className="paper p-4 mb-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <div className="label">Customer</div>
                  <div className="font-bold text-lg uppercase">
                    {trx.customer || "(Akan terisi otomatis)"}
                  </div>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 border ${
                    trx.status === "selesai"
                      ? "border-success text-success"
                      : "border-muted-foreground text-muted-foreground"
                  }`}
                >
                  {trx.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm">Daftar Nota ({notas.length})</h2>
              <Button
                onClick={() => setScanOpen(true)}
                className="bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
              >
                <Camera className="w-4 h-4 mr-1" /> Scan Nota
              </Button>
            </div>

            {mismatch.length > 0 && (
              <div className="paper border-stamp text-stamp p-3 mb-3 flex gap-2 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  {mismatch.length} nota memiliki ketidakcocokan antara jumlah item dan total. Periksa kembali.
                </div>
              </div>
            )}

            {notas.length === 0 ? (
              <div className="paper p-10 text-center">
                <Camera className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <div className="uppercase tracking-widest text-sm font-bold">Belum ada nota</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Mulai scan nota pertama
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notas.map((n) => (
                  <div key={n.id} className="paper p-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 text-xs">
                          <span className="font-bold break-all leading-tight">{n.full_no || n.no_nota || "-"}</span>
                          <span className="text-muted-foreground whitespace-nowrap shrink-0">{formatTanggal(n.tanggal)}</span>
                        </div>
                        <div className="text-sm uppercase truncate">{n.nama_customer || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {n.items.length} item
                          {n.diskon_nota.persen > 0 && ` · disc ${n.diskon_nota.persen}%`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="num">Rp {formatRp(n.netto)}</div>
                        <div className="flex gap-1 mt-1 justify-end">
                          <button
                            onClick={() => setDetailNota(n)}
                            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Detail
                          </button>
                          <button
                            onClick={() => setEditNota(n)}
                            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            onClick={() => handleRemoveNota(n.id)}
                            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Summary */}
          <aside className="space-y-4">
            <div className="paper p-4">
              <div className="text-center divider-dashed pb-2 mb-3 border-t-0 border-b-2">
                <div className="label">Ringkasan</div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="num">Rp {formatRp(subtotal)}</span>
                </div>
                {diskon.map((d, i) => {
                  const val =
                    d.tipe === "persen" ? (subtotal * Number(d.nilai || 0)) / 100 : Number(d.nilai || 0);
                  return (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        Disc {d.tipe === "persen" ? `${d.nilai}%` : `Rp ${formatRp(d.nilai)}`}
                      </span>
                      <span className="num">- Rp {formatRp(val)}</span>
                    </div>
                  );
                })}
                {(potongan || []).map((p, i) => (
                  <div key={`pl-${i}`} className="flex justify-between text-xs text-muted-foreground">
                    <span>{p.nama || "Potongan"}</span>
                    <span className="num">- Rp {formatRp(p.nominal)}</span>
                  </div>
                ))}
                <div className="divider-dashed pt-2" />
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span className="uppercase">Total</span>
                  <span className="num">Rp {formatRp(totalAkhir)}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t-2 border-dashed border-paper-edge text-center">
                <div className="label">Jatuh Tempo</div>
                <div className="font-bold">{formatTanggalLong(jt ? toISODate(jt) : null)}</div>
              </div>
            </div>

            {/* Diskon panel */}
            <div className="paper p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="label">Diskon Tambahan</div>
                <button
                  onClick={addDiskon}
                  className="text-[10px] uppercase tracking-widest font-bold text-ink hover:text-stamp flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah
                </button>
              </div>
              {diskon.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Belum ada diskon tambahan</p>
              ) : (
                <div className="space-y-2">
                  {diskon.map((d, i) => (
                    <div key={i} className="flex gap-1 items-center">
                      <select
                        value={d.tipe}
                        onChange={(e) =>
                          editDiskon(i, { tipe: e.target.value as "persen" | "nominal" })
                        }
                        className="border-2 border-paper-edge bg-paper px-2 py-1 text-xs uppercase font-bold rounded-none"
                      >
                        <option value="persen">%</option>
                        <option value="nominal">Rp</option>
                      </select>
                      {d.tipe === "nominal" ? (
                        <RupiahInput
                          value={Number(d.nilai) || 0}
                          onChange={(n) => editDiskon(i, { nilai: n })}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <Input
                          type="number"
                          value={d.nilai}
                          onChange={(e) => editDiskon(i, { nilai: Number(e.target.value) })}
                          className="rounded-none border-2 border-paper-edge bg-paper num h-8 text-sm"
                          placeholder="%"
                        />
                      )}
                      <button
                        onClick={() => removeDiskon(i)}
                        className="text-muted-foreground hover:text-destructive shrink-0 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <PotonganLainCard items={potongan} onChange={updatePotonganLain} />

            <CompanyCard
              selectedId={trx.company_id}
              onSelect={handleSelectCompany}
            />

            <BankCard selectedId={trx.bank_id} onSelect={handleSelectBank} />

            <PaymentProofCard
              trxId={trx.id}
              buktiUrl={trx.bukti_tf_url}
              tanggalTf={trx.tanggal_tf}
              metodeTf={trx.metode_tf}
              catatanTf={trx.catatan_tf}
              onUpdate={(patch) => setTrx((t) => (t ? { ...t, ...patch } as Transaction : t))}
            />

            <Button
              disabled={notas.length === 0}
              onClick={() => setTerimaOpen(true)}
              className="w-full bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold py-6 border-2 border-ink"
            >
              <FileCheck2 className="w-4 h-4 mr-2" /> Generate Tanda Terima
            </Button>
          </aside>
        </div>
      </main>

      <ScanModal
        open={scanOpen}
        onOpenChange={setScanOpen}
        onSaved={handleScanned}
        existingCustomer={notas[0]?.nama_customer ?? trx.customer ?? null}
      />
      <NotaDetailModal
        nota={detailNota}
        open={!!detailNota}
        onOpenChange={(v) => !v && setDetailNota(null)}
      />
      <EditNotaModal
        nota={editNota}
        open={!!editNota}
        onOpenChange={(v) => !v && setEditNota(null)}
        onSaved={() => {
          setEditNota(null);
          load();
        }}
      />
      {trx && (
        <TandaTerimaModal
          open={terimaOpen}
          onOpenChange={setTerimaOpen}
          trx={{ ...trx, subtotal, total_akhir: totalAkhir, jatuh_tempo: jt ? toISODate(jt) : null }}
          notas={notas}
          company={companies.find((c) => c.id === trx.company_id) || null}
          bank={banks.find((b) => b.id === trx.bank_id) || null}
          onFinalized={() => {
            setTerimaOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
};

export default TransactionPage;
