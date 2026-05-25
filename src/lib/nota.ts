// Format & calculation utilities for Nota app
export const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export const formatTanggal = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

export const formatTanggalLong = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
};

export type DiskonManual = { tipe: "persen" | "nominal"; nilai: number; keterangan?: string };

export type PotonganLain = { nama: string; nominal: number; foto_url?: string | null };

export type Item = {
  kode?: string;
  nama: string;
  qty: number;
  satuan?: string;
  harga: number;
  subtotal: number;
};

export type DiskonNota = {
  persen: number;
  nominal: number;
  persen2?: number;
  persen3?: number;
};

export type Nota = {
  id: string;
  kode_nota: string | null;
  no_nota: string | null;
  full_no: string | null;
  tanggal: string | null;
  nama_customer: string | null;
  total: number;
  diskon_nota: DiskonNota;
  netto: number;
  items: Item[];
  file_url: string | null;
  ocr_text: string | null;
  divisi_id: string | null;
  divisi_nama: string | null;
  created_at: string;
};

export type Transaction = {
  id: string;
  customer: string | null;
  nota_ids: string[];
  subtotal: number;
  diskon_manual: DiskonManual[];
  potongan_lain: PotonganLain[];
  total_akhir: number;
  jatuh_tempo: string | null;
  status: "draft" | "selesai";
  company_id: string | null;
  bank_id: string | null;
  bukti_tf_url: string | null;
  tanggal_tf: string | null;
  group_id: string | null;
  metode_tf: string | null;
  catatan_tf: string | null;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionGroup = {
  id: string;
  nama: string | null;
  bukti_tf_url: string | null;
  tanggal_tf: string | null;
  company_id: string | null;
  bank_id: string | null;
  metode_tf: string | null;
  catatan_tf: string | null;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  nama: string;
  kategori: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  jatuh_tempo_hari: number;
  created_at: string;
  updated_at: string;
};

export type Bank = {
  id: string;
  nama_bank: string;
  no_rek: string;
  atas_nama: string;
  created_at: string;
  updated_at: string;
};

/** Format kode-nota: "B-0009" */
export const formatKodeNota = (n: { kode_nota?: string | null; no_nota?: string | null; full_no?: string | null }) => {
  const kode = (n.kode_nota || "").trim();
  const no = (n.no_nota || "").trim();
  if (kode && no) return `${kode}-${no}`;
  if (no) return no;
  if (kode) return kode;
  return n.full_no || "-";
};

export const hitungSubtotal = (notas: Pick<Nota, "netto">[]) =>
  notas.reduce((sum, n) => sum + (Number(n.netto) || 0), 0);

export const hitungTotalAkhir = (
  subtotal: number,
  diskon: DiskonManual[],
  potongan: PotonganLain[] = [],
) => {
  let total = subtotal;
  for (const d of diskon) {
    if (d.tipe === "persen") total -= total * (Number(d.nilai) / 100);
    else total -= Number(d.nilai) || 0;
  }
  for (const p of potongan) {
    total -= Number(p.nominal) || 0;
  }
  return Math.max(0, total);
};

export const hitungDiskonTotal = (subtotal: number, diskon: DiskonManual[]) =>
  subtotal - hitungTotalAkhir(subtotal, diskon, []);

export const hitungPotonganLainTotal = (potongan: PotonganLain[] = []) =>
  potongan.reduce((s, p) => s + (Number(p.nominal) || 0), 0);

/**
 * Jatuh Tempo: midpoint antara nota tertua & termuda + 21 hari.
 * Jika hanya 1 nota → tanggal nota + 21 hari.
 */
export const hitungJatuhTempo = (
  tanggalList: (string | null | undefined)[],
  hari: number = 21,
): Date | null => {
  const valid = tanggalList
    .filter(Boolean)
    .map((d) => new Date(d as string))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (valid.length === 0) return null;
  const tua = valid[0];
  const muda = valid[valid.length - 1];
  const mid = new Date((tua.getTime() + muda.getTime()) / 2);
  mid.setDate(mid.getDate() + (Number(hari) || 21));
  return mid;
};

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);
