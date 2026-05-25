import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share2, Check, Download, Loader2, Cloud } from "lucide-react";
import {
  formatRp,
  formatTanggal,
  formatTanggalLong,
  formatKodeNota,
  hitungDiskonTotal,
  hitungPotonganLainTotal,
  type Bank,
  type Company,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
} from "@/lib/nota";
import { generateTandaTerimaPDF } from "@/lib/pdf";
import {
  sharePDF,
  uploadPDFToDriveStructured,
  pdfToBlob,
} from "@/lib/pdfShare";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZoomableImg } from "@/components/ImageLightbox";

export const TandaTerimaModal = ({
  open,
  onOpenChange,
  trx,
  notas,
  company,
  bank,
  onFinalized,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trx: Transaction;
  notas: Nota[];
  company: Company | null;
  bank: Bank | null;
  onFinalized?: () => void;
}) => {
  const totalDisc = hitungDiskonTotal(trx.subtotal, trx.diskon_manual || []);
  const [isSharing, setIsSharing] = useState(false);
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [driveCopyCount, setDriveCopyCount] = useState(trx.drive_file_id ? 2 : 0);

  const headerTitle = `PERINCIAN TAGIHAN${
    company?.kategori ? ` ${company.kategori.toUpperCase()}` : ""
  }${company?.nama ? ` ${company.nama.toUpperCase()}` : ""}`;

  const buildFilename = (copyN?: number) => {
    const base = `tanda-terima-${(company?.nama || trx.customer || "nota")
      .replace(/\s+/g, "-")
      .toLowerCase()}-${trx.id.slice(0, 6)}`;
    return copyN && copyN >= 2 ? `${base}-(copy-${copyN}).pdf` : `${base}.pdf`;
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const doc = await generateTandaTerimaPDF(trx, notas, company, bank);
      await sharePDF(doc, buildFilename(), headerTitle);
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat PDF");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const doc = await generateTandaTerimaPDF(trx, notas, company, bank);
      const file = pdfToBlob(doc);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error("Gagal mendownload PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveDrive = async () => {
    setIsSavingDrive(true);
    try {
      const year = new Date(trx.created_at).getFullYear();
      const customerName = trx.customer || "UNKNOWN";
      const doc = await generateTandaTerimaPDF(trx, notas, company, bank);
      // If already saved before, version the filename with copy-N
      const filename = buildFilename(driveCopyCount >= 2 ? driveCopyCount : undefined);
      const result = await uploadPDFToDriveStructured(doc, filename, customerName, year, null);
      if (result?.id) {
        // Save to DB
        await supabase
          .from("transactions")
          .update({ drive_file_id: result.id })
          .eq("id", trx.id);
        if (trx) trx.drive_file_id = result.id; // local update
        setDriveCopyCount(prev => prev === 0 ? 2 : prev + 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleFinalize = async () => {
    const { error } = await supabase
      .from("transactions")
      .update({ status: "selesai", updated_at: new Date().toISOString() })
      .eq("id", trx.id);
    if (error) return toast.error(error.message);
    toast.success("Transaksi selesai");
    onFinalized?.();
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
            <div className="text-xs uppercase tracking-widest mt-1">{trx.customer || "-"}</div>
          </div>
          <div className="divider-dashed mb-2" />
          <div className="grid grid-cols-[auto,1fr,auto] gap-x-3 text-xs font-bold uppercase mb-1">
            <span>Tgl</span>
            <span>Kode-Nota</span>
            <span className="text-right">Jumlah</span>
          </div>
          <div className="divider-dashed mb-2" />
          <div className="space-y-1 text-xs">
            {notas.map((n) => (
              <div key={n.id} className="flex gap-x-2">
                <span className="shrink-0">{formatTanggal(n.tanggal)}</span>
                <span className="font-bold flex-1 break-all">{formatKodeNota(n)}</span>
                <span className="num text-right shrink-0">{formatRp(n.netto)}</span>
              </div>
            ))}
          </div>
          <div className="divider-dashed my-3" />
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Sub Total</span>
              <span className="num">Rp {formatRp(trx.subtotal)}</span>
            </div>
            {(trx.diskon_manual || []).map((d: DiskonManual, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>
                  Disc {d.tipe === "persen" ? `${d.nilai}%` : `Rp ${formatRp(d.nilai)}`}
                </span>
                <span className="num">
                  {d.tipe === "persen"
                    ? "- Rp " + formatRp((trx.subtotal * d.nilai) / 100)
                    : "- Rp " + formatRp(d.nilai)}
                </span>
              </div>
            ))}
            {(trx.potongan_lain || []).map((p: PotonganLain, i) => (
              <div key={`pl-${i}`} className="flex justify-between text-muted-foreground">
                <span>{p.nama || "Potongan"}</span>
                <span className="num">- Rp {formatRp(p.nominal)}</span>
              </div>
            ))}
          </div>
          <div className="divider-dashed my-3" />
          <div className="flex justify-between text-lg font-bold">
            <span className="uppercase">TOTAL</span>
            <span className="num">Rp {formatRp(trx.total_akhir)}</span>
          </div>
          <div className="text-center mt-4 text-xs uppercase tracking-widest">
            <span className="font-bold">Jatuh Tempo:</span> {formatTanggalLong(trx.jatuh_tempo)}
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

        {/* Lampiran preview */}
        {notas.some((n) => n.file_url) && (
          <div className="border-2 border-dashed border-paper-edge p-2">
            <div className="label text-center mb-2">Lampiran Foto Nota</div>
            <div className="grid grid-cols-2 gap-2">
              {notas
                .filter((n) => n.file_url)
                .map((n) => (
                  <div key={n.id} className="border border-paper-edge p-1">
                    <ZoomableImg
                      src={n.file_url!}
                      alt={formatKodeNota(n)}
                      className="w-full h-32 object-cover"
                      style={{ filter: "grayscale(1) contrast(1.25) brightness(1.05)" }}
                    />
                    <div className="text-[9px] uppercase tracking-widest text-center mt-1 font-bold break-all">
                      {formatKodeNota(n)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Foto potongan lain preview */}
        {(trx.potongan_lain || []).some((p) => p.foto_url) && (
          <div className="border-2 border-dashed border-paper-edge p-2">
            <div className="label text-center mb-2">Foto Potongan Lain</div>
            <div className="grid grid-cols-2 gap-2">
              {(trx.potongan_lain || [])
                .filter((p) => p.foto_url)
                .map((p, i) => (
                  <div key={i} className="border border-paper-edge p-1">
                    <ZoomableImg
                      src={p.foto_url!}
                      alt={p.nama}
                      className="w-full h-32 object-cover"
                    />
                    <div className="text-[9px] uppercase tracking-widest text-center mt-1 font-bold truncate">
                      {p.nama || "Potongan"} · Rp {formatRp(p.nominal)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Bukti transfer preview */}
        {trx.bukti_tf_url && (
          <div className="border-2 border-dashed border-paper-edge p-2">
            <div className="label text-center mb-2">Bukti Transfer</div>
            <div className="border border-paper-edge p-1">
              <ZoomableImg
                src={trx.bukti_tf_url}
                alt="Bukti Transfer"
                className="w-full max-h-64 object-contain"
              />
              <div className="text-[10px] uppercase tracking-widest text-center mt-1 font-bold">
                Tanggal Transfer: {formatTanggalLong(trx.tanggal_tf)}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-3">
          <Button
            onClick={handleShare}
            disabled={isSharing}
            className="bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
          >
            {isSharing ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 mr-1" />
            )}
            Bagikan
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            variant="outline"
            className="border-2 rounded-none uppercase tracking-widest text-xs font-bold"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Download
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 pt-1">
          <Button
            onClick={handleSaveDrive}
            disabled={isSavingDrive}
            variant="outline"
            className={`border-2 rounded-none uppercase tracking-widest text-xs font-bold ${trx.drive_file_id ? 'border-success text-success hover:bg-success hover:text-paper' : ''}`}
            title={
              company?.drive_folder_id
                ? `Simpan ke folder: ${company.drive_folder_name || "Drive"}`
                : "Simpan ke Google Drive (root)"
            }
          >
            {isSavingDrive ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Cloud className="w-4 h-4 mr-1" />}
            {trx.drive_file_id ? "Sudah Tersimpan di Drive" : "Simpan ke Drive"}
          </Button>
        </div>
        {trx.status !== "selesai" && (
          <>
            {!trx.bukti_tf_url && (
              <div className="text-[10px] uppercase tracking-widest text-stamp text-center border border-stamp p-2">
                Upload bukti transfer terlebih dahulu untuk menandai selesai
              </div>
            )}
            <Button
              onClick={handleFinalize}
              disabled={!trx.bukti_tf_url}
              className="bg-success text-success-foreground hover:bg-success/90 rounded-none uppercase tracking-widest text-xs font-bold w-full disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              <Check className="w-4 h-4 mr-1" /> Tandai Selesai
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
