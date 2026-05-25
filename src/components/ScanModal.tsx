import { useEffect, useState } from "react";
import type { Item } from "@/lib/nota";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Upload, Loader2, RotateCcw, Sparkles, Trash2, Plus, X } from "lucide-react";
import { type FilterMode, applyFilter, canvasToBlob } from "@/lib/scanProcessing";
import { scanNotaAIWithRaw } from "@/lib/ocr";
import { type ParsedNota } from "@/lib/parseNota";
import { supabase } from "@/integrations/supabase/client";
import { formatRp } from "@/lib/nota";
import { RupiahInput } from "@/components/RupiahInput";
import { DivisiSelect, fetchDivisiList, findDivisiByKode, type Divisi } from "@/components/DivisiSelect";
import { DocumentScanner } from "@/components/DocumentScanner";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (notaId: string) => void;
  existingCustomer?: string | null;
};

export const ScanModal = ({ open, onOpenChange, onSaved, existingCustomer }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [warpedCanvas, setWarpedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("original");
  const [stage, setStage] = useState<"idle" | "scan" | "ocr" | "edit">("idle");
  const [parsed, setParsed] = useState<ParsedNota | null>(null);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [divisi, setDivisi] = useState<{ id: string | null; nama: string | null }>({ id: null, nama: null });
  const [divisiList, setDivisiList] = useState<Divisi[]>([]);
  const [manualPhotoFile, setManualPhotoFile] = useState<File | null>(null);
  const [manualPhotoUrl, setManualPhotoUrl] = useState<string | null>(null);
  // Dialog konfirmasi customer berbeda
  const [customerMismatch, setCustomerMismatch] = useState<{ detected: string } | null>(null);
  const [pendingParsed, setPendingParsed] = useState<any>(null);

  useEffect(() => {
    if (open) fetchDivisiList().then(setDivisiList);
    if (!open) {
      setFile(null);
      setRawFile(null);
      setPreviewUrl(null);
      setWarpedCanvas(null);
      setFilterMode("original");
      setParsed(null);
      setRawText("");
      setStage("idle");
      setDivisi({ id: null, nama: null });
      setManualPhotoFile(null);
      setManualPhotoUrl(null);
      setCustomerMismatch(null);
      setPendingParsed(null);
    }
  }, [open]);

  // Auto match divisi from kode_nota — runs on every kode change
  useEffect(() => {
    if (!parsed?.kode_nota) {
      // kode dikosongkan → reset divisi
      setDivisi({ id: null, nama: null });
      return;
    }
    const hit = findDivisiByKode(divisiList, parsed.kode_nota);
    if (hit) {
      setDivisi({ id: hit.id, nama: hit.nama });
    } else {
      // kode ada tapi tidak match → set sentinel 'not-found'
      setDivisi({ id: "__not_found__", nama: null });
    }
  }, [parsed?.kode_nota, divisiList]);


  const handlePick = (f: File) => {
    setRawFile(f);
    setStage("scan");
  };

  const runOcr = async (
    processed: File,
    _origUrl: string,
    processedUrl: string,
    warped?: HTMLCanvasElement,
  ) => {
    setFile(processed);
    setPreviewUrl(processedUrl);
    if (warped) setWarpedCanvas(warped);
    setStage("ocr");
    try {
      const { parsed: p, raw_text } = await scanNotaAIWithRaw(processed);
      applyParsedWithValidation(p, raw_text);
    } catch (e: any) {
      toast.error("Scan gagal: " + e.message);
      setParsed({
        kode_nota: null,
        no_nota: null,
        full_no: null,
        tanggal: null,
        nama_customer: null,
        total: 0,
        netto: 0,
        diskon_nota: { persen: 0, nominal: 0 },
        items: [],
      });
      setStage("edit");
    }
  };

  // Validasi customer setelah OCR — jika berbeda tampilkan konfirmasi
  const applyParsedWithValidation = (p: any, raw_text: string) => {
    const detectedCustomer = (p.nama_customer || "").trim().toLowerCase();
    const expected = (existingCustomer || "").trim().toLowerCase();
    if (expected && detectedCustomer && detectedCustomer !== expected) {
      setPendingParsed({ parsed: p, raw_text });
      setCustomerMismatch({ detected: p.nama_customer });
    } else {
      setRawText(raw_text);
      setParsed({ ...p, netto: 0 });
      setStage("edit");
    }
  };

  // Ganti filter di edit stage — update preview dan file yang akan disimpan
  const changeFilterInEdit = async (f: FilterMode) => {
    if (!warpedCanvas) return;
    setFilterMode(f);
    const c = applyFilter(warpedCanvas, f);
    const url = c.toDataURL("image/jpeg", 0.95);
    setPreviewUrl(url);
    const blob = await canvasToBlob(c);
    const name = (rawFile?.name ?? "nota").replace(/\.\w+$/, "") + "-scan.jpg";
    setFile(new File([blob], name, { type: "image/jpeg" }));
  };

  const handleManualOnly = () => {
    setParsed({
      kode_nota: null,
      no_nota: null,
      full_no: null,
      tanggal: new Date().toISOString().slice(0, 10),
      // Auto-fill dari customer yang sudah ada di transaksi
      nama_customer: existingCustomer || null,
      total: 0,
      netto: 0,
      diskon_nota: { persen: 0, nominal: 0 },
      items: [],
    });
    setStage("edit");
  };

  const handleSave = async () => {
    if (!parsed) return;
    if (!parsed.netto && !parsed.total) {
      return toast.error("Netto/total tidak boleh kosong. Mohon isi manual.");
    }
    setSaving(true);
    try {
      let file_url: string | null = null;
      // Pakai file dari scan OCR, atau manualPhotoFile jika input manual
      const uploadFile = file || manualPhotoFile;
      if (uploadFile) {
        const path = `${Date.now()}-${uploadFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("nota-images")
          .upload(path, uploadFile, { contentType: uploadFile.type });
        if (!upErr) {
          const { data } = supabase.storage.from("nota-images").getPublicUrl(path);
          file_url = data.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from("notas")
        .insert({
          kode_nota: parsed.kode_nota,
          no_nota: parsed.no_nota,
          full_no: parsed.full_no,
          tanggal: parsed.tanggal,
          nama_customer: parsed.nama_customer,
          total: parsed.total,
          diskon_nota: parsed.diskon_nota as any,
          netto: parsed.netto || parsed.total,
          items: parsed.items as any,
          file_url,
          ocr_text: rawText,
          divisi_id: divisi.id === "__not_found__" ? null : (divisi.id || null),
          divisi_nama: divisi.id === "__not_found__" ? null : (divisi.nama || null),
        })
        .select()
        .single();
      if (error) throw error;
      toast.success("Nota tersimpan");
      onSaved(data.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof ParsedNota>(k: K, v: ParsedNota[K]) => {
    setParsed((p) => (p ? { ...p, [k]: v } : p));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] sm:w-full max-w-2xl paper rounded-none border-2 border-dashed border-paper-edge max-h-[92vh] overflow-y-auto overflow-x-hidden p-3 sm:p-6"
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-center pr-8 sm:pr-0">Scan Nota</DialogTitle>
        </DialogHeader>

        {stage === "idle" && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-paper-edge p-8 text-center">
              <Sparkles className="w-10 h-10 mx-auto text-ink mb-3" />
              <div className="uppercase tracking-widest text-xs font-bold mb-1">
                AI Vision Scan
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Foto nota — AI akan mengekstrak data otomatis
              </p>
              {existingCustomer && (
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 border border-dashed border-paper-edge px-3 py-1">
                  Customer: <span className="font-bold text-ink">{existingCustomer}</span>
                </div>
              )}
              <div className="flex gap-2 justify-center flex-wrap">
                {/* Kamera — label+input native, tidak pakai programmatic .click() */}
                <label
                  htmlFor="scan-camera-input"
                  className="inline-flex items-center gap-2 cursor-pointer bg-ink text-paper hover:bg-ink/90 rounded-none uppercase text-xs tracking-widest font-bold px-4 py-2"
                >
                  <Camera className="w-4 h-4" /> Kamera
                  <input
                    id="scan-camera-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0])}
                  />
                </label>

                {/* Upload — sama, label+input native */}
                <label
                  htmlFor="scan-file-input"
                  className="inline-flex items-center gap-2 cursor-pointer border-2 border-ink rounded-none uppercase text-xs tracking-widest font-bold px-4 py-2 bg-paper hover:bg-ink hover:text-paper transition-colors"
                >
                  <Upload className="w-4 h-4" /> Upload
                  <input
                    id="scan-file-input"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0])}
                  />
                </label>
              </div>
              <button
                onClick={handleManualOnly}
                className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-ink"
              >
                · Input manual saja ·
              </button>
            </div>
          </div>
        )}

        {/* Dialog konfirmasi customer berbeda */}
        {customerMismatch && (
          <div className="border-2 border-destructive p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-destructive">⚠ Nama Customer Berbeda</div>
            <p className="text-xs">
              Nota ini atas nama <span className="font-bold">{customerMismatch.detected}</span>, sedangkan transaksi ini untuk customer{" "}
              <span className="font-bold">{existingCustomer}</span>.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-2 border-destructive text-destructive rounded-none text-xs font-bold uppercase tracking-widest flex-1"
                onClick={() => {
                  setCustomerMismatch(null);
                  setPendingParsed(null);
                  setStage("idle");
                }}
              >
                Batalkan
              </Button>
              <Button
                className="bg-ink text-paper rounded-none text-xs font-bold uppercase tracking-widest flex-1"
                onClick={() => {
                  if (pendingParsed) {
                    setRawText(pendingParsed.raw_text);
                    setParsed({ ...pendingParsed.parsed, netto: 0 });
                    setStage("edit");
                  }
                  setCustomerMismatch(null);
                  setPendingParsed(null);
                }}
              >
                Tetap Simpan
              </Button>
            </div>
          </div>
        )}

        {stage === "scan" && rawFile && (
          <DocumentScanner
            file={rawFile}
            onCancel={() => {
              setRawFile(null);
              setStage("idle");
            }}
            onDone={runOcr}
          />
        )}

        {stage === "ocr" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 mx-auto text-ink animate-spin mb-3" />
            <div className="uppercase tracking-widest text-sm font-bold mb-2">
              AI Membaca Nota...
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              Gemini Vision sedang mengekstrak data
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="preview"
                className="mt-4 max-h-40 mx-auto border-2 border-paper-edge"
              />
            )}
          </div>
        )}

        {stage === "edit" && parsed && (
          <div className="space-y-2 sm:space-y-3 text-sm">
            {previewUrl && (
              <div className="border-2 border-paper-edge">
                {/* Tombol filter — hanya muncul jika ada warpedCanvas */}
                {warpedCanvas && (
                  <div className="flex border-b border-dashed border-paper-edge">
                    {(["original", "grayscale"] as FilterMode[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => changeFilterInEdit(f)}
                        className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest font-bold transition-all ${
                          filterMode === f
                            ? "bg-ink text-paper"
                            : "bg-paper hover:bg-ink/10"
                        }`}
                      >
                        {f === "original" ? "Original" : "Grayscale"}
                      </button>
                    ))}
                  </div>
                )}
                <details>
                  <summary className="px-3 py-2 cursor-pointer uppercase text-xs tracking-widest font-bold">
                    Lihat foto nota
                  </summary>
                  <img src={previewUrl} alt="nota" className="w-full" />
                </details>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4">
              <div>
                <Label className="label">Kode</Label>
                <Input
                  value={parsed.kode_nota || ""}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    setParsed((p) =>
                      p
                        ? {
                            ...p,
                            kode_nota: v || null,
                            full_no: v && p.no_nota ? `${v}-${p.no_nota}` : null,
                          }
                        : p,
                    );
                  }}
                  className="rounded-none border-2 border-paper-edge bg-paper uppercase h-8 text-xs sm:h-10 sm:text-sm"
                />
              </div>
              <div>
                <Label className="label">No</Label>
                <Input
                  value={parsed.no_nota || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setParsed((p) =>
                      p
                        ? {
                            ...p,
                            no_nota: v || null,
                            full_no: p.kode_nota && v ? `${p.kode_nota}-${v}` : null,
                          }
                        : p,
                    );
                  }}
                  className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs sm:h-10 sm:text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="label">Customer</Label>
              <Input
                value={parsed.nama_customer || ""}
                onChange={(e) => updateField("nama_customer", e.target.value)}
                className="rounded-none border-2 border-paper-edge bg-paper uppercase h-8 text-xs sm:h-10 sm:text-sm"
              />
            </div>
            {/* Divisi */}
            <div>
              <DivisiSelect 
                value={divisi} 
                onChange={setDivisi} 
                disabled={!!parsed?.kode_nota} 
              />
              <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">
                {divisi.id === "__not_found__"
                  ? "⚠ Kode tidak cocok dengan divisi manapun"
                  : divisi.id && parsed?.kode_nota
                  ? "✓ Otomatis dari kode nota"
                  : "Input kode nota untuk mengisi otomatis"}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-4">
              <div>
                <Label className="label">Tanggal</Label>
                <Input
                  type="date"
                  value={parsed.tanggal || ""}
                  onChange={(e) => updateField("tanggal", e.target.value || null)}
                  className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs sm:h-10 sm:text-sm"
                />
              </div>
              <div>
                <Label className="label">Total</Label>
                <RupiahInput
                  value={parsed.total || 0}
                  onChange={(n) => {
                    const dn = parsed.diskon_nota;
                    const a1 = n - n * ((Number(dn.persen) || 0) / 100);
                    const a2 = a1 - a1 * ((Number(dn.persen2) || 0) / 100);
                    const a3 = a2 - a2 * ((Number(dn.persen3) || 0) / 100);
                    setParsed((p) => (p ? { ...p, total: n, netto: Math.max(0, a3) } : p));
                  }}
                  className="h-8 text-xs sm:h-10 sm:text-sm"
                />
              </div>
            </div>
            {(() => {
              const total = parsed.total || 0;
              const dn = parsed.diskon_nota;
              const p1 = Number(dn.persen) || 0;
              const p2 = Number(dn.persen2) || 0;
              const p3 = Number(dn.persen3) || 0;
              const d1n = total * (p1 / 100);
              const after1 = total - d1n;
              const d2n = after1 * (p2 / 100);
              const after2 = after1 - d2n;
              const d3n = after2 * (p3 / 100);
              const after3 = after2 - d3n;
              const nominal = Number(dn.nominal) || 0;
              const netto = Math.max(0, after3 - nominal);

              const setPersen = (key: "persen" | "persen2" | "persen3", v: number) => {
                const next = { ...dn, [key]: v };
                const np1 = Number(next.persen) || 0;
                const np2 = Number(next.persen2) || 0;
                const np3 = Number(next.persen3) || 0;
                const a1 = total - total * (np1 / 100);
                const a2 = a1 - a1 * (np2 / 100);
                const a3 = a2 - a2 * (np3 / 100);
                const newNetto = Math.max(0, a3);
                setParsed((p) => (p ? { ...p, diskon_nota: next, netto: newNetto } : p));
              };

              const rows: { label: string; key: "persen" | "persen2" | "persen3"; p: number; nom: number }[] = [
                { label: "Disc 1", key: "persen", p: p1, nom: d1n },
                { label: "Disc 2", key: "persen2", p: p2, nom: d2n },
                { label: "Disc 3", key: "persen3", p: p3, nom: d3n },
              ];

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 border-2 border-dashed border-paper-edge p-2 bg-ink/5">
                  {rows.map((r) => (
                    <div key={r.key} className="grid grid-cols-[1fr,1.4fr] gap-2 items-end">
                      <div>
                        <Label className="label">{r.label} %</Label>
                        <Input
                          type="number"
                          min={0}
                          value={r.p || ""}
                          placeholder="0"
                          onChange={(e) => setPersen(r.key, Math.max(0, Number(e.target.value)))}
                          className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs sm:h-10 sm:text-sm"
                        />
                      </div>
                      <div>
                        <Label className="label">{r.label} Rp</Label>
                        <RupiahInput value={Math.round(r.nom)} onChange={() => {}} disabled className="h-8 text-xs sm:h-10 sm:text-sm" />
                      </div>
                    </div>
                  ))}
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-right pt-1">
                    Sisa setelah disc: Rp {formatRp(after3)}
                  </div>
                </div>
              );
            })()}
            <div>
              <Label className="label">Netto (Yang Dibayar)</Label>
              <RupiahInput
                value={Math.round(
                  (() => {
                    const total = parsed.total || 0;
                    const dn = parsed.diskon_nota;
                    const a1 = total - total * ((Number(dn.persen) || 0) / 100);
                    const a2 = a1 - a1 * ((Number(dn.persen2) || 0) / 100);
                    const a3 = a2 - a2 * ((Number(dn.persen3) || 0) / 100);
                    return Math.max(0, a3);
                  })()
                )}
                onChange={() => {}}
                disabled
                className="text-lg h-11"
              />
              <div className="text-[10px] text-muted-foreground mt-1 text-right uppercase tracking-widest">
                Auto · Sisa setelah Disc 1 + 2 + 3
              </div>
            </div>
            {/* ─── Item Editor ─── */}
            <div className="border-2 border-paper-edge">
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <span className="label">
                  {parsed.items.length > 0 ? `${parsed.items.length} item` : "Item"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateField("items", [
                      ...parsed.items,
                      { kode: "", nama: "", qty: 1, satuan: "PCS", harga: 0, subtotal: 0 } satisfies Item,
                    ])
                  }
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold border-2 border-ink px-2 py-1 hover:bg-ink hover:text-paper transition-colors"
                >
                  <Plus className="w-3 h-3" /> Tambah
                </button>
              </div>

              {parsed.items.length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-3 uppercase tracking-widest">
                  Belum ada item · klik Tambah
                </div>
              )}

              {parsed.items.map((it, i) => {
                const updateItem = (patch: Partial<Item>) => {
                  const next = parsed.items.map((x, idx) => {
                    if (idx !== i) return x;
                    const merged = { ...x, ...patch };
                    // auto-hitung subtotal jika qty atau harga berubah
                    if ("qty" in patch || "harga" in patch) {
                      merged.subtotal = merged.qty * merged.harga;
                    }
                    return merged;
                  });
                  updateField("items", next);
                };
                const removeItem = () =>
                  updateField("items", parsed.items.filter((_, idx) => idx !== i));

                return (
                  <div
                    key={i}
                    className="border-t border-dashed border-paper-edge p-2 space-y-1"
                  >
                    {/* Row 1: kode + nama */}
                    <div className="grid grid-cols-[80px,1fr] gap-1">
                      <div>
                        <span className="label text-[9px]">Kode</span>
                        <Input
                          value={it.kode || ""}
                          onChange={(e) => updateItem({ kode: e.target.value.toUpperCase() })}
                          placeholder="Kode"
                          className="rounded-none border-2 border-paper-edge bg-paper uppercase text-xs h-7 px-1"
                        />
                      </div>
                      <div>
                        <span className="label text-[9px]">Nama Barang</span>
                        <Input
                          value={it.nama}
                          onChange={(e) => updateItem({ nama: e.target.value })}
                          placeholder="Nama barang"
                          className="rounded-none border-2 border-paper-edge bg-paper text-xs h-7 px-1"
                        />
                      </div>
                    </div>

                    {/* Row 2: qty + satuan + harga + subtotal + hapus */}
                    <div className="grid grid-cols-[60px,52px,1fr,1fr,28px] gap-1 items-end">
                      <div>
                        <span className="label text-[9px]">Qty</span>
                        <Input
                          type="number"
                          min={0}
                          value={it.qty || ""}
                          placeholder="0"
                          onChange={(e) => updateItem({ qty: Math.max(0, Number(e.target.value)) })}
                          className="rounded-none border-2 border-paper-edge bg-paper text-xs h-7 px-1"
                        />
                      </div>
                      <div>
                        <span className="label text-[9px]">Sat.</span>
                        <Input
                          value={it.satuan || ""}
                          onChange={(e) => updateItem({ satuan: e.target.value.toUpperCase() })}
                          placeholder="PCS"
                          className="rounded-none border-2 border-paper-edge bg-paper uppercase text-xs h-7 px-1"
                        />
                      </div>
                      <div>
                        <span className="label text-[9px]">Harga</span>
                        <RupiahInput
                          value={it.harga}
                          onChange={(v) => updateItem({ harga: v })}
                          className="text-xs h-7"
                        />
                      </div>
                      <div>
                        <span className="label text-[9px]">Subtotal</span>
                        <RupiahInput
                          value={it.subtotal}
                          onChange={(v) => updateItem({ subtotal: v })}
                          className="text-xs h-7"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeItem}
                        className="h-7 w-7 flex items-center justify-center border-2 border-paper-edge hover:border-red-500 hover:text-red-500 transition-colors"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Upload foto opsional - hanya muncul saat input manual (tidak ada previewUrl) */}
            {!previewUrl && (
              <div>
                <div className="label mb-1">Foto Nota (Opsional)</div>
                {manualPhotoUrl ? (
                  <div className="relative border-2 border-paper-edge p-1">
                    <img src={manualPhotoUrl} alt="Foto nota" className="w-full max-h-40 object-contain" />
                    <button
                      type="button"
                      onClick={() => { setManualPhotoFile(null); setManualPhotoUrl(null); }}
                      className="absolute top-1 right-1 bg-paper border border-ink p-1 hover:bg-destructive hover:text-paper"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="w-full border-2 border-dashed border-paper-edge p-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-ink hover:text-ink cursor-pointer">
                    <Camera className="w-4 h-4" />
                    <span>Upload / Foto Nota</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setManualPhotoFile(f);
                          setManualPhotoUrl(URL.createObjectURL(f));
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStage("idle")}
                className="border-2 rounded-none uppercase tracking-widest text-xs font-bold"
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Ulang
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Simpan Nota
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
