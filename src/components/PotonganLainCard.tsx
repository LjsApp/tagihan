import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { RupiahInput } from "@/components/RupiahInput";
import { Plus, X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ZoomableImg } from "@/components/ImageLightbox";
import type { PotonganLain } from "@/lib/nota";

export const PotonganLainCard = ({
  items,
  onChange,
}: {
  items: PotonganLain[];
  onChange: (next: PotonganLain[]) => void;
}) => {
  const add = () => onChange([...(items || []), { nama: "", nominal: 0, foto_url: null }]);
  const remove = (i: number) => onChange(items.filter((_, x) => x !== i));
  const edit = (i: number, patch: Partial<PotonganLain>) =>
    onChange(items.map((p, x) => (x === i ? { ...p, ...patch } : p)));

  const uploadFoto = async (i: number, file: File) => {
    try {
      const path = `potongan/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("nota-images")
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("nota-images").getPublicUrl(path);
      edit(i, { foto_url: data.publicUrl });
      toast.success("Foto terupload");
    } catch (e: any) {
      toast.error("Upload gagal: " + e.message);
    }
  };

  return (
    <div className="paper p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="label">Potongan Lain</div>
        <button
          onClick={add}
          className="text-[10px] uppercase tracking-widest font-bold text-ink hover:text-stamp flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Tambah
        </button>
      </div>
      {(!items || items.length === 0) ? (
        <p className="text-xs text-muted-foreground italic">Belum ada potongan lain</p>
      ) : (
        <div className="space-y-3">
          {items.map((p, i) => (
            <PotonganRow
              key={i}
              p={p}
              onEdit={(patch) => edit(i, patch)}
              onRemove={() => remove(i)}
              onUpload={(f) => uploadFoto(i, f)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PotonganRow = ({
  p,
  onEdit,
  onRemove,
  onUpload,
}: {
  p: PotonganLain;
  onEdit: (patch: Partial<PotonganLain>) => void;
  onRemove: () => void;
  onUpload: (f: File) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="border border-dashed border-paper-edge p-2 space-y-2">
      <div className="flex gap-1 items-center">
        <Input
          value={p.nama}
          onChange={(e) => onEdit({ nama: e.target.value })}
          placeholder="Nama potongan"
          className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs flex-1"
        />
        <RupiahInput
          value={Number(p.nominal) || 0}
          onChange={(n) => onEdit({ nominal: n })}
          className="h-8 text-sm w-32"
        />
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2 items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="text-[10px] uppercase tracking-widest font-bold border-2 border-paper-edge px-2 py-1 hover:border-ink flex items-center gap-1"
        >
          <ImagePlus className="w-3 h-3" />
          {p.foto_url ? "Ganti foto" : "Upload foto"}
        </button>
        {p.foto_url && (
          <>
            <ZoomableImg
              src={p.foto_url}
              alt="potongan"
              className="h-12 w-12 object-cover border border-paper-edge"
            />
            <button
              onClick={() => onEdit({ foto_url: null })}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              Hapus
            </button>
          </>
        )}
      </div>
    </div>
  );
};
