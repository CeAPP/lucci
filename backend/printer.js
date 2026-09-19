/**
 * Star CloudPRNT ticket builder — mC-Print2 in Star Line Mode (58 mm, 32 chars/line).
 * Direct port of backend/printer.py — same bytes.
 */
const crypto = require("crypto");

// ---- Star Line Mode command bytes (mC-Print2 default mode) ----
const ESC = Buffer.from([0x1b]);
const LF = Buffer.from([0x0a]);
const INIT = Buffer.from([0x1b, 0x40]);
const BOLD_ON = Buffer.from([0x1b, 0x45]);
const BOLD_OFF = Buffer.from([0x1b, 0x46]);
const ALIGN_LEFT = Buffer.from([0x1b, 0x1d, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x1d, 0x61, 0x01]);
const DBL_H_ON = Buffer.from([0x1b, 0x68, 0x01]);
const DBL_H_OFF = Buffer.from([0x1b, 0x68, 0x00]);
const DBL_W_ON = Buffer.from([0x1b, 0x57, 0x01]);
const DBL_W_OFF = Buffer.from([0x1b, 0x57, 0x00]);
const SIZE_NORMAL = Buffer.concat([DBL_W_OFF, DBL_H_OFF]);
const SIZE_DBL_H = Buffer.concat([DBL_W_OFF, DBL_H_ON]);
const SIZE_DBL_BOTH = Buffer.concat([DBL_W_ON, DBL_H_ON]);
const FEED3 = Buffer.from([0x0a, 0x0a, 0x0a]);
const CUT = Buffer.from([0x1b, 0x64, 0x02]); // feed + full cut

const LINE_WIDTH = 32;

// ---- Text helpers ----
function stripAccents(s) {
  if (!s) return "";
  return String(s).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}
function encodeCp437(s) {
  // Fall back to latin1 which maps most Western chars 1:1. Star mC-Print2 accepts CP437/CP858.
  return Buffer.from(stripAccents(s), "latin1");
}
function line(text = "") {
  return Buffer.concat([encodeCp437(text), LF]);
}
function row(left, right, width = LINE_WIDTH) {
  left = stripAccents(left || "");
  right = stripAccents(right || "");
  const maxLeft = Math.max(1, width - right.length - 1);
  if (left.length > maxLeft) left = left.slice(0, maxLeft - 1) + ".";
  const spaces = " ".repeat(Math.max(1, width - left.length - right.length));
  return Buffer.concat([Buffer.from(left + spaces + right, "latin1"), LF]);
}
function wrap(text, width = LINE_WIDTH) {
  text = stripAccents(text || "").trim();
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
const money = v => (Number(v) || 0).toFixed(2);
const sep = Buffer.concat([Buffer.from("-".repeat(LINE_WIDTH), "latin1"), LF]);
const dsep = Buffer.concat([Buffer.from("=".repeat(LINE_WIDTH), "latin1"), LF]);

function fmtDt(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const opts = { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
    const parts = new Intl.DateTimeFormat("fr-CH", opts).formatToParts(d);
    const g = k => parts.find(p => p.type === k)?.value;
    return `${g("day")}.${g("month")}.${g("year")} ${g("hour")}:${g("minute")}`;
  } catch { return iso; }
}
function fmtPickup(order) {
  const pt = order.pickup_time || "";
  if (pt === "ASAP") return "DES QUE POSSIBLE";
  try {
    const d = new Date(pt);
    if (isNaN(d.getTime())) throw new Error("invalid");
    const opts = { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hour12: false };
    const dopts = { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit" };
    const hhmm = new Intl.DateTimeFormat("fr-CH", opts).format(d).replace(":", "h");
    const today = new Intl.DateTimeFormat("fr-CH", dopts).format(new Date());
    const dt = new Intl.DateTimeFormat("fr-CH", dopts).format(d);
    if (today === dt) return `AUJ. ${hhmm}`;
    return `${dt} - ${hhmm}`;
  } catch {}
  let label = (order.pickup_time_label || pt || "").trim();
  const m = label.match(/(\d{1,2}):(\d{2})/);
  if (m) label = label.replace(m[0], `${String(m[1]).padStart(2,"0")}h${m[2]}`);
  return label.toUpperCase();
}
function fmtPay(order) {
  const pm = order.payment_method, ps = order.payment_status;
  if (pm === "online") return ps === "paid" || ps === "confirmed" ? "En ligne (PAYE)" : "En ligne";
  return "Sur place";
}

// ---- Ticket builders ----
function buildClientTicket(order, header) {
  const out = [];
  out.push(INIT);
  out.push(ALIGN_CENTER, BOLD_ON, SIZE_DBL_BOTH);
  out.push(line((header.name || "FARMACIA ANGELUCCI").toUpperCase()));
  out.push(SIZE_NORMAL, BOLD_OFF);
  if (header.address) out.push(line(header.address));
  if (header.phone) out.push(line(`Tel: ${header.phone}`));
  if (header.website) out.push(line(header.website));
  out.push(LF, ALIGN_LEFT, sep);

  out.push(BOLD_ON, SIZE_DBL_H);
  out.push(line(`CMD #${order.order_number || ""}`));
  out.push(SIZE_NORMAL, BOLD_OFF);
  out.push(line(`Date : ${fmtDt(order.created_at)}`));
  const ftype = order.fulfillment_type === "takeaway" ? "Vente a l'emporter" : "Livraison";
  out.push(line(`Type : ${ftype}`));
  out.push(LF, BOLD_ON, SIZE_DBL_BOTH);
  out.push(line("RETRAIT"));
  out.push(line(fmtPickup(order)));
  out.push(SIZE_NORMAL, BOLD_OFF, LF);
  const menuLbl = order.menu_type === "restaurant" ? "Restaurant" : "Epicerie";
  out.push(line(`Menu : ${menuLbl}`));
  out.push(sep);

  const cust = order.customer || {};
  const full = `${cust.first_name || ""} ${cust.last_name || ""}`.trim();
  out.push(line(`Client : ${full}`));
  if (cust.phone) out.push(line(`Tel    : ${cust.phone}`));
  if (cust.address) out.push(line(`Adresse: ${cust.address}`));
  out.push(sep);

  out.push(BOLD_ON, line("ARTICLES"), BOLD_OFF);
  for (const it of order.items || []) {
    const qty = parseInt(it.quantity) || 1;
    const name = it.name || "";
    const lineTotal = Number(it.line_total) || 0;
    const head = `${qty}x ${name}`;
    const wrapped = wrap(head, LINE_WIDTH - 8);
    if (wrapped.length) {
      out.push(row(wrapped[0], money(lineTotal)));
      for (const extra of wrapped.slice(1)) out.push(line(`    ${extra}`));
    }
    for (const a of it.selected_addons || []) {
      const aname = a.name || "";
      const aprice = Number(a.price) || 0;
      if (aprice) out.push(row(`  + ${aname}`, `+${money(aprice)}`));
      else out.push(line(`  + ${aname}`));
    }
    if (it.note) {
      for (const w of wrap(`Note: ${it.note}`, LINE_WIDTH - 4)) out.push(line(`    ${w}`));
    }
  }
  out.push(sep);

  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount_amount) || Number(order.discount) || 0;
  const total = Number(order.total) || 0;
  out.push(row("Sous-total", money(subtotal) + " CHF"));
  if (discount) out.push(row("Remise", "-" + money(discount) + " CHF"));
  out.push(LF, BOLD_ON, SIZE_DBL_H);
  out.push(row("TOTAL", money(total) + " CHF"));
  out.push(SIZE_NORMAL, BOLD_OFF);
  out.push(line(`Paiement : ${fmtPay(order)}`));
  out.push(sep);

  out.push(ALIGN_CENTER, line("Merci pour votre commande !"));
  if (header.website) out.push(line(header.website));
  out.push(FEED3, CUT);
  return Buffer.concat(out);
}

function buildKitchenTicket(order) {
  const out = [];
  out.push(INIT, ALIGN_CENTER, BOLD_ON, SIZE_DBL_BOTH);
  out.push(line("CUISINE"));
  out.push(SIZE_NORMAL, BOLD_OFF, ALIGN_LEFT, dsep);

  out.push(BOLD_ON, SIZE_DBL_H);
  out.push(line(`CMD #${order.order_number || ""}`));
  out.push(SIZE_NORMAL, BOLD_OFF);
  out.push(LF, BOLD_ON, SIZE_DBL_BOTH);
  out.push(line("RETRAIT"));
  out.push(line(fmtPickup(order)));
  out.push(SIZE_NORMAL, BOLD_OFF, LF);

  const cust = order.customer || {};
  const first = cust.first_name || "";
  const lastIni = (cust.last_name || "").slice(0, 1);
  const who = (first + (lastIni ? " " + lastIni + "." : "")).trim();
  if (who) out.push(line(`Client  : ${who}`));
  const ftype = order.fulfillment_type === "takeaway" ? "A EMPORTER" : "LIVRAISON";
  out.push(line(`Type    : ${ftype}`));
  out.push(dsep, LF);

  for (const it of order.items || []) {
    const qty = parseInt(it.quantity) || 1;
    const name = it.name || "";
    out.push(BOLD_ON, SIZE_DBL_BOTH);
    const head = `${qty}x ${name}`;
    const heads = wrap(head, 16);
    for (const h of (heads.length ? heads : [head])) out.push(line(h));
    out.push(SIZE_NORMAL, BOLD_OFF);
    for (const a of it.selected_addons || []) out.push(BOLD_ON, line(`  + ${a.name || ""}`), BOLD_OFF);
    if (it.note) {
      for (const w of wrap(`>>> ${it.note}`, LINE_WIDTH - 2)) out.push(BOLD_ON, line(w), BOLD_OFF);
    }
    out.push(LF);
  }
  out.push(dsep, FEED3, CUT);
  return Buffer.concat(out);
}

// ---- Queue helpers ----
async function enqueueOrderPrints(db, order, header) {
  const now = new Date().toISOString();
  for (const kind of ["client", "kitchen"]) {
    const existing = await db.collection("print_jobs").findOne({ order_id: order.id, kind });
    if (existing) continue;
    const payload = kind === "client" ? buildClientTicket(order, header) : buildKitchenTicket(order);
    await db.collection("print_jobs").insertOne({
      id: crypto.randomUUID(),
      order_id: order.id,
      order_number: order.order_number,
      kind,
      payload,           // Node Buffer -> BSON Binary
      status: "pending",
      created_at: now,
      downloaded_at: null,
      printed_at: null,
    });
  }
}

async function nextPendingJob(db) {
  return await db.collection("print_jobs").findOne(
    { status: { $in: ["pending", "downloaded"] } },
    { sort: { created_at: 1 } }
  );
}
async function markDownloaded(db, jobId) {
  await db.collection("print_jobs").updateOne(
    { id: jobId },
    { $set: { status: "downloaded", downloaded_at: new Date().toISOString() } }
  );
}
async function markPrinted(db, jobId) {
  await db.collection("print_jobs").updateOne(
    { id: jobId },
    { $set: { status: "printed", printed_at: new Date().toISOString() } }
  );
}

module.exports = { buildClientTicket, buildKitchenTicket, enqueueOrderPrints, nextPendingJob, markDownloaded, markPrinted };
