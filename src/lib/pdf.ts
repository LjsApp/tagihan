import { jsPDF } from "jspdf";
import {
  formatKodeNota,
  formatRp,
  formatTanggal,
  formatTanggalLong,
  hitungDiskonTotal,
  type Bank,
  type Company,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
} from "@/lib/nota";
import { enhanceScanLook, fetchImageAsDataURL, getImageDimensions } from "@/lib/imageUtils";

export const generateTandaTerimaPDF = async (
  trx: Transaction,
  notas: Nota[],
  company: Company | null,
  bank: Bank | null,
): Promise<jsPDF> => {
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 12;

  const headerTitle = `PERINCIAN TAGIHAN${
    company?.kategori ? ` ${company.kategori.toUpperCase()}` : ""
  }${company?.nama ? ` ${company.nama.toUpperCase()}` : ""}`;

  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  // Wrap header if too long
  const headerLines = doc.splitTextToSize(headerTitle, W - 20);
  for (const line of headerLines) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 5;
  }
  y += 1;

  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text(`Customer: ${trx.customer || "-"}`, 10, y);
  y += 4;
  doc.text(`Tanggal: ${formatTanggalLong(trx.created_at)}`, 10, y);
  y += 5;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(10, y, W - 10, y);
  y += 4;

  doc.setFont("courier", "bold");
  doc.text("Tanggal", 10, y);
  doc.text("Kode-Nota", 45, y);
  doc.text("Jumlah", W - 10, y, { align: "right" });
  y += 3;
  doc.line(10, y, W - 10, y);
  y += 4;

  doc.setFont("courier", "normal");
  for (const n of notas) {
    doc.text(formatTanggal(n.tanggal), 10, y);
    doc.text(formatKodeNota(n), 45, y);
    doc.text(formatRp(n.netto), W - 10, y, { align: "right" });
    y += 4;
  }

  y += 1;
  doc.line(10, y, W - 10, y);
  y += 5;

  const subtotal = trx.subtotal;
  const totalDisc = hitungDiskonTotal(subtotal, trx.diskon_manual || []);

  doc.text("Sub Total", 10, y);
  doc.text(`Rp ${formatRp(subtotal)}`, W - 10, y, { align: "right" });
  y += 4;

  for (const d of (trx.diskon_manual || []) as DiskonManual[]) {
    const label = d.tipe === "persen" ? `Disc ${d.nilai}%` : `Disc Rp ${formatRp(d.nilai)}`;
    const val = d.tipe === "persen" ? (subtotal * Number(d.nilai)) / 100 : Number(d.nilai);
    doc.text(label, 10, y);
    doc.text(`- Rp ${formatRp(val)}`, W - 10, y, { align: "right" });
    y += 4;
  }
  for (const p of (trx.potongan_lain || []) as PotonganLain[]) {
    doc.text(p.nama || "Potongan", 10, y);
    doc.text(`- Rp ${formatRp(p.nominal)}`, W - 10, y, { align: "right" });
    y += 4;
  }
  doc.line(10, y, W - 10, y);
  y += 5;

  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", 10, y);
  doc.text(`Rp ${formatRp(trx.total_akhir)}`, W - 10, y, { align: "right" });
  y += 6;

  doc.setFontSize(9);
  doc.text(`JATUH TEMPO : ${formatTanggalLong(trx.jatuh_tempo)}`, W / 2, y, { align: "center" });
  y += 6;

  // Bank info footer
  if (bank) {
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, y, W - 10, y);
    y += 5;
    doc.setFont("courier", "bold");
    doc.text("PEMBAYARAN VIA", W / 2, y, { align: "center" });
    y += 4;
    doc.setFont("courier", "normal");
    doc.text(`${bank.nama_bank}`, W / 2, y, { align: "center" });
    y += 4;
    doc.text(`No. Rek: ${bank.no_rek}`, W / 2, y, { align: "center" });
    y += 4;
    doc.text(`a/n ${bank.atas_nama}`, W / 2, y, { align: "center" });
  }

  // Lampiran foto nota — 1 nota per halaman
  const notasWithFoto = notas.filter((n) => n.file_url);
  for (const n of notasWithFoto) {
    doc.addPage();
    let py = 12;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("LAMPIRAN NOTA", W / 2, py, { align: "center" });
    py += 5;
    doc.setFontSize(10);
    doc.text(formatKodeNota(n), W / 2, py, { align: "center" });
    py += 4;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(
      `${formatTanggal(n.tanggal)} · ${n.nama_customer || "-"} · Rp ${formatRp(n.netto)}`,
      W / 2,
      py,
      { align: "center" },
    );
    py += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, py, W - 10, py);
    py += 3;

    try {
      const raw = await fetchImageAsDataURL(n.file_url!);
      if (!raw) continue;
      const enhanced = await enhanceScanLook(raw);
      const dims = await getImageDimensions(enhanced);
      const maxW = W - 20;
      const maxH = H - py - 10;
      const ratio = dims.width / dims.height;
      let drawW = maxW;
      let drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      const x = (W - drawW) / 2;
      doc.addImage(enhanced, "JPEG", x, py, drawW, drawH);
    } catch (e) {
      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.text("(foto nota tidak dapat dimuat)", W / 2, py + 10, { align: "center" });
    }
  }

  // Lampiran foto potongan lain
  for (const p of (trx.potongan_lain || []) as PotonganLain[]) {
    if (!p.foto_url) continue;
    doc.addPage();
    let py = 12;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("FOTO POTONGAN LAIN", W / 2, py, { align: "center" });
    py += 5;
    doc.setFontSize(10);
    doc.text((p.nama || "Potongan").toUpperCase(), W / 2, py, { align: "center" });
    py += 4;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`Rp ${formatRp(p.nominal)}`, W / 2, py, { align: "center" });
    py += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, py, W - 10, py);
    py += 3;
    try {
      const raw = await fetchImageAsDataURL(p.foto_url);
      if (!raw) continue;
      const dims = await getImageDimensions(raw);
      const maxW = W - 20;
      const maxH = H - py - 10;
      const ratio = dims.width / dims.height;
      let drawW = maxW;
      let drawH = drawW / ratio;
      if (drawH > maxH) {
        drawH = maxH;
        drawW = drawH * ratio;
      }
      const x = (W - drawW) / 2;
      doc.addImage(raw, "JPEG", x, py, drawW, drawH);
    } catch {
      doc.text("(foto tidak dapat dimuat)", W / 2, py + 10, { align: "center" });
    }
  }

  // Bukti transfer page
  if (trx.bukti_tf_url) {
    doc.addPage();
    let py = 12;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("BUKTI TRANSFER", W / 2, py, { align: "center" });
    py += 5;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`Tanggal Transfer: ${formatTanggalLong(trx.tanggal_tf)}`, W / 2, py, {
      align: "center",
    });
    py += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, py, W - 10, py);
    py += 3;
    try {
      const raw = await fetchImageAsDataURL(trx.bukti_tf_url);
      if (raw) {
        const dims = await getImageDimensions(raw);
        const maxW = W - 20;
        const maxH = H - py - 10;
        const ratio = dims.width / dims.height;
        let drawW = maxW;
        let drawH = drawW / ratio;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * ratio;
        }
        const x = (W - drawW) / 2;
        doc.addImage(raw, "JPEG", x, py, drawW, drawH);
      }
    } catch {
      doc.text("(bukti transfer tidak dapat dimuat)", W / 2, py + 10, { align: "center" });
    }
  }

  return doc;
};
