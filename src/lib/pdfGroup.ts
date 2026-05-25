import { jsPDF } from "jspdf";
import {
  formatKodeNota,
  formatRp,
  formatTanggal,
  formatTanggalLong,
  hitungDiskonTotal,
  hitungPotonganLainTotal,
  type Bank,
  type Company,
  type DiskonManual,
  type PotonganLain,
  type Nota,
  type Transaction,
  type TransactionGroup,
} from "@/lib/nota";
import { enhanceScanLook, fetchImageAsDataURL, getImageDimensions } from "@/lib/imageUtils";

export const generateTandaTerimaGroupPDF = async (
  group: TransactionGroup,
  trxList: Transaction[],
  notasByTrx: Record<string, Nota[]>,
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
  for (const line of doc.splitTextToSize(headerTitle, W - 20)) {
    doc.text(line, W / 2, y, { align: "center" });
    y += 5;
  }
  doc.setFontSize(9);
  doc.setFont("courier", "normal");
  doc.text(`Tanggal Cetak: ${formatTanggalLong(new Date().toISOString())}`, 10, y);
  y += 4;
  doc.text(`Total Transaksi: ${trxList.length}`, 10, y);
  y += 5;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(10, y, W - 10, y);
  y += 4;

  let grandTotal = 0;

  for (const [idx, trx] of trxList.entries()) {
    const notas = notasByTrx[trx.id] || [];
    if (y > H - 40) {
      doc.addPage();
      y = 12;
    }
    doc.setFont("courier", "bold");
    doc.text(`Transaksi #${idx + 1} — ${trx.customer || "-"}`, 10, y);
    y += 4;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text("Tgl", 10, y);
    doc.text("Kode-Nota", 45, y);
    doc.text("Jumlah", W - 10, y, { align: "right" });
    y += 3;
    doc.line(10, y, W - 10, y);
    y += 3.5;

    for (const n of notas) {
      doc.text(formatTanggal(n.tanggal), 10, y);
      const kodeLines = doc.splitTextToSize(formatKodeNota(n), W - 85);
      doc.text(kodeLines, 45, y);
      doc.text(formatRp(n.netto), W - 10, y, { align: "right" });
      y += 3.5 * kodeLines.length;
    }
    const totalDisc = hitungDiskonTotal(trx.subtotal, trx.diskon_manual || []);
    doc.text("Sub Total", 10, y);
    doc.text(`Rp ${formatRp(trx.subtotal)}`, W - 10, y, { align: "right" });
    y += 3.5;
    for (const d of (trx.diskon_manual || []) as DiskonManual[]) {
      const label = d.tipe === "persen" ? `Disc ${d.nilai}%` : `Disc Rp ${formatRp(d.nilai)}`;
      const val = d.tipe === "persen" ? (trx.subtotal * Number(d.nilai)) / 100 : Number(d.nilai);
      doc.text(label, 10, y);
      doc.text(`- Rp ${formatRp(val)}`, W - 10, y, { align: "right" });
      y += 3.5;
    }
    for (const p of (trx.potongan_lain || []) as PotonganLain[]) {
      doc.text(p.nama || "Potongan", 10, y);
      doc.text(`- Rp ${formatRp(p.nominal)}`, W - 10, y, { align: "right" });
      y += 3.5;
    }
    doc.setFont("courier", "bold");
    doc.text("Total", 10, y);
    doc.text(`Rp ${formatRp(trx.total_akhir)}`, W - 10, y, { align: "right" });
    y += 3.5;
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.text(`Jatuh Tempo: ${formatTanggalLong(trx.jatuh_tempo)}`, 10, y);
    y += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, y, W - 10, y);
    y += 4;

    grandTotal += Number(trx.total_akhir) || 0;
  }

  if (y > H - 40) {
    doc.addPage();
    y = 12;
  }
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("GRAND TOTAL", 10, y);
  doc.text(`Rp ${formatRp(grandTotal)}`, W - 10, y, { align: "right" });
  y += 8;

  if (bank) {
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, y, W - 10, y);
    y += 5;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text("PEMBAYARAN VIA", W / 2, y, { align: "center" });
    y += 4;
    doc.setFont("courier", "normal");
    doc.text(`${bank.nama_bank}`, W / 2, y, { align: "center" });
    y += 4;
    doc.text(`No. Rek: ${bank.no_rek}`, W / 2, y, { align: "center" });
    y += 4;
    doc.text(`a/n ${bank.atas_nama}`, W / 2, y, { align: "center" });
  }

  // Lampiran nota - 1 nota per halaman
  for (const trx of trxList) {
    const notas = notasByTrx[trx.id] || [];
    for (const n of notas.filter((x) => x.file_url)) {
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
        `${formatTanggal(n.tanggal)} · ${trx.customer || "-"} · Rp ${formatRp(n.netto)}`,
        W / 2,
        py,
        { align: "center" },
      );
      py += 4;
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
      } catch {}
    }
  }

  // Bukti transfer
  if (group.bukti_tf_url) {
    doc.addPage();
    let py = 12;
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.text("BUKTI TRANSFER", W / 2, py, { align: "center" });
    py += 5;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`Tanggal Transfer: ${formatTanggalLong(group.tanggal_tf)}`, W / 2, py, {
      align: "center",
    });
    py += 4;
    doc.setLineDashPattern([1, 1], 0);
    doc.line(10, py, W - 10, py);
    py += 3;
    try {
      const raw = await fetchImageAsDataURL(group.bukti_tf_url);
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
    } catch {}
  }

  return doc;
};
