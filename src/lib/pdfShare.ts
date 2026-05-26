import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const pdfToBlob = (doc: jsPDF): Blob => doc.output("blob");

export const pdfToFile = (doc: jsPDF, filename: string): File => {
  const blob = pdfToBlob(doc);
  return new File([blob], filename, { type: "application/pdf" });
};

/**
 * Bagikan PDF via Web Share API (native picker di mobile).
 * Fallback: buka di tab baru kalau tidak didukung.
 */
export const sharePDF = async (doc: jsPDF, filename: string, title?: string) => {
  const file = pdfToFile(doc, filename);
  const nav = navigator as any;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: title || filename,
        text: title || filename,
      });
      return { shared: true };
    } catch (e: any) {
      if (e?.name === "AbortError") return { shared: false, aborted: true };
      console.warn("Share gagal, fallback download:", e);
    }
  }
  // Fallback: trigger download
  const url = URL.createObjectURL(pdfToBlob(doc));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false, downloaded: true };
};

/**
 * Upload PDF blob ke Google Drive via edge function.
 * folderId optional (pakai My Drive root jika kosong).
 */
export const uploadPDFToDrive = async (
  doc: jsPDF,
  filename: string,
  folderId?: string | null,
): Promise<{ id: string; webViewLink?: string } | null> => {
  try {
    const blob = pdfToBlob(doc);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const s = reader.result as string;
        resolve(s.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { data, error } = await supabase.functions.invoke("drive-upload", {
      body: {
        filename,
        mimeType: "application/pdf",
        base64,
        folderId: folderId || null,
      },
    });
    if (error) throw error;
    if (!data?.id) throw new Error("Upload gagal");
    toast.success("Tersimpan ke Google Drive");
    return data;
  } catch (e: any) {
    toast.error("Gagal upload Drive: " + (e?.message || "unknown"));
    return null;
  }
};

/**
 * Upload PDF ke Google Drive dengan struktur otomatis:
 * [rootFolderId dari Supabase Secret] / Customers / {customerName} / {year} / filename.pdf
 * Menggunakan Google Apps Script sebagai perantara agar berjalan di akun Drive pengguna.
 */
export const uploadPDFToDriveStructured = async (
  doc: jsPDF,
  filename: string,
  customerName: string,
  year: string | number,
  baseFolderId?: string | null,
): Promise<{ id: string; webViewLink?: string } | null> => {
  try {
    toast.loading("Mengupload ke Google Drive...", { id: "drive-upload" });

    const blob = pdfToBlob(doc);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const s = reader.result as string;
        resolve(s.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const folderNames = ["Customers", customerName.toUpperCase(), String(year)];

    // Satu request ke edge function, yang akan proxy ke Apps Script
    const { data, error } = await supabase.functions.invoke("drive-upload", {
      body: {
        filename,
        base64,
        folderNames,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.id) throw new Error("Upload gagal, ID file tidak diterima");

    toast.success("Tersimpan ke Google Drive! ✓", { id: "drive-upload" });
    return data;
  } catch (e: any) {
    toast.error("Gagal upload Drive: " + (e?.message || "unknown"), { id: "drive-upload" });
    return null;
  }
};

/**
 * Cek apakah file dengan ID tertentu masih ada di Google Drive.
 * Mengembalikan true jika file ada, false jika sudah dihapus.
 */
export const checkDriveFileExists = async (fileId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke("drive-upload", {
      body: {
        action: "check",
        fileId,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data?.exists === true;
  } catch (e: any) {
    console.error("checkDriveFileExists error:", e?.message);
    return false;
  }
};
