import { useEffect, useState } from "react";
import type { Item, Nota } from "@/lib/nota";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRp } from "@/lib/nota";
import { RupiahInput } from "@/components/RupiahInput";
import { DivisiSelect, fetchDivisiList, type Divisi } from "@/components/DivisiSelect";
import { toast } from "sonner";

type EditForm = {
  kode_nota: string | null;
  no_nota: string | null;
  full_no: string | null;
  tanggal: string | null;
  nama_customer: string | null;
  total: number;
  netto: number;
  diskon_nota: {
    persen: number;
    nominal: number;
    persen2?: number;
    persen3?: number;
  };
  items: Item[];
};

type Props = {
  nota: Nota | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
};

export const EditNotaModal = ({ nota, open, onOpenChange, onSaved }: Props) => {
  const [form, setForm] = useState<EditForm | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [divisi, setDivisi] = useState<{ id: string | null; nama: string | null }>({
    id: null,
    nama: null,
  });
  const [divisiList, setDivisiList] = useState<Divisi[]>([]);

  // Init form from nota prop
  useEffect(() => {
    if (open && nota) {
      setForm({
        kode_nota: nota.kode_nota,
        no_nota: nota.no_nota,
        full_no: nota.full_no,
        tanggal: nota.tanggal,
        nama_customer: nota.nama_customer,
        total: nota.total,
        netto: nota.netto,
        diskon_nota: {
          persen: nota.diskon_nota?.persen ?? 0,
          nominal: nota.diskon_nota?.nominal ?? 0,
          persen2: (nota.diskon_nota as any)?.persen2 ?? 0,
          persen3: (nota.diskon_nota as any)?.persen3 ?? 0,
        },
        items: nota.items ?? [],
      });
      setPreviewUrl(nota.file_url ?? null);
      setDivisi({ id: nota.divisi_id ?? null, nama: nota.divisi_nama ?? null });
      setNewFile(null);
      fetchDivisiList().then(setDivisiList);
    }
    if (!open) {
      setForm(null);
      setPreviewUrl(null);
      setNewFile(null);
    }
  }, [open, nota]);

  // Auto match divisi from kode_nota
  useEffect(() => {
    if (!form?.kode_nota || divisi.id) return;
    const hit = findDivisiByKode(divisiList, form.kode_nota);
    if (hit) setDivisi({ id: hit.id, nama: hit.nama });
  }, [form?.kode_nota, divisiList]);

  const updateField = <K extends keyof EditForm>(k: K, v: EditForm[K]) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  };

  const handleNewPhoto = (file: File) => {
    setNewFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSave = async () => {
    if (!nota || !form) return;
    if (!form.netto && !form.total) {
      return toast.error("Netto/total tidak boleh kosong.");
    }
    setSaving(true);
    try {
      let file_url = nota.file_url;

      // Upload foto baru jika ada
      if (newFile) {
        const path = `${Date.now()}-${newFile.name.replace(/[^\w.-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("nota-images")
          .upload(path, newFile, { contentType: newFile.type });
        if (!upErr) {
          const { data } = supabase.storage.from("nota-images").getPublicUrl(path);
          file_url = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from("notas")
        .update({
          kode_nota: form.kode_nota,
          no_nota: form.no_nota,
          full_no: form.full_no,
          tanggal: form.tanggal,
          nama_customer: form.nama_customer,
          total: form.total,
          diskon_nota: form.diskon_nota as any,
          netto: form.netto || form.total,
          items: form.items as any,
          file_url,
          divisi_id: divisi.id,
          divisi_nama: divisi.nama,
        })
        .eq("id", nota.id);

      if (error) throw error;
      toast.success("Nota berhasil diperbarui");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return null;

  // Hitung diskon berlapis
  const total = form.total || 0;
  const dn = form.diskon_nota;
  const p1 = Number(dn.persen) || 0;
  const p2 = Number(dn.persen2) || 0;
  const p3 = Number(dn.persen3) || 0;
  const d1n = total * (p1 / 100);
  const after1 = total - d1n;
  const d2n = after1 * (p2 / 100);
  const after2 = after1 - d2n;
  const d3n = after2 * (p3 / 100);
  const after3 = after2 - d3n;
  const nettoCalc = Math.max(0, after3);

  const setPersen = (key: "persen" | "persen2" | "persen3", v: number) => {
    const next = { ...dn, [key]: v };
    const np1 = Number(next.persen) || 0;
    const np2 = Number(next.persen2) || 0;
    const np3 = Number(next.persen3) || 0;
    const a1 = total - total * (np1 / 100);
    const a2 = a1 - a1 * (np2 / 100);
    const a3 = a2 - a2 * (np3 / 100);
    setForm((f) =>
      f ? { ...f, diskon_nota: next, netto: Math.max(0, a3) } : f
    );
  };

  const rows: { label: string; key: "persen" | "persen2" | "persen3"; p: number; nom: number }[] = [
    { label: "Disc 1", key: "persen", p: p1, nom: d1n },
    { label: "Disc 2", key: "persen2", p: p2, nom: d2n },
    { label: "Disc 3", key: "persen3", p: p3, nom: d3n },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg paper rounded-none border-2 border-dashed border-paper-edge max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-center">Edit Nota</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Preview foto */}
          {previewUrl && (
            <div className="border-2 border-paper-edge">
              <details>
                <summary className="px-3 py-2 cursor-pointer uppercase text-xs tracking-widest font-bold">
                  Lihat foto nota
                </summary>
                <img src={previewUrl} alt="nota" className="w-full" />
              </details>
            </div>
          )}

          {/* Ganti foto */}
          <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-paper-edge px-3 py-2 hover:border-ink text-xs uppercase tracking-widest text-muted-foreground hover:text-ink transition-colors">
            <Upload className="w-4 h-4 shrink-0" />
            {newFile ? newFile.name : previewUrl ? "Ganti Foto Nota" : "Upload Foto Nota"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleNewPhoto(f);
                e.target.value = "";
              }}
            />
          </label>

          {/* Kode & No */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="label">Kode</Label>
              <Input
                value={form.kode_nota || ""}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          kode_nota: v || null,
                          full_no: v && f.no_nota ? `${v}-${f.no_nota}` : null,
                        }
                      : f
                  );
                }}
                className="rounded-none border-2 border-paper-edge bg-paper uppercase"
              />
            </div>
            <div>
              <Label className="label">No</Label>
              <Input
                value={form.no_nota || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          no_nota: v || null,
                          full_no: f.kode_nota && v ? `${f.kode_nota}-${v}` : null,
                        }
                      : f
                  );
                }}
                className="rounded-none border-2 border-paper-edge bg-paper"
              />
            </div>
          </div>

          {/* Customer */}
          <div>
            <Label className="label">Customer</Label>
            <Input
              value={form.nama_customer || ""}
              onChange={(e) => updateField("nama_customer", e.target.value)}
              className="rounded-none border-2 border-paper-edge bg-paper uppercase"
            />
          </div>

          {/* Divisi */}
          <DivisiSelect 
            value={divisi} 
            onChange={setDivisi} 
            disabled={!!findDivisiByKode(divisiList, form.kode_nota)} 
          />

          {/* Tanggal & Total */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="label">Tanggal</Label>
              <Input
                type="date"
                value={form.tanggal || ""}
                onChange={(e) => updateField("tanggal", e.target.value || null)}
                className="rounded-none border-2 border-paper-edge bg-paper"
              />
            </div>
            <div>
              <Label className="label">Total</Label>
              <RupiahInput
                value={form.total || 0}
                onChange={(n) => {
                  const a1 = n - n * ((Number(dn.persen) || 0) / 100);
                  const a2 = a1 - a1 * ((Number(dn.persen2) || 0) / 100);
                  const a3 = a2 - a2 * ((Number(dn.persen3) || 0) / 100);
                  setForm((f) => (f ? { ...f, total: n, netto: Math.max(0, a3) } : f));
                }}
              />
            </div>
          </div>

          {/* Diskon berlapis */}
          <div className="space-y-2 border-2 border-dashed border-paper-edge p-2">
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
                    className="rounded-none border-2 border-paper-edge bg-paper"
                  />
                </div>
                <div>
                  <Label className="label">{r.label} Rp</Label>
                  <RupiahInput value={Math.round(r.nom)} onChange={() => {}} disabled />
                </div>
              </div>
            ))}
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-right pt-1">
              Sisa setelah disc: Rp {formatRp(after3)}
            </div>
          </div>

          {/* Netto */}
          <div>
            <Label className="label">Netto (Yang Dibayar)</Label>
            <RupiahInput
              value={Math.round(nettoCalc)}
              onChange={() => {}}
              disabled
              className="text-lg h-11"
            />
            <div className="text-[10px] text-muted-foreground mt-1 text-right uppercase tracking-widest">
              Auto · Sisa setelah Disc 1 + 2 + 3
            </div>
          </div>

          {/* Item Editor */}
          <div className="border-2 border-paper-edge">
            <div className="flex items-center justify-between px-2 pt-2 pb-1">
              <span className="label">
                {form.items.length > 0 ? `${form.items.length} item` : "Item"}
              </span>
              <button
                type="button"
                onClick={() =>
                  updateField("items", [
                    ...form.items,
                    { kode: "", nama: "", qty: 1, satuan: "PCS", harga: 0, subtotal: 0 } satisfies Item,
                  ])
                }
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold border-2 border-ink px-2 py-1 hover:bg-ink hover:text-paper transition-colors"
              >
                <Plus className="w-3 h-3" /> Tambah
              </button>
            </div>

            {form.items.length === 0 && (
              <div className="text-[10px] text-muted-foreground text-center py-3 uppercase tracking-widest">
                Belum ada item · klik Tambah
              </div>
            )}

            {form.items.map((it, i) => {
              const updateItem = (patch: Partial<Item>) => {
                const next = form.items.map((x, idx) => {
                  if (idx !== i) return x;
                  const merged = { ...x, ...patch };
                  if ("qty" in patch || "harga" in patch) {
                    merged.subtotal = merged.qty * merged.harga;
                  }
                  return merged;
                });
                updateField("items", next);
              };
              const removeItem = () =>
                updateField("items", form.items.filter((_, idx) => idx !== i));

              return (
                <div key={i} className="border-t border-dashed border-paper-edge p-2 space-y-1">
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

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-2 rounded-none uppercase tracking-widest text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
