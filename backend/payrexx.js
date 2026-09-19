/**
 * Payrexx gateway helper — port of backend/payrexx.py.
 * Signature: base64( HMAC-SHA256( urlencoded_query_string_without_instance, api_secret ) )
 */
const crypto = require("crypto");
const axios = require("axios");

const BASE = "https://api.payrexx.com/v1.0";

function urlencode(obj) {
  // Node's URLSearchParams uses application/x-www-form-urlencoded (+ for spaces).
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) params.append(k, String(v));
  return params.toString();
}

function sign(payload, secret) {
  const qs = urlencode(payload);
  return crypto.createHmac("sha256", secret).update(qs).digest("base64");
}

function flatten(obj, parentKey = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = parentKey ? `${parentKey}[${k}]` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

async function createGateway({
  amount_chf, reference_id, success_url, failed_url, cancel_url, webhook_url,
  customer_email = "", customer_firstname = "", customer_lastname = "", purpose = "",
}) {
  const instance = (process.env.PAYREXX_INSTANCE || "").trim();
  const secret = (process.env.PAYREXX_API_SECRET || "").trim();
  if (!instance || !secret) throw new Error("PAYREXX_INSTANCE / PAYREXX_API_SECRET missing in .env");

  const fields = {};
  if (customer_email) fields.email = { value: customer_email, mandatory: 1 };
  if (customer_firstname) fields.forename = { value: customer_firstname, mandatory: 0 };
  if (customer_lastname) fields.surname = { value: customer_lastname, mandatory: 0 };

  let raw = {
    amount: Math.round(amount_chf * 100),
    currency: "CHF",
    referenceId: reference_id,
    purpose: (purpose || `Commande ${reference_id}`).slice(0, 200),
    successRedirectUrl: success_url,
    failedRedirectUrl: failed_url,
    cancelRedirectUrl: cancel_url,
  };
  if (Object.keys(fields).length) raw = { ...raw, ...flatten({ fields }) };

  const signature = sign(raw, secret);
  const body = { ...raw, ApiSignature: signature };
  const url = `${BASE}/Gateway/?instance=${instance}`;

  const resp = await axios.post(url, urlencode(body), {
    timeout: 15000,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    validateStatus: () => true,
  });
  if (resp.status >= 400) {
    console.error(`Payrexx ${resp.status}: ${JSON.stringify(resp.data).slice(0, 1000)}`);
    throw new Error(`Payrexx HTTP ${resp.status}`);
  }
  const data = resp.data;
  if (data.status !== "success") {
    console.error(`Payrexx create_gateway failed: ${JSON.stringify(data)}`);
    throw new Error(`Payrexx error: ${data.message || "unknown"}`);
  }
  const first = (data.data || [{}])[0];
  return { id: first.id, hash: first.hash, link: first.link };
}

module.exports = { createGateway };
