import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Download, Loader2, Share2, Cloud } from "lucide-react";
import {
  formatKodeNota,
  formatRp,
  formatTanggal,
  formatTanggalLong,
  type Bank,
  type Company,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
  type TransactionGroup,
} from "@/lib/nota";
import { generateTandaTerimaGroupPDF } from "@/lib/pdfGroup";
import { sharePDF, uploadPDFToDriveStructured, pdfToBlob } from "@/lib/pdfShare";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: TransactionGroup;
  trxList: Transaction[];
  notasByTrx: Record<string, Nota[]>;
  company: Company | null;
  bank: Bank | null;
  headerTitle: string;
  grandTotal: number;
  onFinalized?: () => void;
};

export const TandaTerimaGroupModal = ({
  open,
  onOpenChange,
  group,
  trxList,
  notasByTrx,
  company,
  bank,
  headerTitle,
  grandTotal,
  onFinalized,
}: Props) => {
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveCopyCount, setDriveCopyCount] = useState(group.drive_file_id ? 2 : 0);

  const buildGroupFilename = (copyN?: number) => {
    const base = `tanda-terima-gabungan-${group.id.slice(0, 6)}`;
    return copyN && copyN >= 2 ? `${base}-(copy-${copyN}).pdf` : `${base}.pdf`;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const doc = await generateTandaTerimaGroupPDF(group, trxList, notasByTrx, company, bank);
      doc.save(buildGroupFilename());
    } catch (e: any) {
      toast.error("Gagal cetak PDF: " + e.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveDrive = async () => {
    if (!company) {
      toast.error("Silakan pilih Company Profile terlebih dahulu");
      return;
    }
    setIsSavingDrive(true);
    try {
      const doc = await generateTandaTerimaGroupPDF(group, trxList, notasByTrx, company, bank);
      const year = new Date().getFullYear();
      const customerName = group.nama || "GROUP";
      // If already saved before, version the filename with copy-N
      const filename = `[GABUNGAN] Tanda Terima ${headerTitle} - ${formatTanggalLong(new Date().toISOString())}${
        driveCopyCount >= 2 ? ` (copy-${driveCopyCount})` : ""
      }.pdf`;
      const result = await uploadPDFToDriveStructured(doc, filename, customerName, year, null);
      
      if (result?.id) {
        toast.success("Berhasil disimpan ke Google Drive");
        const { error: uErr } = await supabase
          .from("transaction_groups")
          .update({ drive_file_id: result.id, updated_at: new Date().toISOString() })
          .eq("id", group.id);
          
        if (uErr) throw uErr;
        setDriveCopyCount(prev => prev === 0 ? 2 : prev + 1);
        // Panggil onFinalized agar UI terupdate
        if (onFinalized) onFinalized();
      } else {
        throw new Error("Gagal upload ke Drive");
      }
    } catch (e: any) {
      toast.error("Gagal simpan ke Drive: " + e.message);
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm("Tandai semua transaksi dalam group ini sebagai selesai?")) return;
    try {
      const ids = trxList.map((t) => t.id);
      const { error } = await supabase
        .from("transactions")
        .update({
          status: "selesai",
          bukti_tf_url: group.bukti_tf_url,
          tanggal_tf: group.tanggal_tf,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      toast.success("Semua transaksi dalam group ditandai selesai.");
      if (onFinalized) onFinalized();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md paper rounded-none border-2 border-dashed border-paper-edge max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-center text-xs">
            {headerTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="bg-paper p-4 border-2 border-ink text-sm">
          <div className="text-center mb-3">
            <div className="font-bold uppercase text-xs leading-tight">{headerTitle}</div>
            <div className="text-[10px] uppercase tracking-widest mt-1">
              {trxList.length} Transaksi Digabung
            </div>
          </div>
          <div className="divider-dashed mb-2" />
          {trxList.map((t, idx) => {
            const notas = notasByTrx[t.id] || [];
            return (
              <div key={t.id} className="mb-3">
                <div className="text-xs font-bold uppercase">
                  #{idx + 1} {t.customer || "-"}
                </div>
                <div className="space-y-0.5 text-[11px] mt-1">
                  {notas.map((n) => (
                    <div key={n.id} className="flex gap-x-2">
                      <span className="shrink-0">{formatTanggal(n.tanggal)}</span>
                      <span className="font-bold flex-1 break-all">{formatKodeNota(n)}</span>
                      <span className="num text-right shrink-0">{formatRp(n.netto)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between">
                    <span>Sub Total</span>
                    <span className="num">Rp {formatRp(t.subtotal)}</span>
                  </div>
                  {(t.diskon_manual as DiskonManual[] || []).map((d, i) => (
                    <div key={i} className="flex justify-between text-muted-foreground">
                      <span>Disc {d.tipe === "persen" ? `${d.nilai}%` : `Rp ${formatRp(d.nilai)}`}</span>
                      <span className="num">
                        {d.tipe === "persen"
                          ? "- Rp " + formatRp((t.subtotal * Number(d.nilai)) / 100)
                          : "- Rp " + formatRp(d.nilai)}
                      </span>
                    </div>
                  ))}
                  {(t.potongan_lain as PotonganLain[] || []).map((p, i) => (
                    <div key={`p-${i}`} className="flex justify-between text-muted-foreground">
                      <span>{p.nama || "Potongan"}</span>
                      <span className="num">- Rp {formatRp(p.nominal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold border-t border-dashed border-paper-edge pt-1">
                    <span>Total</span>
                    <span className="num">Rp {formatRp(t.total_akhir)}</span>
                  </div>
                </div>
                <div className="divider-dashed my-2" />
              </div>
            );
          })}
          <div className="flex justify-between text-lg font-bold">
            <span className="uppercase">GRAND TOTAL</span>
            <span className="num">Rp {formatRp(grandTotal)}</span>
          </div>
          {bank && (
            <>
              <div className="divider-dashed my-3" />
              <div className="text-xs uppercase tracking-widest text-center">
                <div className="font-bold">Pembayaran via</div>
                <div className="mt-1">{bank.nama_bank}</div>
                <div className="num normal-case tracking-normal">{bank.no_rek}</div>
                <div>a/n {bank.atas_nama}</div>
              </div>
            </>
          )}
        </div>

        {/* Lampiran nota preview */}
        {trxList.some((t) => (notasByTrx[t.id] || []).some((n) => n.file_url)) && (
          <div className="border-2 border-dashed border-paper-edge p-2">
            <div className="label text-center mb-2">Lampiran Foto Nota</div>
            <div className="grid grid-cols-2 gap-2">
              {trxList.flatMap((t) =>
                (notasByTrx[t.id] || [])
                  .filter((n) => n.file_url)
                  .map((n) => (
                    <div key={n.id} className="border border-paper-edge p-1">
                      <img
                        src={n.file_url!}
                        alt={formatKodeNota(n)}
                        className="w-full h-32 object-cover"
                        style={{ filter: "grayscale(1) contrast(1.25) brightness(1.05)" }}
                      />
                      <div className="text-[9px] uppercase tracking-widest text-center mt-1 font-bold break-all">
                        {formatKodeNota(n)}
                      </div>
                    </div>
                  )),
              )}
            </div>
          </div>
        )}

        {group.bukti_tf_url && (
          <div className="border-2 border-dashed border-paper-edge p-2">
            <div className="label text-center mb-2">Bukti Transfer</div>
            <div className="border border-paper-edge p-1">
              <img src={group.bukti_tf_url} alt="bukti" className="w-full max-h-64 object-contain" />
              <div className="text-[10px] uppercase tracking-widest text-center mt-1 font-bold">
                Tanggal: {formatTanggalLong(group.tanggal_tf)}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3">
          <Button
            onClick={async () => {
              setIsSharing(true);
              try {
                const doc = await generateTandaTerimaGroupPDF(group, trxList, notasByTrx, company, bank);
                await sharePDF(doc, `tanda-terima-gabungan-${group.id.slice(0, 6)}.pdf`, headerTitle);
              } catch (e) {
                toast.error("Gagal berbagi PDF");
              } finally {
                setIsSharing(false);
              }
            }}
            disabled={isSharing}
            className="bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
          >
            {isSharing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Share2 className="w-4 h-4 mr-1" />}
            Bagikan
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            variant="outline"
            className="border-2 rounded-none uppercase tracking-widest text-xs font-bold"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Cetak PDF
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 pt-1">
          <Button
            onClick={handleSaveDrive}
            disabled={isSavingDrive}
            variant="outline"
            className={`border-2 rounded-none uppercase tracking-widest text-xs font-bold ${group.drive_file_id ? 'border-success text-success hover:bg-success hover:text-paper' : ''}`}
          >
            {isSavingDrive ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Cloud className="w-4 h-4 mr-1" />}
            {group.drive_file_id ? "Sudah Tersimpan di Drive" : "Simpan ke Drive"}
          </Button>
          <Button
            onClick={handleFinalize}
            disabled={!group.bukti_tf_url || trxList.length === 0}
            className="bg-success text-success-foreground hover:bg-success/90 rounded-none uppercase tracking-widest text-xs font-bold mt-2"
          >
            <Check className="w-4 h-4 mr-1" /> Tandai Semua Selesai
          </Button>
          {!group.bukti_tf_url && (
            <div className="text-[10px] uppercase tracking-widest text-stamp text-center border border-stamp p-2">
              Upload bukti transfer untuk menandai selesai
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
