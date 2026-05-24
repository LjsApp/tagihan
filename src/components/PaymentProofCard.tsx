import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ZoomableImg } from "@/components/ImageLightbox";

export const PaymentProofCard = ({
  trxId,
  buktiUrl,
  tanggalTf,
  onUpdate,
}: {
  trxId: string;
  buktiUrl: string | null;
  tanggalTf: string | null;
  onUpdate: (patch: { bukti_tf_url?: string | null; tanggal_tf?: string | null }) => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `bukti-tf/${trxId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("nota-images").upload(path, file, {
        upsert: true,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("nota-images").getPublicUrl(path);
      const url = pub.publicUrl;
      const today = tanggalTf || new Date().toISOString().slice(0, 10);
      const { error: uErr } = await supabase
        .from("transactions")
        .update({ bukti_tf_url: url, tanggal_tf: today, updated_at: new Date().toISOString() })
        .eq("id", trxId);
      if (uErr) throw uErr;
      onUpdate({ bukti_tf_url: url, tanggal_tf: today });
      toast.success("Bukti transfer diunggah");
    } catch (e: any) {
      toast.error(e.message || "Gagal mengunggah");
    } finally {
      setUploading(false);
    }
  };

  const handleDateChange = async (val: string) => {
    onUpdate({ tanggal_tf: val || null });
    await supabase
      .from("transactions")
      .update({ tanggal_tf: val || null, updated_at: new Date().toISOString() })
      .eq("id", trxId);
  };

  const handleRemove = async () => {
    if (!confirm("Hapus bukti transfer?")) return;
    onUpdate({ bukti_tf_url: null, tanggal_tf: null });
    await supabase
      .from("transactions")
      .update({ bukti_tf_url: null, tanggal_tf: null, updated_at: new Date().toISOString() })
      .eq("id", trxId);
  };

  return (
    <div className="paper p-4">
      <div className="label mb-2">Bukti Transfer</div>

      {buktiUrl ? (
        <div className="space-y-2">
          <div className="border-2 border-paper-edge p-1 relative">
            <ZoomableImg src={buktiUrl} alt="Bukti TF" className="w-full max-h-56 object-contain" />
            <button
              onClick={handleRemove}
              className="absolute top-1 right-1 bg-paper border border-ink p-1 hover:bg-destructive hover:text-paper"
              title="Hapus"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Tanggal Transfer
            </label>
            <Input
              type="date"
              value={tanggalTf || ""}
              onChange={(e) => handleDateChange(e.target.value)}
              className="rounded-none border-2 border-paper-edge bg-paper h-9"
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-paper-edge p-6 flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:border-ink hover:text-ink"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <ImageIcon className="w-6 h-6" />
          )}
          <span className="flex items-center gap-1">
            <Upload className="w-3 h-3" /> Upload Bukti TF
          </span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
};
