import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CompanyCard } from "@/components/CompanyCard";
import { BankCard } from "@/components/BankCard";
import { ArrowLeft, Check, Download, Image as ImageIcon, Loader2, Plus, Share2, Trash2, Upload, X, Cloud } from "lucide-react";
import {
  formatKodeNota,
  formatRp,
  formatTanggal,
  formatTanggalLong,
  hitungDiskonTotal,
  type Bank,
  type Company,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
  type TransactionGroup,
} from "@/lib/nota";
import { generateTandaTerimaGroupPDF } from "@/lib/pdfGroup";
import { TandaTerimaGroupModal } from "@/components/TandaTerimaGroupModal";
import { sharePDF, uploadPDFToDriveStructured } from "@/lib/pdfShare";
import { toast } from "sonner";

export default function GroupPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<TransactionGroup | null>(null);
  const [trxList, setTrxList] = useState<Transaction[]>([]);
  const [allDrafts, setAllDrafts] = useState<Transaction[]>([]);
  const [notasByTrx, setNotasByTrx] = useState<Record<string, Nota[]>>({});
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const load = async () => {
    if (!id) return;

    // Fetch group
    const { data: g } = await supabase
      .from("transaction_groups")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!g) {
      toast.error("Group tidak ditemukan");
      return;
    }

    // Fetch transactions
    const { data: ts } = await supabase
      .from("transactions")
      .select("*")
      .eq("group_id", id);
    const trxs = (ts as unknown as Transaction[]) || [];

    // Fetch notas for transactions
    const allNotaIds = trxs.flatMap((t) => t.nota_ids || []);
    let map: Record<string, Nota[]> = {};
    if (allNotaIds.length > 0) {
      const { data: ns } = await supabase.from("notas").select("*").in("id", allNotaIds);
      const notasAll = (ns as unknown as Nota[]) || [];
      for (const t of trxs) {
        map[t.id] = notasAll.filter((n) => (t.nota_ids || []).includes(n.id));
      }
    }

    // Fetch available drafts
    const { data: drafts } = await supabase
      .from("transactions")
      .select("*")
      .is("group_id", null)
      .neq("status", "selesai")
      .order("created_at", { ascending: false });

    // Set all states together at the end to prevent UI flash
    setTrxList(trxs);
    setNotasByTrx(map);
    setAllDrafts((drafts as unknown as Transaction[]) || []);
    setGroup(g as unknown as TransactionGroup);
  };

  const loadCompaniesBanks = async () => {
    const [{ data: cs }, { data: bs }] = await Promise.all([
      supabase.from("companies").select("*").order("created_at", { ascending: false }),
      supabase.from("banks").select("*").order("created_at", { ascending: false }),
    ]);
    setCompanies((cs as unknown as Company[]) || []);
    setBanks((bs as unknown as Bank[]) || []);
  };

  useEffect(() => {
    load();
    loadCompaniesBanks();
  }, [id]);

  const grandTotal = useMemo(
    () => trxList.reduce((s, t) => s + Number(t.total_akhir || 0), 0),
    [trxList],
  );
  const company = companies.find((c) => c.id === group?.company_id) || null;
  const bank = banks.find((b) => b.id === group?.bank_id) || null;

  const updateGroup = async (patch: Partial<TransactionGroup>) => {
    if (!group) return;
    setGroup({ ...group, ...patch });
    await supabase
      .from("transaction_groups")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", group.id);
  };

  const handleAddTrx = async (trxId: string) => {
    if (!group) return;
    await supabase.from("transactions").update({ group_id: group.id }).eq("id", trxId);
    // Auto-set group name from the first customer added
    const addedTrx = allDrafts.find((t) => t.id === trxId);
    if (addedTrx?.customer && (!group.nama || group.nama === "Group baru")) {
      await updateGroup({ nama: addedTrx.customer });
    }
    await load();
  };

  const handleRemoveTrx = async (trxId: string) => {
    await supabase.from("transactions").update({ group_id: null }).eq("id", trxId);
    await load();
  };

  const handleUploadBukti = async (file: File) => {
    if (!group) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `bukti-tf-group/${group.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("nota-images")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("nota-images").getPublicUrl(path);
      await updateGroup({
        bukti_tf_url: pub.publicUrl,
        tanggal_tf: group.tanggal_tf || new Date().toISOString().slice(0, 10),
      });
      toast.success("Bukti transfer diunggah");
    } catch (e: any) {
      toast.error(e.message || "Gagal upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!group) return;
    setIsDownloading(true);
    try {
      const doc = await generateTandaTerimaGroupPDF(group, trxList, notasByTrx, company, bank);
      doc.save(`tanda-terima-gabungan-${group.id.slice(0, 6)}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveDrive = async () => {
    if (!group) return;
    setIsSavingDrive(true);
    try {
      const year = new Date(group.created_at).getFullYear();
      const customerName = trxList[0]?.customer || group.nama || "GROUP";
      const doc = await generateTandaTerimaGroupPDF(group, trxList, notasByTrx, company, bank);
      const filename = `tanda-terima-gabungan-${group.id.slice(0, 6)}.pdf`;
      const result = await uploadPDFToDriveStructured(doc, filename, customerName, year, null);
      if (result?.id) {
        await supabase.from("transaction_groups").update({ drive_file_id: result.id }).eq("id", group.id);
        setGroup({ ...group, drive_file_id: result.id });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleFinalize = async () => {
    if (!group) return;
    if (!group.bukti_tf_url) {
      toast.error("Upload bukti transfer dahulu");
      return;
    }
    const ids = trxList.map((t) => t.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("transactions")
      .update({
        status: "selesai",
        bukti_tf_url: group.bukti_tf_url,
        tanggal_tf: group.tanggal_tf,
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Semua transaksi diselesaikan");
    load();
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    if (!confirm("Hapus group ini? Transaksi tidak akan dihapus, hanya dilepas.")) return;
    await supabase.from("transactions").update({ group_id: null }).eq("group_id", group.id);
    await supabase.from("transaction_groups").delete().eq("id", group.id);
    navigate("/");
  };

  if (!group) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="text-center py-20 uppercase tracking-widest text-xs text-muted-foreground">
          Memuat...
        </div>
      </div>
    );
  }

  const headerTitle = `PERINCIAN TAGIHAN${company?.kategori ? ` ${company.kategori.toUpperCase()}` : ""
    }${company?.nama ? ` ${company.nama.toUpperCase()}` : ""}`;

  return (
    <div className="min-h-screen pb-24">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-5">
        <Breadcrumb className="mb-4 text-[10px] sm:text-xs uppercase tracking-widest font-bold">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Daftar Transaksi</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/?tab=group">Tagihan Group</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Detail Group</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="grid lg:grid-cols-[1fr,360px] gap-5">
          <div>
            <div className="paper p-4 mb-4">
              <div className="flex justify-between items-start mb-1">
                <div className="label">Nama Group</div>
                {group.drive_file_id ? (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-success flex items-center gap-0.5 px-1 border border-success">
                    <Cloud className="w-3 h-3" /> DRIVE ✓
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground flex items-center gap-0.5 border border-dashed border-muted-foreground px-1">
                    <Cloud className="w-3 h-3" /> BELUM DI DRIVE
                  </span>
                )}
              </div>
              <Input
                value={group.nama || ""}
                onChange={(e) => updateGroup({ nama: e.target.value.toUpperCase() })}
                placeholder="Misal: BAYAR BULAN MEI"
                className="rounded-none border-2 border-paper-edge bg-paper uppercase font-bold"
                disabled
              />
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm">Transaksi dalam Group ({trxList.length})</h2>
              <Button
                onClick={() => setPickerOpen(true)}
                className="bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
              >
                <Plus className="w-4 h-4 mr-1" /> Tambah Transaksi
              </Button>
            </div>

            {trxList.length === 0 ? (
              <div className="paper p-10 text-center">
                <div className="uppercase tracking-widest text-sm font-bold">Belum ada transaksi</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tambahkan transaksi yang akan digabung
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {trxList.map((t) => (
                  <div key={t.id} className="paper p-3">
                    <div className="flex justify-between items-start gap-3">
                      <Link to={`/transaksi/${t.id}`} className="flex-1 min-w-0">
                        <div className="font-bold uppercase truncate">
                          {t.customer || "(Tanpa nama)"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(t.nota_ids || []).length} nota · JT {formatTanggal(t.jatuh_tempo)}
                        </div>
                      </Link>
                      <div className="text-right shrink-0">
                        <div className="num">Rp {formatRp(t.total_akhir)}</div>
                        <button
                          onClick={() => handleRemoveTrx(t.id)}
                          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive flex items-center gap-1 ml-auto mt-1"
                        >
                          <X className="w-3 h-3" /> Lepas
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="paper p-4">
              <div className="text-center divider-dashed pb-2 mb-3 border-t-0 border-b-2">
                <div className="label">Ringkasan Gabungan</div>
              </div>
              <div className="space-y-1 text-sm">
                {trxList.map((t) => (
                  <div key={t.id} className="flex justify-between text-xs">
                    <span className="truncate">{t.customer || "-"}</span>
                    <span className="num">Rp {formatRp(t.total_akhir)}</span>
                  </div>
                ))}
                <div className="divider-dashed pt-2" />
                <div className="flex justify-between text-lg font-bold pt-1">
                  <span className="uppercase">Grand Total</span>
                  <span className="num">Rp {formatRp(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="paper p-4">
              <div className="label mb-2">Bukti Transfer (1 untuk semua)</div>
              {group.bukti_tf_url ? (
                <div className="space-y-2">
                  <div className="border-2 border-paper-edge p-1 relative">
                    <img src={group.bukti_tf_url} alt="Bukti" className="w-full max-h-56 object-contain" />
                    <button
                      onClick={() => updateGroup({ bukti_tf_url: null, tanggal_tf: null, metode_tf: null, catatan_tf: null })}
                      className="absolute top-1 right-1 bg-paper border border-ink p-1 hover:bg-destructive hover:text-paper"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Tanggal Transfer</label>
                    <Input
                      type="date"
                      value={group.tanggal_tf || ""}
                      onChange={(e) => updateGroup({ tanggal_tf: e.target.value || null })}
                      className="rounded-none border-2 border-paper-edge bg-paper h-9"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Metode Pembayaran</label>
                    <select
                      value={group.metode_tf || ""}
                      onChange={(e) => updateGroup({ metode_tf: e.target.value || null })}
                      className="w-full rounded-none border-2 border-paper-edge bg-paper h-9 px-2 text-sm"
                    >
                      <option value="">-- Pilih Metode --</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Tunai">Tunai</option>
                      <option value="Giro">Giro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Catatan</label>
                    <textarea
                      value={group.catatan_tf || ""}
                      onChange={(e) => updateGroup({ catatan_tf: e.target.value || null })}
                      rows={2}
                      className="w-full rounded-none border-2 border-paper-edge bg-paper p-2 text-sm"
                      placeholder="Catatan tambahan..."
                    />
                  </div>
                </div>
              ) : (
                <label className="w-full border-2 border-dashed border-paper-edge p-6 flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-ink hover:text-ink cursor-pointer">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                  <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> Upload Bukti TF</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadBukti(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <Button
              disabled={trxList.length === 0}
              onClick={() => setPreviewOpen(true)}
              className="w-full bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold py-6 border-2 border-ink"
            >
              Preview Tanda Terima Gabungan
            </Button>

            <Button
              variant="outline"
              onClick={handleDeleteGroup}
              className="w-full border-2 border-destructive text-destructive rounded-none uppercase tracking-widest text-xs font-bold"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Hapus Group
            </Button>
          </aside>
        </div>
      </main>

      {/* Picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="paper rounded-none border-2 border-dashed border-paper-edge max-w-lg">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-widest text-xs">
              Pilih Transaksi untuk Digabung
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {(() => {
              const groupCustomer = trxList.length > 0 ? trxList[0].customer : null;
              const availableDrafts = allDrafts.filter(
                (t) => !groupCustomer || t.customer === groupCustomer
              );

              if (availableDrafts.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground italic">
                    Tidak ada transaksi draft yang bisa digabung (harus customer yang sama)
                  </p>
                );
              }

              return availableDrafts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    handleAddTrx(t.id);
                  }}
                  className="w-full paper p-3 hover:border-ink text-left flex justify-between items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold uppercase truncate text-sm">
                      {t.customer || "(Tanpa nama)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(t.nota_ids || []).length} nota · {formatTanggal(t.created_at)}
                    </div>
                  </div>
                  <div className="num text-sm shrink-0">Rp {formatRp(t.total_akhir)}</div>
                </button>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <TandaTerimaGroupModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        group={group}
        trxList={trxList}
        notasByTrx={notasByTrx}
        company={company}
        bank={bank}
        headerTitle={headerTitle}
        grandTotal={grandTotal}
        onFinalized={load}
      />
    </div>
  );
}
