/** Accounting PDF via PDFKit — port of backend/pdf_gen.py */
const PDFDocument = require("pdfkit");

const BRAND = "#7FA9A8";
const DARK = "#1A1C18";
const MUTED = "#5C6057";
const CREAM = "#F5F2EA";
const GRID = "#DDDDDD";

function money(v) { return `CHF ${Number(v || 0).toFixed(2)}`; }

/**
 * @param {number} month
 * @param {number} year
 * @param {Array<object>} orders
 * @param {string} restaurantName
 * @returns {Promise<Buffer>}
 */
function buildAccountingPdf(month, year, orders, restaurantName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 56, right: 56 } });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ---- Header ----
    doc.fillColor(DARK).fontSize(22).text(`${restaurantName} — Comptabilité`, { align: "left" });
    doc.moveDown(0.2);
    doc.fillColor(MUTED).fontSize(10).text(
      `Période : ${String(month).padStart(2, "0")}/${year} · Généré le ${new Date().toLocaleString("fr-CH", { timeZone: "Europe/Zurich" })}`,
      { align: "left" }
    );
    doc.moveDown(1.2);

    // ---- Compute totals ----
    const netByVat = {}, vatByVat = {};
    let gross = 0;
    const productQty = {};
    for (const o of orders) {
      const rate = Number(o.vat_rate ?? 0.026);
      netByVat[rate] = (netByVat[rate] || 0) + (Number(o.subtotal) || 0) - (Number(o.discount_amount) || 0);
      vatByVat[rate] = (vatByVat[rate] || 0) + (Number(o.vat_amount) || 0);
      gross += Number(o.total) || 0;
      for (const it of o.items || []) {
        productQty[it.name] = (productQty[it.name] || 0) + (Number(it.quantity) || 0);
      }
    }
    const net = Object.values(netByVat).reduce((a, b) => a + b, 0);
    const vatTotal = Object.values(vatByVat).reduce((a, b) => a + b, 0);

    // ---- Section: Synthèse ----
    doc.fillColor(BRAND).fontSize(13).text("Synthèse");
    doc.moveDown(0.4);
    const summary = [
      ["Chiffre d'affaires brut (TTC)", money(gross)],
      ["CA net (HT)", money(net)],
      ["TVA totale", money(vatTotal)],
      ["Nombre de commandes", String(orders.length)],
    ];
    renderTable(doc, summary, [260, 200], { header: false });

    doc.moveDown(0.8);
    doc.fillColor(BRAND).fontSize(13).text("TVA détaillée par taux");
    doc.moveDown(0.4);
    const vatRows = [["Taux", "Base HT", "TVA collectée"]];
    for (const rate of Object.keys(netByVat).map(Number).sort((a, b) => a - b)) {
      vatRows.push([`${(rate * 100).toFixed(1)}%`, money(netByVat[rate]), money(vatByVat[rate])]);
    }
    renderTable(doc, vatRows, [153, 155, 155], { header: true });

    doc.moveDown(0.8);
    doc.fillColor(BRAND).fontSize(13).text("Produits vendus (par quantité)");
    doc.moveDown(0.4);
    const prodRows = [["Produit", "Quantité"]];
    const sorted = Object.entries(productQty).sort((a, b) => b[1] - a[1]);
    for (const [name, qty] of sorted) prodRows.push([name, String(qty)]);
    if (prodRows.length === 1) prodRows.push(["—", "0"]);
    renderTable(doc, prodRows, [340, 120], { header: true });

    doc.moveDown(1.2);
    doc.fillColor(MUTED).fontSize(9).text("Document anonymisé — commandes supprimées exclues.", { align: "left" });

    doc.end();
  });
}

/** Simple table renderer. rows is a 2D array. First row is header if opts.header. */
function renderTable(doc, rows, colWidths, opts = {}) {
  const startX = doc.page.margins.left;
  let y = doc.y;
  const rowH = 22;
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  rows.forEach((row, i) => {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const isHeader = opts.header && i === 0;
    if (isHeader) doc.rect(startX, y, totalW, rowH).fill(BRAND);
    else if (!opts.header && i === 0) doc.rect(startX, y, totalW, rowH).fill(CREAM);
    else doc.rect(startX, y, totalW, rowH).fill("#FFFFFF");

    let x = startX;
    row.forEach((cell, ci) => {
      const w = colWidths[ci];
      doc.fillColor(isHeader ? "#FFFFFF" : DARK).fontSize(10).text(String(cell), x + 6, y + 6, { width: w - 12, height: rowH - 8, ellipsis: true });
      x += w;
    });

    // grid
    doc.lineWidth(0.3).strokeColor(GRID).rect(startX, y, totalW, rowH).stroke();
    y += rowH;
  });
  doc.y = y;
}

module.exports = { buildAccountingPdf };
