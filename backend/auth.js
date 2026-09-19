/**
 * JWT authentication with bcryptjs — mirror of backend/auth.py.
 * Users are loaded from env at boot with hashed passwords in memory.
 */
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALG = "HS256";
const JWT_EXP_HOURS = 24;

if (!JWT_SECRET) throw new Error("JWT_SECRET missing in .env");

const USERS = {};
function loadUsers() {
  const admin = process.env.ADMIN_USERNAME;
  const adminPw = process.env.ADMIN_PASSWORD;
  const staff = process.env.STAFF_USERNAME;
  const staffPw = process.env.STAFF_PASSWORD;
  if (!admin || !adminPw) throw new Error("ADMIN_USERNAME / ADMIN_PASSWORD required");
  USERS[admin] = { username: admin, hash: bcrypt.hashSync(adminPw, 10), role: "owner" };
  if (staff && staffPw) {
    USERS[staff] = { username: staff, hash: bcrypt.hashSync(staffPw, 10), role: "staff" };
  }
}
loadUsers();

function verifyCredentials(username, password) {
  const u = USERS[username];
  if (!u) return null;
  if (!bcrypt.compareSync(password, u.hash)) return null;
  return { username: u.username, role: u.role };
}

function createToken(username, role) {
  return jwt.sign({ sub: username, role }, JWT_SECRET, {
    algorithm: JWT_ALG,
    expiresIn: `${JWT_EXP_HOURS}h`,
  });
}

function decodeToken(token) {
  return jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
}

/** Express middleware — 401 if not authenticated. Populates req.user. */
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return res.status(401).json({ detail: "Not authenticated" });
  try {
    const payload = decodeToken(h.slice(7));
    req.user = { username: payload.sub, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ detail: e.name === "TokenExpiredError" ? "Token expired" : "Invalid token" });
  }
}

function requireOwner(req, res, next) {
  if (req.user?.role !== "owner") return res.status(403).json({ detail: "Owner access required" });
  next();
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return String(fwd).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

module.exports = { verifyCredentials, createToken, requireAuth, requireOwner, getClientIp };
