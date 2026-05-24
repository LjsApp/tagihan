// Parse OCR text from a nota into structured data.
// Best-effort, flexible regex-based parser.
import type { DiskonNota, Item } from "./nota";

export type ParsedNota = {
  kode_nota: string | null;
  no_nota: string | null;
  full_no: string | null;
  tanggal: string | null;
  nama_customer: string | null;
  total: number;
  diskon_nota: DiskonNota;
  netto: number;
  items: Item[];
};

const parseAngka = (s: string): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(/,/g, ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const parseTanggal = (raw: string): string | null => {
  // Matches dd-mm-yyyy or dd/mm/yyyy or dd-mm-yy
  const m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
};

export const parseNotaText = (text: string): ParsedNota => {
  const t = text || "";
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Customer name (after "Nama")
  let nama: string | null = null;
  const namaMatch = t.match(/Nama\s*[:\.]?\s*([A-Z][A-Z\s\.]{2,40})/i);
  if (namaMatch) nama = namaMatch[1].trim().replace(/\s+/g, " ");

  // Tanggal
  let tanggal: string | null = null;
  const tglMatch = t.match(/(?:TGL|Tanggal|TANGGAL)\s*[:\.]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (tglMatch) tanggal = parseTanggal(tglMatch[1]);
  if (!tanggal) {
    const anyDate = t.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
    if (anyDate) tanggal = parseTanggal(anyDate[1]);
  }

  // No nota & kode (e.g. BLG No. 000919)
  let kode_nota: string | null = null;
  let no_nota: string | null = null;
  const noMatch = t.match(/\b([A-Z]{2,4})\s*(?:No\.?|NO\.?)?\s*[:\.]?\s*(\d{4,8})/);
  if (noMatch) {
    kode_nota = noMatch[1];
    no_nota = noMatch[2];
  }
  const full_no = kode_nota && no_nota ? `${kode_nota}-${no_nota}` : null;

  // Total / Netto
  let netto = 0;
  const nettoMatch = t.match(/(?:Total\s*Jumlah\s*Netto|NETTO|Netto)\s*[:\.]?\s*([\d\.,]+)/i);
  if (nettoMatch) netto = parseAngka(nettoMatch[1]);

  let total = 0;
  const totalMatch = t.match(/(?:Total\s*Jumlah|Sub\s*Total|TOTAL)\s*[:\.]?\s*([\d\.,]+)/i);
  if (totalMatch) total = parseAngka(totalMatch[1]);
  if (!total) total = netto;

  // Diskon nota (persen)
  let diskon_nota: DiskonNota = { persen: 0, nominal: 0 };
  const discPersen = t.match(/Disc(?:ount)?\s*[:\.]?\s*(\d{1,2})\s*%/i);
  if (discPersen) diskon_nota.persen = parseInt(discPersen[1], 10);
  const discNominal = t.match(/Disc[^0-9]*([\d\.,]{4,})/i);
  if (discNominal) {
    const n = parseAngka(discNominal[1]);
    if (n > 100) diskon_nota.nominal = n;
  }
  if (!diskon_nota.nominal && total && netto && total > netto) {
    diskon_nota.nominal = total - netto;
    if (!diskon_nota.persen) {
      diskon_nota.persen = Math.round((diskon_nota.nominal / total) * 100);
    }
  }
  if (!netto) netto = total - diskon_nota.nominal;

  // Items — heuristic: lines with kode + name + numbers
  const items: Item[] = [];
  for (const line of lines) {
    // pattern: CODE  NAME  ... QTY ... HARGA ... SUBTOTAL
    const m = line.match(
      /^([A-Z]{2,5}\d{2,5})\s+(.+?)\s+(\d{1,3})\s+(?:DOS|PCS|BJ|BH|UNIT|KG)?\s*(?:\d+\s+\w+)?\s+([\d\.,]+)\s+([\d\.,]+)\s*$/i,
    );
    if (m) {
      const [, kode, nama, qty, harga, subtotal] = m;
      items.push({
        kode,
        nama: nama.trim(),
        qty: parseInt(qty, 10),
        satuan: "BJ",
        harga: parseAngka(harga),
        subtotal: parseAngka(subtotal),
      });
    }
  }

  return {
    kode_nota,
    no_nota,
    full_no,
    tanggal,
    nama_customer: nama,
    total,
    diskon_nota,
    netto,
    items,
  };
};
