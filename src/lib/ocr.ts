// AI-powered OCR + parsing via Supabase Edge Function (Lovable AI Gemini Vision).
import { supabase } from "@/integrations/supabase/client";
import type { ParsedNota } from "@/lib/parseNota";

const fileToBase64 = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:...;base64,"
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const scanNotaAI = async (file: File | Blob): Promise<ParsedNota> => {
  const imageBase64 = await fileToBase64(file);
  const mimeType = (file as File).type || "image/jpeg";

  const { data, error } = await supabase.functions.invoke("scan-nota", {
    body: { imageBase64, mimeType },
  });

  if (error) {
    throw new Error(error.message || "Gagal memproses nota");
  }
  if ((data as any)?.error) {
    throw new Error((data as any).error);
  }

  const p = data as ParsedNota & { raw_text?: string };
  return {
    kode_nota: p.kode_nota ?? null,
    no_nota: p.no_nota ?? null,
    full_no: p.full_no ?? null,
    tanggal: p.tanggal ?? null,
    nama_customer: p.nama_customer ?? null,
    total: Number(p.total) || 0,
    netto: Number(p.netto) || 0,
    diskon_nota: {
      persen: Number(p.diskon_nota?.persen) || 0,
      nominal: Number(p.diskon_nota?.nominal) || 0,
    },
    items: (p.items || []).map((it: any) => ({
      kode: it.kode || undefined,
      nama: it.nama || "",
      qty: Number(it.qty) || 0,
      satuan: it.satuan || undefined,
      harga: Number(it.harga) || 0,
      subtotal: Number(it.subtotal) || 0,
    })),
  };
};

// Expose raw text too for backup storage
export const scanNotaAIWithRaw = async (
  file: File | Blob,
): Promise<{ parsed: ParsedNota; raw_text: string }> => {
  const imageBase64 = await fileToBase64(file);
  const mimeType = (file as File).type || "image/jpeg";

  const { data, error } = await supabase.functions.invoke("scan-nota", {
    body: { imageBase64, mimeType },
  });
  if (error) throw new Error(error.message || "Gagal memproses nota");
  if ((data as any)?.error) throw new Error((data as any).error);

  const p = data as any;
  const parsed: ParsedNota = {
    kode_nota: p.kode_nota ?? null,
    no_nota: p.no_nota ?? null,
    full_no: p.full_no ?? null,
    tanggal: p.tanggal ?? null,
    nama_customer: p.nama_customer ?? null,
    total: Number(p.total) || 0,
    netto: Number(p.netto) || 0,
    diskon_nota: {
      persen: Number(p.diskon_nota?.persen) || 0,
      nominal: Number(p.diskon_nota?.nominal) || 0,
    },
    items: (p.items || []).map((it: any) => ({
      kode: it.kode || undefined,
      nama: it.nama || "",
      qty: Number(it.qty) || 0,
      satuan: it.satuan || undefined,
      harga: Number(it.harga) || 0,
      subtotal: Number(it.subtotal) || 0,
    })),
  };
  return { parsed, raw_text: p.raw_text || "" };
};
