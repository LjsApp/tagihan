import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRp, formatTanggal, type Nota } from "@/lib/nota";

export const NotaDetailModal = ({
  nota,
  open,
  onOpenChange,
}: {
  nota: Nota | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  if (!nota) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md paper rounded-none border-2 border-dashed border-paper-edge max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-center">
            {nota.full_no || "Detail Nota"}
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm space-y-3">
          <div className="text-center text-xs uppercase tracking-widest text-muted-foreground">
            {formatTanggal(nota.tanggal)} · {nota.nama_customer || "-"}
          </div>
          <div className="divider-dashed" />
          {nota.items.length > 0 ? (
            <div className="space-y-2">
              {nota.items.map((it, i) => (
                <div key={i} className="text-xs">
                  <div className="font-bold uppercase">{it.kode} {it.nama}</div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {it.qty} {it.satuan || "BJ"} × Rp {formatRp(it.harga)}
                    </span>
                    <span className="num text-foreground">Rp {formatRp(it.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic text-center py-3">
              Tidak ada item terbaca
            </div>
          )}
          <div className="divider-dashed" />
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="num">Rp {formatRp(nota.total)}</span>
            </div>
            {nota.diskon_nota.nominal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Disc {nota.diskon_nota.persen}%</span>
                <span className="num">- Rp {formatRp(nota.diskon_nota.nominal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base pt-2 border-t-2 border-dashed border-paper-edge">
              <span className="font-bold uppercase">Netto</span>
              <span className="num">Rp {formatRp(nota.netto)}</span>
            </div>
          </div>
          {nota.file_url && (
            <details className="border-2 border-paper-edge">
              <summary className="px-3 py-2 cursor-pointer uppercase text-xs tracking-widest font-bold">
                Foto nota asli
              </summary>
              <img src={nota.file_url} alt="nota" className="w-full" />
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
