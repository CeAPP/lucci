/**
 * Angelucci's — Node.js/Express backend (Infomaniak-ready).
 * Mirrors the Python/FastAPI backend endpoint-for-endpoint.
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { MongoClient, Binary } = require("mongodb");
const multer = require("multer");

const {
  verifyCredentials, createToken, requireAuth, requireOwner, getClientIp,
} = require("./auth");
const { sendOrderConfirmation, sendReservationConfirmation, sendNewOrderNotification } = require("./emails");
const { createGateway } = require("./payrexx");
const { buildAccountingPdf } = require("./pdfGen");
const { seedDb } = require("./seed");
const prn = require("./printer");

const PORT = parseInt(process.env.PORT || "8001", 10);
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME;
if (!MONGO_URL || !DB_NAME) throw new Error("MONGO_URL / DB_NAME missing in .env");

const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim());

const nowIso = () => new Date().toISOString();
const genOrderNumber = () => {
  const d = new Date();
  const ts = `${String(d.getFullYear() % 100).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const r = String(crypto.randomInt(0, 10000)).padStart(4, "0");
  return `A${ts}-${r}`;
};

// ----- Mongo bootstrap -----
const mongoClient = new MongoClient(MONGO_URL);
let db;

// ----- Express -----
const app = express();
app.use(cors({ origin: CORS_ORIGINS.includes("*") ? true : CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const api = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const MIME_BY_EXT = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp",
};
function extOf(name) {
  const m = String(name || "").match(/(\.[a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}

/** Simple async wrapper — funnels rejections into Express next() so we don't leak stack traces. */
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ==================== AUTH ====================
api.post("/auth/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const ip = getClientIp(req);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const count = await db.collection("login_attempts").countDocuments({ ip, ts: { $gte: since }, success: false });
  if (count >= 10) return res.status(429).json({ detail: "Trop de tentatives, réessayez plus tard" });
  const user = verifyCredentials(username, password);
  await db.collection("login_attempts").insertOne({ ip, username, success: !!user, ts: nowIso() });
  if (!user) return res.status(401).json({ detail: "Identifiants invalides" });
  const token = createToken(user.username, user.role);
  res.json({ token, username: user.username, role: user.role });
}));

api.get("/auth/me", requireAuth, (req, res) => res.json(req.user));

// ==================== SETTINGS ====================
api.get("/settings", wrap(async (req, res) => {
  const s = await db.collection("settings").findOne({ _id: "settings" });
  if (!s) return res.json({});
  delete s._id;
  res.json(s);
}));

api.put("/settings", requireAuth, wrap(async (req, res) => {
  const allowed = ["restaurant_name", "phone", "email", "address", "vat_takeaway", "vat_delivery",
    "orders_enabled", "reservations_enabled", "grocery_lead_days", "preparation_time_minutes"];
  const changes = {};
  for (const k of allowed) if (req.body[k] !== undefined && req.body[k] !== null) changes[k] = req.body[k];
  if (Object.keys(changes).length) await db.collection("settings").updateOne({ _id: "settings" }, { $set: changes });
  const s = await db.collection("settings").findOne({ _id: "settings" });
  if (s) delete s._id;
  res.json(s || {});
}));

// ==================== CONTENT (CMS) ====================
api.get("/content", wrap(async (req, res) => {
  const q = req.query.page ? { page: req.query.page } : {};
  const docs = await db.collection("content_blocks").find(q, { projection: { _id: 0 } }).toArray();
  const out = {};
  for (const d of docs) {
    if (!out[d.page]) out[d.page] = {};
    out[d.page][d.key] = d.value || "";
  }
  res.json(out);
}));

api.put("/content", requireAuth, wrap(async (req, res) => {
  const { page, key, value } = req.query;
  if (!page || !key) return res.status(400).json({ detail: "page & key required" });
  await db.collection("content_blocks").updateOne(
    { page, key },
    { $set: { page, key, value: value ?? "", updated_at: nowIso() } },
    { upsert: true }
  );
  res.json({ ok: true, page, key, value: value ?? "" });
}));

// ==================== THEME ====================
api.get("/theme", wrap(async (req, res) => {
  const doc = await db.collection("settings").findOne({ _id: "theme" }) || {};
  res.json({
    primary: doc.primary || "#7FA9A8",
    font_display: doc.font_display || "Cormorant Garamond",
    font_body: doc.font_body || "Manrope",
  });
}));

api.put("/theme", requireAuth, wrap(async (req, res) => {
  const upd = {};
  const { primary, font_display, font_body } = req.query;
  if (primary) upd.primary = primary;
  if (font_display) upd.font_display = font_display;
  if (font_body) upd.font_body = font_body;
  if (Object.keys(upd).length) await db.collection("settings").updateOne({ _id: "theme" }, { $set: upd }, { upsert: true });
  const doc = await db.collection("settings").findOne({ _id: "theme" }) || {};
  res.json({
    primary: doc.primary || "#7FA9A8",
    font_display: doc.font_display || "Cormorant Garamond",
    font_body: doc.font_body || "Manrope",
  });
}));

// ==================== SCHEDULES ====================
api.get("/schedule/:kind", wrap(async (req, res) => {
  const kind = req.params.kind;
  if (!["restaurant", "reservation", "epicerie"].includes(kind)) return res.status(400).json({ detail: "Invalid kind" });
  const doc = await db.collection("schedules").findOne({ _id: `schedule_${kind}` });
  if (!doc) return res.json({});
  delete doc._id;
  res.json(doc);
}));

api.put("/schedule/:kind", requireAuth, wrap(async (req, res) => {
  const kind = req.params.kind;
  if (!["restaurant", "reservation", "epicerie"].includes(kind)) return res.status(400).json({ detail: "Invalid kind" });
  const { days, closed_dates } = req.body || {};
  await db.collection("schedules").updateOne(
    { _id: `schedule_${kind}` },
    { $set: { days: days || {}, closed_dates: closed_dates || [], kind } },
    { upsert: true }
  );
  const doc = await db.collection("schedules").findOne({ _id: `schedule_${kind}` });
  delete doc._id;
  res.json(doc);
}));

// ==================== CATEGORIES ====================
api.get("/categories", wrap(async (req, res) => {
  const q = req.query.menu_type ? { menu_type: req.query.menu_type } : {};
  const docs = await db.collection("categories").find(q, { projection: { _id: 0 } }).sort({ order: 1 }).toArray();
  res.json(docs);
}));

function normalizeCategory(body) {
  return {
    id: body.id || crypto.randomUUID(),
    name: String(body.name || "").trim(),
    menu_type: body.menu_type,
    order: Number.isFinite(body.order) ? body.order : 0,
    restricted_start_hour: body.restricted_start_hour ?? null,
    restricted_end_hour: body.restricted_end_hour ?? null,
  };
}

api.post("/categories", requireAuth, wrap(async (req, res) => {
  const doc = normalizeCategory(req.body || {});
  if (!doc.name || !doc.menu_type) return res.status(400).json({ detail: "name & menu_type required" });
  await db.collection("categories").insertOne({ ...doc });
  res.json(doc);
}));

api.put("/categories/:id", requireAuth, wrap(async (req, res) => {
  const doc = normalizeCategory(req.body || {});
  doc.id = req.params.id;
  await db.collection("categories").updateOne({ id: doc.id }, { $set: doc });
  res.json(doc);
}));

api.delete("/categories/:id", requireAuth, wrap(async (req, res) => {
  await db.collection("categories").deleteOne({ id: req.params.id });
  res.json({ ok: true });
}));

api.post("/categories/:id/move", requireAuth, wrap(async (req, res) => {
  const catId = req.params.id;
  const direction = req.query.direction;
  const cat = await db.collection("categories").findOne({ id: catId });
  if (!cat) return res.status(404).json({ detail: "Not found" });
  const siblings = await db.collection("categories").find({ menu_type: cat.menu_type }).sort({ order: 1 }).toArray();
  const idx = siblings.findIndex(c => c.id === catId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return res.json({ ok: true });
  const other = siblings[swapIdx];
  await db.collection("categories").updateOne({ id: cat.id }, { $set: { order: other.order } });
  await db.collection("categories").updateOne({ id: other.id }, { $set: { order: cat.order } });
  res.json({ ok: true });
}));

// ==================== ADDON GROUPS ====================
function normalizeAddonGroup(body) {
  return {
    id: body.id || crypto.randomUUID(),
    name: String(body.name || "").trim(),
    required: !!body.required,
    multi: !!body.multi,
    min: Number(body.min) || 0,
    max: Number(body.max) || 1,
    options: (body.options || []).map(o => ({
      id: o.id || crypto.randomUUID(),
      name: String(o.name || ""),
      price: Number(o.price) || 0,
    })),
  };
}
api.get("/addon-groups", wrap(async (req, res) => {
  const docs = await db.collection("addon_groups").find({}, { projection: { _id: 0 } }).toArray();
  res.json(docs);
}));
api.post("/addon-groups", requireAuth, wrap(async (req, res) => {
  const doc = normalizeAddonGroup(req.body || {});
  await db.collection("addon_groups").insertOne({ ...doc });
  res.json(doc);
}));
api.put("/addon-groups/:gid", requireAuth, wrap(async (req, res) => {
  const doc = normalizeAddonGroup(req.body || {});
  doc.id = req.params.gid;
  await db.collection("addon_groups").updateOne({ id: doc.id }, { $set: doc });
  res.json(doc);
}));
api.delete("/addon-groups/:gid", requireAuth, wrap(async (req, res) => {
  await db.collection("addon_groups").deleteOne({ id: req.params.gid });
  res.json({ ok: true });
}));

// ==================== PRODUCTS ====================
function isAvailable(p, today) {
  if (p.is_active === false) return false;
  if (p.out_of_stock_until) {
    try {
      const oos = new Date(p.out_of_stock_until + "T00:00:00");
      if (today.getTime() <= oos.getTime()) return false;
    } catch {}
  }
  return true;
}
function normalizeProduct(body) {
  return {
    id: body.id || crypto.randomUUID(),
    name: String(body.name || "").trim(),
    description: body.description || "",
    price: Number(body.price) || 0,
    image_url: body.image_url || "",
    category_id: body.category_id || "",
    menu_type: body.menu_type,
    addon_group_ids: body.addon_group_ids || [],
    tags: body.tags || [],
    variants: body.variants || [],
    out_of_stock_until: body.out_of_stock_until || null,
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active !== false,
    created_at: body.created_at || nowIso(),
  };
}
api.get("/products", wrap(async (req, res) => {
  const q = req.query.menu_type ? { menu_type: req.query.menu_type } : {};
  let docs = await db.collection("products").find(q, { projection: { _id: 0 } }).sort({ sort_order: 1, created_at: -1 }).toArray();
  if (!req.query.admin) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    docs = docs.filter(d => isAvailable(d, today));
  }
  res.json(docs);
}));
api.get("/products/all", requireAuth, wrap(async (req, res) => {
  const q = req.query.menu_type ? { menu_type: req.query.menu_type } : {};
  const docs = await db.collection("products").find(q, { projection: { _id: 0 } }).sort({ sort_order: 1, created_at: -1 }).toArray();
  res.json(docs);
}));
api.post("/products/reorder", requireAuth, wrap(async (req, res) => {
  const ids = req.body?.ordered_ids;
  if (!Array.isArray(ids)) return res.status(400).json({ detail: "ordered_ids must be a list" });
  for (let i = 0; i < ids.length; i++) {
    await db.collection("products").updateOne({ id: ids[i] }, { $set: { sort_order: i } });
  }
  res.json({ ok: true, count: ids.length });
}));
api.post("/products", requireAuth, wrap(async (req, res) => {
  const doc = normalizeProduct(req.body || {});
  await db.collection("products").insertOne({ ...doc });
  res.json(doc);
}));
api.put("/products/:pid", requireAuth, wrap(async (req, res) => {
  const doc = normalizeProduct(req.body || {});
  doc.id = req.params.pid;
  await db.collection("products").updateOne({ id: doc.id }, { $set: doc });
  res.json(doc);
}));
api.delete("/products/:pid", requireAuth, wrap(async (req, res) => {
  await db.collection("products").deleteOne({ id: req.params.pid });
  res.json({ ok: true });
}));
api.delete("/admin/products/bulk", requireAuth, wrap(async (req, res) => {
  const q = ["restaurant", "epicerie"].includes(req.query.menu_type) ? { menu_type: req.query.menu_type } : {};
  const r = await db.collection("products").deleteMany(q);
  res.json({ ok: true, deleted_count: r.deletedCount });
}));
api.post("/products/:pid/oos", requireAuth, wrap(async (req, res) => {
  const val = req.query.until || null;
  await db.collection("products").updateOne({ id: req.params.pid }, { $set: { out_of_stock_until: val } });
  res.json({ ok: true });
}));

// ==================== TAGS ====================
api.get("/admin/tags", requireAuth, wrap(async (req, res) => {
  const pipeline = [
    { $unwind: { path: "$tags", preserveNullAndEmptyArrays: false } },
    { $group: {
        _id: "$tags",
        product_count: { $sum: 1 },
        oos_products: { $sum: { $cond: [{ $ifNull: ["$out_of_stock_until", false] }, 1, 0] } },
        oos_dates: { $addToSet: "$out_of_stock_until" },
      } },
    { $sort: { _id: 1 } },
  ];
  const result = await db.collection("products").aggregate(pipeline).toArray();
  res.json(result.map(r => ({
    tag: r._id,
    product_count: r.product_count,
    oos_products: r.oos_products,
    oos_until: (r.oos_dates || []).find(d => d) || null,
  })));
}));
api.post("/admin/tags/oos", requireAuth, wrap(async (req, res) => {
  const tag = req.query.tag;
  const until = req.query.until || null;
  const r = await db.collection("products").updateMany({ tags: tag }, { $set: { out_of_stock_until: until } });
  res.json({ ok: true, affected: r.modifiedCount, tag, until });
}));

// ==================== CSV EXPORT / IMPORT ====================
const { stringify: csvStringify } = require("csv-stringify/sync");
const { parse: csvParse } = require("csv-parse/sync");

api.get("/products/export-csv", requireAuth, wrap(async (req, res) => {
  const cats = {};
  for (const c of await db.collection("categories").find({}, { projection: { _id: 0 } }).toArray()) cats[c.id] = c;
  const prods = await db.collection("products").find({}, { projection: { _id: 0 } }).sort({ menu_type: 1, category_id: 1, sort_order: 1 }).toArray();
  const rows = prods.map(p => {
    const cat = cats[p.category_id] || {};
    return {
      name: p.name || "",
      price: Number(p.price || 0).toFixed(2),
      category: cat.name || "",
      menu_type: p.menu_type || "",
      description: p.description || "",
      image_url: p.image_url || "",
      tags: (p.tags || []).join(";"),
      is_active: p.is_active === false ? "0" : "1",
      sort_order: p.sort_order || 0,
      out_of_stock_until: p.out_of_stock_until || "",
      variants: (p.variants || []).map(v =>
        `${String(v.name || "").replace(/\|/g, "/")}|${v.quantity ?? ""}|${v.price ?? ""}`
      ).join(";"),
    };
  });
  const columns = ["name", "price", "category", "menu_type", "description", "image_url", "tags", "is_active", "sort_order", "out_of_stock_until", "variants"];
  const csv = "\uFEFF" + csvStringify(rows, { header: true, columns });
  const filename = `produits-angeluccis-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  res.send(csv);
}));

api.post("/products/import-csv", requireAuth, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "file required" });
  const raw = req.file.buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows = csvParse(raw, { columns: true, skip_empty_lines: true });
  const cats = {};
  for (const c of await db.collection("categories").find({}, { projection: { _id: 0 } }).toArray()) {
    cats[c.name.toLowerCase()] = c;
  }
  let count = 0;
  for (const r of rows) {
    const name = r.name || r.nom;
    const price = r.price || r.prix;
    if (!name || !price) continue;
    const catName = String(r.category || r.categorie || "").toLowerCase();
    const menuType = String(r.menu || r.menu_type || "restaurant").toLowerCase();
    const cat = cats[catName];
    if (!cat) continue;
    const doc = normalizeProduct({
      name, description: r.description || "", price: Number(price) || 0,
      image_url: r.image || r.image_url || "", category_id: cat.id, menu_type: menuType,
    });
    await db.collection("products").insertOne({ ...doc });
    count++;
  }
  res.json({ imported: count });
}));

// ==================== UPLOADS ====================
async function storeImage(filename, buf, ext) {
  const contentType = MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream";
  await db.collection("uploads").replaceOne(
    { _id: filename },
    {
      _id: filename,
      data: new Binary(buf),
      content_type: contentType,
      size: buf.length,
      created_at: nowIso(),
    },
    { upsert: true }
  );
  return filename;
}

api.post("/upload", requireAuth, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "file required" });
  const ext = extOf(req.file.originalname);
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return res.status(400).json({ detail: "Format non supporté" });
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  await storeImage(name, req.file.buffer, ext);
  res.json({ url: `/api/uploads/${name}` });
}));

api.get("/uploads/:filename", wrap(async (req, res) => {
  const filename = req.params.filename;
  if (filename.includes("/") || filename.includes("..")) return res.status(400).json({ detail: "Bad filename" });
  const doc = await db.collection("uploads").findOne({ _id: filename });
  if (!doc) return res.status(404).json({ detail: "Image not found" });
  const data = doc.data?.buffer || doc.data;
  res.set({
    "Content-Type": doc.content_type || "application/octet-stream",
    "Cache-Control": "public, max-age=86400",
  });
  res.send(Buffer.isBuffer(data) ? data : Buffer.from(data));
}));

function parseProductFilename(filename) {
  const stem = filename.replace(/\.[^.]+$/, "");
  const matches = [...stem.matchAll(/\d+[.,]\d+|\d+/g)];
  let price = 0, namePart = stem;
  if (matches.length) {
    const last = matches[matches.length - 1];
    price = parseFloat(String(last[0]).replace(",", ".")) || 0;
    const candidate = stem.slice(0, last.index);
    if (candidate.replace(/[ _\-.,]/g, "")) namePart = candidate;
  }
  let name = namePart.replace(/[_\-.,]+/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/\s*(chf|fr|€|\$|eur)\s*$/i, "").trim();
  if (!name) name = stem.replace(/[_\-.,]+/g, " ").trim();
  return { name, price: Math.round(price * 100) / 100 };
}

api.post("/admin/products/upload", requireAuth, upload.single("file"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ detail: "file required" });
  const ext = extOf(req.file.originalname);
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return res.status(400).json({ detail: "Format non supporté" });
  const menuType = req.body.menu_type || req.query.menu_type || "restaurant";
  let categoryId = req.body.category_id || req.query.category_id || "";
  if (!["restaurant", "epicerie"].includes(menuType)) return res.status(400).json({ detail: "menu_type invalide" });
  const imgName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  await storeImage(imgName, req.file.buffer, ext);
  const parsed = parseProductFilename(req.file.originalname);
  if (!categoryId) {
    const cat = await db.collection("categories").findOne({ menu_type: menuType });
    if (!cat) return res.status(400).json({ detail: "Aucune catégorie disponible pour ce menu" });
    categoryId = cat.id;
  }
  const doc = {
    id: crypto.randomUUID(),
    name: parsed.name || "Nouveau produit",
    description: "",
    price: parsed.price,
    image_url: `/api/uploads/${imgName}`,
    category_id: categoryId,
    menu_type: menuType,
    addon_group_ids: [],
    out_of_stock_until: null,
    is_active: true,
    created_at: nowIso(),
  };
  await db.collection("products").insertOne({ ...doc });
  res.json({
    id: doc.id, name: doc.name, price: doc.price,
    image_url: doc.image_url, menu_type: doc.menu_type, category_id: doc.category_id,
    parsed_from: req.file.originalname,
  });
}));

// ==================== ORDERS: totals engine ====================
async function calcTotals(orderIn) {
  const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
  const vatRate = settings.vat_takeaway ?? 0.026;
  const subtotal = (orderIn.items || []).reduce((s, it) => s + (Number(it.line_total) || 0), 0);

  const nowIsoStr = nowIso();
  const promoTimeValid = pr => {
    const s = pr.starts_at, e = pr.ends_at;
    if (s && nowIsoStr < s) return false;
    if (e && nowIsoStr > e) return false;
    return true;
  };

  const pids = [...new Set((orderIn.items || []).map(it => it.product_id))];
  const prods = await db.collection("products").find({ id: { $in: pids } }, { projection: { _id: 0, id: 1, category_id: 1 } }).toArray();
  const pidToCat = Object.fromEntries(prods.map(p => [p.id, p.category_id]));

  function applyPromo(promo, cartItems, sub) {
    if (!promoTimeValid(promo)) return 0;
    if (sub < (promo.min_amount || 0)) return 0;
    const scope = promo.scope || "all";
    const pType = promo.type;
    const val = Number(promo.value) || 0;

    if (scope === "product") {
      const pid = promo.product_id;
      const target = cartItems.filter(it => it.product_id === pid);
      const base = target.reduce((s, it) => s + it.line_total, 0);
      if (base <= 0) return 0;
      if (pType === "percent") return base * (val / 100);
      if (pType === "fixed") return Math.min(val, base);
      if (pType === "bogo") return target.reduce((s, it) => {
        const unit = it.quantity ? it.line_total / it.quantity : 0;
        return s + Math.floor(it.quantity / 2) * unit;
      }, 0);
      return 0;
    }
    if (scope === "category") {
      const cid = promo.category_id;
      const target = cartItems.filter(it => pidToCat[it.product_id] === cid);
      const base = target.reduce((s, it) => s + it.line_total, 0);
      if (base <= 0) return 0;
      if (pType === "percent" || pType === "category_percent") return base * (val / 100);
      if (pType === "fixed") return Math.min(val, base);
      if (pType === "bogo") return target.reduce((s, it) => {
        const unit = it.quantity ? it.line_total / it.quantity : 0;
        return s + Math.floor(it.quantity / 2) * unit;
      }, 0);
      return 0;
    }
    if (pType === "percent") return sub * (val / 100);
    if (pType === "fixed") return Math.min(val, sub);
    if (pType === "bogo") return cartItems.reduce((s, it) => {
      const unit = it.quantity ? it.line_total / it.quantity : 0;
      return s + Math.floor(it.quantity / 2) * unit;
    }, 0);
    return 0;
  }

  let discount = 0, promoUsed = null;

  const autoPromos = await db.collection("promo_codes").find({ code: "", active: true }, { projection: { _id: 0 } }).toArray();
  let bestAuto = null, bestAmt = 0;
  for (const pr of autoPromos) {
    const amt = applyPromo(pr, orderIn.items, subtotal);
    if (amt > bestAmt) { bestAmt = amt; bestAuto = pr; }
  }
  if (bestAuto) { discount += bestAmt; promoUsed = "AUTO"; }

  if (orderIn.promo_code) {
    const promo = await db.collection("promo_codes").findOne({ code: String(orderIn.promo_code).toUpperCase(), active: true }, { projection: { _id: 0 } });
    if (promo) {
      const amt = applyPromo(promo, orderIn.items, subtotal);
      if (amt > 0) { discount += amt; promoUsed = promo.code; }
    }
  }

  const net = Math.max(0, subtotal - discount);
  const vatAmount = Math.round(net * vatRate / (1 + vatRate) * 100) / 100;
  const total = Math.round(net * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(discount * 100) / 100,
    vat_rate: vatRate,
    vat_amount: vatAmount,
    total,
    promo_code_used: promoUsed,
  };
}

// ==================== ORDERS ====================
api.post("/orders", wrap(async (req, res) => {
  const orderIn = req.body || {};
  const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
  if (settings.orders_enabled === false) return res.status(400).json({ detail: "Les commandes sont désactivées" });

  // Category time restrictions (Europe/Zurich)
  const nowHourFmt = new Intl.DateTimeFormat("en-CH", { timeZone: "Europe/Zurich", hour: "2-digit", hour12: false }).format(new Date());
  const nowHour = parseInt(nowHourFmt, 10);
  const prodIds = (orderIn.items || []).map(it => it.product_id);
  const prods = await db.collection("products").find({ id: { $in: prodIds } }, { projection: { _id: 0 } }).toArray();
  const catIds = [...new Set(prods.map(p => p.category_id).filter(Boolean))];
  if (catIds.length) {
    const cats = await db.collection("categories").find({ id: { $in: catIds } }, { projection: { _id: 0 } }).toArray();
    for (const c of cats) {
      const sh = c.restricted_start_hour, eh = c.restricted_end_hour;
      if (sh == null || eh == null) continue;
      const inWindow = sh < eh ? (sh <= nowHour && nowHour < eh) : (nowHour >= sh || nowHour < eh);
      if (inWindow) return res.status(400).json({
        detail: `La catégorie « ${c.name} » ne peut pas être commandée entre ${String(sh).padStart(2, "0")}h et ${String(eh).padStart(2, "0")}h (loi suisse).`,
      });
    }
  }

  const totals = await calcTotals(orderIn);
  const isOnline = orderIn.payment_method === "online";
  const order = {
    id: crypto.randomUUID(),
    order_number: genOrderNumber(),
    menu_type: orderIn.menu_type,
    fulfillment_type: orderIn.fulfillment_type,
    pickup_time: orderIn.pickup_time,
    pickup_time_label: orderIn.pickup_time === "ASAP" ? "Dès que possible" : orderIn.pickup_time,
    customer: orderIn.customer,
    items: orderIn.items || [],
    ...totals,
    status: isOnline ? "pending_payment" : "new",
    payment_method: orderIn.payment_method || "onsite",
    payment_status: isOnline ? "pending" : "onsite",
    deleted: false,
    created_at: nowIso(),
  };
  await db.collection("orders").insertOne({ ...order });

  if (isOnline) {
    try {
      const publicUrl = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
      const gw = await createGateway({
        amount_chf: order.total,
        reference_id: order.order_number,
        success_url: `${publicUrl}/suivi/${order.id}?paid=1`,
        failed_url: `${publicUrl}/suivi/${order.id}?paid=failed`,
        cancel_url: `${publicUrl}/checkout/${order.menu_type}`,
        webhook_url: `${publicUrl}/api/webhooks/payrexx`,
        customer_email: order.customer.email || "",
        customer_firstname: order.customer.first_name || "",
        customer_lastname: order.customer.last_name || "",
        purpose: `Angelucci's · Commande #${order.order_number}`,
      });
      await db.collection("orders").updateOne({ id: order.id }, { $set: { payrexx_gateway_id: gw.id, payrexx_hash: gw.hash } });
      return res.json({ id: order.id, order_number: order.order_number, total: order.total, payment_url: gw.link, payment_status: "pending" });
    } catch (e) {
      await db.collection("orders").deleteOne({ id: order.id });
      console.error(`Payrexx failure — order rolled back: ${e.message}`);
      return res.status(502).json({ detail: `Paiement en ligne indisponible : ${e.message}` });
    }
  }

  await notifyNewOrder(order);
  res.json({ id: order.id, order_number: order.order_number, total: order.total });
}));

async function notifyNewOrder(order) {
  // Marketing opt-in
  if (order.customer?.marketing_opt_in) {
    await db.collection("marketing_emails").updateOne(
      { email: order.customer.email },
      {
        $set: {
          email: order.customer.email,
          first_name: order.customer.first_name,
          last_name: order.customer.last_name,
          phone: order.customer.phone,
          source: "order",
          last_activity: nowIso(),
        },
        $inc: { order_count: 1 },
      },
      { upsert: true }
    );
  }

  try { await sendOrderConfirmation(order); await sendNewOrderNotification(order); }
  catch (e) { console.error(`Email failure: ${e.message}`); }

  try {
    const puToken = process.env.PUSHOVER_API_TOKEN;
    const puUser = process.env.PUSHOVER_USER_KEY;
    if (puToken && puUser) {
      const menuLabel = order.menu_type === "restaurant" ? "RESTAURANT" : "ÉPICERIE";
      const payLabel = order.payment_status === "paid" ? "PAYÉ EN LIGNE" : "À payer sur place";
      const body =
        `${menuLabel} · Commande #${order.order_number} · ${payLabel}\n` +
        `${order.customer.first_name} ${order.customer.last_name} · ${order.customer.phone}\n` +
        `Créneau : ${order.pickup_time_label}\n` +
        `Total : CHF ${Number(order.total).toFixed(2)}`;
      const axios = require("axios");
      await axios.post("https://api.pushover.net/1/messages.json",
        new URLSearchParams({
          token: puToken, user: puUser,
          title: "Nouvelle commande — Angelucci's",
          message: body,
          priority: "2", retry: "30", expire: "1800", sound: "siren",
        }),
        { timeout: 10000 }
      );
    }
  } catch (e) { console.error(`Pushover failure: ${e.message}`); }
}

// ---- Payrexx webhook (form-urlencoded from Payrexx) ----
api.post("/webhooks/payrexx", wrap(async (req, res) => {
  const payload = req.body || {};
  const tx = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.startsWith("transaction[")) tx[k.slice("transaction[".length, -1)] = v;
  }
  const ref = tx.referenceId || payload.referenceId;
  const status = String(tx.status || "").toLowerCase();
  console.log(`Payrexx webhook: ref=${ref} status=${status}`);
  if (!ref) return res.json({ ok: true, ignored: "no referenceId" });
  const order = await db.collection("orders").findOne({ order_number: ref }, { projection: { _id: 0 } });
  if (!order) return res.json({ ok: true, ignored: "order not found" });

  if (["confirmed", "authorized", "reserved"].includes(status)) {
    if (order.status === "pending_payment") {
      await db.collection("orders").updateOne(
        { id: order.id },
        { $set: { status: "new", payment_status: "paid", payrexx_tx_status: status } }
      );
      const fresh = await db.collection("orders").findOne({ id: order.id }, { projection: { _id: 0 } });
      await notifyNewOrder(fresh);
    }
  } else if (["cancelled", "declined", "error", "refunded"].includes(status)) {
    await db.collection("orders").updateOne(
      { id: order.id, status: "pending_payment" },
      { $set: { status: "rejected", payment_status: status, payrexx_tx_status: status } }
    );
  }
  res.json({ ok: true, ref, status });
}));

api.get("/orders/:id", wrap(async (req, res) => {
  const o = await db.collection("orders").findOne({ id: req.params.id, deleted: { $ne: true } }, { projection: { _id: 0 } });
  if (!o) return res.status(404).json({ detail: "Not found" });
  res.json(o);
}));

api.get("/admin/orders", requireAuth, wrap(async (req, res) => {
  const q = { deleted: { $ne: true }, status: { $ne: "pending_payment" } };
  if (req.query.status) q.status = req.query.status;
  const docs = await db.collection("orders").find(q, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(500).toArray();
  res.json(docs);
}));

api.patch("/admin/orders/:id/status", requireAuth, wrap(async (req, res) => {
  const status = req.query.status;
  if (!["new", "preparing", "ready", "done", "rejected"].includes(status)) return res.status(400).json({ detail: "Invalid status" });
  const prev = await db.collection("orders").findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!prev) return res.status(404).json({ detail: "Not found" });
  await db.collection("orders").updateOne({ id: req.params.id }, { $set: { status } });
  if (status === "preparing" && prev.status === "new") {
    try {
      const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
      const header = {
        name: (settings.restaurant_name || "Farmacia Angelucci").toUpperCase(),
        address: settings.address || "",
        phone: settings.phone || "",
        website: "angeluccis.ch",
      };
      await prn.enqueueOrderPrints(db, prev, header);
    } catch (e) { console.error(`print enqueue failed: ${e.message}`); }
  }
  res.json({ ok: true });
}));

api.post("/admin/orders/:id/reprint", requireAuth, wrap(async (req, res) => {
  const order = await db.collection("orders").findOne({ id: req.params.id }, { projection: { _id: 0 } });
  if (!order) return res.status(404).json({ detail: "Not found" });
  await db.collection("print_jobs").deleteMany({ order_id: req.params.id });
  const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
  const header = {
    name: (settings.restaurant_name || "Farmacia Angelucci").toUpperCase(),
    address: settings.address || "",
    phone: settings.phone || "",
    website: "angeluccis.ch",
  };
  await prn.enqueueOrderPrints(db, order, header);
  res.json({ ok: true });
}));

api.patch("/admin/orders/:id/reschedule", requireAuth, wrap(async (req, res) => {
  const { pickup_time, pickup_time_label } = req.query;
  const r = await db.collection("orders").updateOne(
    { id: req.params.id },
    { $set: { pickup_time, pickup_time_label } }
  );
  if (r.matchedCount === 0) return res.status(404).json({ detail: "Order not found" });
  res.json({ ok: true });
}));

api.delete("/admin/orders/:id", requireAuth, wrap(async (req, res) => {
  await db.collection("orders").updateOne({ id: req.params.id }, { $set: { deleted: true } });
  res.json({ ok: true });
}));

// ==================== RESERVATIONS ====================
api.post("/reservations", wrap(async (req, res) => {
  const r = req.body || {};
  if (r.honeypot) return res.json({ id: "spam", status: "confirmed" });
  const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
  if (settings.reservations_enabled === false) return res.status(400).json({ detail: "Les réservations sont désactivées" });

  const ip = getClientIp(req);
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const recent = await db.collection("reservations").countDocuments({ ip, created_at: { $gte: since } });
  if (recent >= 3) return res.status(429).json({ detail: "Trop de réservations récentes, réessayez plus tard" });

  try {
    const resDt = new Date(`${r.date}T${r.time}:00`);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const resDay = new Date(resDt); resDay.setHours(0, 0, 0, 0);
    if (isNaN(resDt.getTime())) return res.status(400).json({ detail: "Date/heure invalide" });
    if (resDay.getTime() === today.getTime() && resDt.getTime() < Date.now() + 30 * 60 * 1000) {
      return res.status(400).json({ detail: "Délai minimum 30 min pour aujourd'hui" });
    }
  } catch { return res.status(400).json({ detail: "Date/heure invalide" }); }

  const doc = {
    id: crypto.randomUUID(),
    first_name: r.first_name,
    phone: r.phone,
    email: r.email,
    date: r.date,
    time: r.time,
    people: r.people,
    comment: r.comment || "",
    status: "confirmed",
    seen_by_admin: false,
    ip,
    created_at: nowIso(),
  };
  await db.collection("reservations").insertOne({ ...doc });

  await db.collection("marketing_emails").updateOne(
    { email: r.email },
    {
      $set: { email: r.email, first_name: r.first_name, phone: r.phone, source: "reservation", last_activity: nowIso() },
      $inc: { reservation_count: 1 },
    },
    { upsert: true }
  );

  try { await sendReservationConfirmation(doc); }
  catch (e) { console.error(`Reservation email failure: ${e.message}`); }

  try {
    const puToken = process.env.PUSHOVER_API_TOKEN;
    const puUser = process.env.PUSHOVER_USER_KEY;
    if (puToken && puUser) {
      const body = `RÉSERVATION · ${doc.date} · ${doc.time}\n${doc.first_name} · ${doc.phone}\nPersonnes : ${doc.people}` + (doc.comment ? `\nCommentaire : ${doc.comment}` : "");
      const axios = require("axios");
      await axios.post("https://api.pushover.net/1/messages.json",
        new URLSearchParams({
          token: puToken, user: puUser,
          title: "Nouvelle réservation — Angelucci's",
          message: body,
          priority: "2", retry: "30", expire: "1800", sound: "siren",
        }),
        { timeout: 10000 }
      );
    }
  } catch (e) { console.error(`Pushover reservation failure: ${e.message}`); }

  res.json({ id: doc.id, status: "confirmed" });
}));

api.get("/admin/reservations", requireAuth, wrap(async (req, res) => {
  const docs = await db.collection("reservations").find({}, { projection: { _id: 0, ip: 0 } }).sort({ date: -1 }).limit(500).toArray();
  res.json(docs);
}));

api.patch("/admin/reservations/:rid/status", requireAuth, wrap(async (req, res) => {
  const status = req.query.status;
  if (!["confirmed", "cancelled", "done"].includes(status)) return res.status(400).json({ detail: "Invalid status" });
  await db.collection("reservations").updateOne({ id: req.params.rid }, { $set: { status, seen_by_admin: true } });
  res.json({ ok: true });
}));

api.patch("/admin/reservations/:rid/seen", requireAuth, wrap(async (req, res) => {
  await db.collection("reservations").updateOne({ id: req.params.rid }, { $set: { seen_by_admin: true } });
  res.json({ ok: true });
}));

// ==================== PROMOS ====================
function normalizePromo(body) {
  return {
    id: body.id || crypto.randomUUID(),
    code: String(body.code || "").toUpperCase().trim(),
    type: body.type,
    value: Number(body.value) || 0,
    min_amount: Number(body.min_amount) || 0,
    scope: body.scope || "all",
    product_id: body.product_id || null,
    category_id: body.category_id || null,
    active: body.active !== false,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    created_at: body.created_at || nowIso(),
  };
}
api.get("/admin/promos", requireAuth, wrap(async (req, res) => {
  const docs = await db.collection("promo_codes").find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).limit(500).toArray();
  res.json(docs);
}));
api.post("/admin/promos", requireAuth, wrap(async (req, res) => {
  const doc = normalizePromo(req.body || {});
  await db.collection("promo_codes").insertOne({ ...doc });
  res.json(doc);
}));
api.patch("/admin/promos/:pid", requireAuth, wrap(async (req, res) => {
  const active = req.query.active === "true";
  await db.collection("promo_codes").updateOne({ id: req.params.pid }, { $set: { active } });
  res.json({ ok: true });
}));
api.delete("/admin/promos/:pid", requireAuth, wrap(async (req, res) => {
  await db.collection("promo_codes").deleteOne({ id: req.params.pid });
  res.json({ ok: true });
}));

// ==================== MARKETING (owner) ====================
api.get("/admin/marketing-emails", requireAuth, requireOwner, wrap(async (req, res) => {
  const docs = await db.collection("marketing_emails").find({}, { projection: { _id: 0 } }).sort({ last_activity: -1 }).limit(2000).toArray();
  res.json(docs);
}));

// ==================== ACCOUNTING PDF ====================
api.get("/admin/accounting/pdf", requireAuth, wrap(async (req, res) => {
  const month = parseInt(req.query.month, 10);
  const year = parseInt(req.query.year, 10);
  if (!month || !year) return res.status(400).json({ detail: "month & year required" });
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = month === 12
    ? new Date(Date.UTC(year + 1, 0, 1)).toISOString()
    : new Date(Date.UTC(year, month, 1)).toISOString();
  const orders = await db.collection("orders").find(
    { deleted: { $ne: true }, created_at: { $gte: start, $lt: end } },
    { projection: { _id: 0 } }
  ).limit(5000).toArray();
  const settings = await db.collection("settings").findOne({ _id: "settings" }) || {};
  const pdfBuffer = await buildAccountingPdf(month, year, orders, settings.restaurant_name || "Angelucci's");
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="comptabilite-${year}-${String(month).padStart(2, "0")}.pdf"`,
  });
  res.send(pdfBuffer);
}));

// ==================== CLOUDPRNT ====================
api.post("/cloudprnt/poll", wrap(async (req, res) => {
  const job = await prn.nextPendingJob(db);
  if (!job) return res.json({ jobReady: false });
  res.json({ jobReady: true, mediaTypes: ["text/plain"], jobToken: job.id });
}));

api.get("/cloudprnt/poll", wrap(async (req, res) => {
  const token = req.query.token;
  let job = null;
  if (token) job = await db.collection("print_jobs").findOne({ id: token });
  if (!job) job = await prn.nextPendingJob(db);
  if (!job) return res.status(404).end();
  await prn.markDownloaded(db, job.id);
  let payload = job.payload;
  if (payload && payload.buffer) payload = Buffer.from(payload.buffer);
  else if (!Buffer.isBuffer(payload)) payload = Buffer.from(payload || "", "latin1");
  res.set("Content-Type", "text/plain");
  res.send(payload);
}));

api.delete("/cloudprnt/poll", wrap(async (req, res) => {
  const token = req.query.token;
  if (token) await prn.markPrinted(db, token);
  else {
    const job = await db.collection("print_jobs").findOne({ status: "downloaded" }, { sort: { downloaded_at: 1 } });
    if (job) await prn.markPrinted(db, job.id);
  }
  res.status(200).end();
}));

api.get("/admin/print-jobs", requireAuth, wrap(async (req, res) => {
  const docs = await db.collection("print_jobs").find({}, { projection: { _id: 0, payload: 0 } }).sort({ created_at: -1 }).limit(50).toArray();
  res.json(docs);
}));

// ==================== ROOT ====================
api.get("/", (req, res) => res.json({ message: "Angelucci's API" }));

app.use("/api", api);

// ---- Error handler (last) ----
app.use((err, req, res, next) => {
  console.error("Unhandled:", err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ detail: err.message || "Internal server error" });
});

// ---- Start ----
async function main() {
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  await seedDb(db);
  console.log("DB seeded / verified.");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Angelucci's API — listening on 0.0.0.0:${PORT}`);
  });
}

process.on("SIGTERM", async () => { await mongoClient.close(); process.exit(0); });
process.on("SIGINT", async () => { await mongoClient.close(); process.exit(0); });

main().catch(e => { console.error("Startup failed:", e); process.exit(1); });
