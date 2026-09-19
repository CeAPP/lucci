/** Resend email templates — direct port of backend/emails.py */
const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";
const RESTAURANT_EMAIL = process.env.RESTAURANT_EMAIL || "";
const RESTAURANT_NAME = process.env.RESTAURANT_NAME || "Angelucci's";
const RESTAURANT_PHONE = process.env.RESTAURANT_PHONE || "";
const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || "";
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "";

const client = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const BRAND = "#7FA9A8";
const DARK = "#1A1C18";

const money = v => `CHF ${Number(v || 0).toFixed(2)}`;

function wrapHtml(title, body) {
  return `
    <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;background:#FDFBF7;padding:24px;color:${DARK};">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FDFBF7;">
        <tr><td style="padding:24px 16px;text-align:center;background:${BRAND};color:#fff;">
          <h1 style="margin:0;font-size:28px;letter-spacing:2px;">${RESTAURANT_NAME.toUpperCase()}</h1>
          <p style="margin:6px 0 0;font-size:13px;font-style:italic;">la qualità a discapito della quantità</p>
        </td></tr>
        <tr><td style="padding:32px 24px;background:#F5F2EA;">
          <h2 style="margin:0 0 16px;color:${DARK};font-weight:500;">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="padding:16px;text-align:center;font-size:12px;color:#5C6057;">
          ${RESTAURANT_ADDRESS}<br/>${RESTAURANT_PHONE}
        </td></tr>
      </table>
    </div>`;
}

async function send(to, subject, html) {
  if (!client) {
    console.warn(`[EMAIL SKIPPED — no RESEND_API_KEY] to=${to} subject=${subject}`);
    return false;
  }
  try {
    await client.emails.send({ from: SENDER_EMAIL, to: [to], subject, html });
    return true;
  } catch (e) {
    console.error(`Email failed: ${e.message}`);
    return false;
  }
}

async function sendOrderConfirmation(order) {
  let items = "";
  for (const it of order.items) {
    const addons = it.selected_addons?.length ? " · " + it.selected_addons.map(a => a.name).join(", ") : "";
    const note = it.note ? `<br/><em style='color:#5C6057;font-size:12px;'>Note : ${it.note}</em>` : "";
    items += `<tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);">
        <strong>${it.quantity}× ${it.name}</strong>${addons}${note}
      </td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(0,0,0,.06);">${money(it.line_total)}</td>
    </tr>`;
  }
  let body = `
    <p>Bonjour ${order.customer.first_name},</p>
    <p>Merci pour votre commande <strong>#${order.order_number}</strong>.</p>
    <p><strong>Mode :</strong> ${order.fulfillment_type}<br/>
    <strong>Créneau :</strong> ${order.pickup_time_label || "ASAP"}<br/>
    <strong>Menu :</strong> ${order.menu_type}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${items}
      <tr><td style="padding-top:12px;">Sous-total (HT)</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
      <tr><td>TVA (${(order.vat_rate * 100).toFixed(1)}%)</td><td style="text-align:right;">${money(order.vat_amount)}</td></tr>`;
  if ((order.discount_amount || 0) > 0) {
    body += `<tr><td>Réduction</td><td style="text-align:right;">−${money(order.discount_amount)}</td></tr>`;
  }
  body += `
      <tr><td style="padding-top:8px;font-size:16px;"><strong>Total</strong></td>
          <td style="text-align:right;padding-top:8px;font-size:16px;"><strong>${money(order.total)}</strong></td></tr>
    </table>
    <p style="padding:12px;background:${BRAND};color:#fff;"><strong>Paiement sur place</strong> (Twint, cash ou carte).</p>
    <p style="text-align:center;margin:20px 0;"><a href="${PUBLIC_SITE_URL}/suivi/${order.id}" style="display:inline-block;padding:12px 24px;background:${DARK};color:#fff;text-decoration:none;letter-spacing:1px;font-size:13px;">SUIVRE MA COMMANDE →</a></p>
    <p style="color:#991B1B;">⚠ Si votre commande n'est pas confirmée sous 2 min, appelez-nous au <a href="tel:${RESTAURANT_PHONE}" style="color:#991B1B;">${RESTAURANT_PHONE}</a>.</p>
    <p>À bientôt,<br/>L'équipe ${RESTAURANT_NAME}</p>`;
  await send(order.customer.email, `Confirmation commande #${order.order_number}`, wrapHtml("Votre commande est confirmée", body));
}

async function sendReservationConfirmation(res) {
  const body = `
    <p>Bonjour ${res.first_name},</p>
    <p>Votre réservation est <strong style="color:${BRAND};">confirmée</strong>.</p>
    <table style="margin:16px 0;font-size:15px;">
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Date</td><td><strong>${res.date}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Heure</td><td><strong>${res.time}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Personnes</td><td><strong>${res.people}</strong></td></tr>
    </table>
    <p>En cas d'imprévu, appelez-nous au <a href="tel:${RESTAURANT_PHONE}">${RESTAURANT_PHONE}</a>.</p>
    <p>À très vite,<br/>L'équipe ${RESTAURANT_NAME}</p>`;
  await send(res.email, "Réservation confirmée", wrapHtml("Réservation confirmée", body));

  if (RESTAURANT_EMAIL) {
    const rbody = `
      <p><strong>Nouvelle réservation</strong></p>
      <ul>
        <li>Client : ${res.first_name} — ${res.phone || ""}</li>
        <li>Email : ${res.email}</li>
        <li>Date : ${res.date} · ${res.time}</li>
        <li>Personnes : ${res.people}</li>
        <li>Commentaire : ${res.comment || "—"}</li>
      </ul>`;
    await send(RESTAURANT_EMAIL, `Nouvelle réservation — ${res.date} ${res.time}`, wrapHtml("Nouvelle réservation", rbody));
  }
}

async function sendNewOrderNotification(order) {
  if (!RESTAURANT_EMAIL) return;
  const body = `
    <p><strong>Nouvelle commande #${order.order_number}</strong></p>
    <p>Client : ${order.customer.first_name} ${order.customer.last_name} — ${order.customer.phone}<br/>
    Mode : ${order.fulfillment_type} · Créneau : ${order.pickup_time_label || "ASAP"}<br/>
    Menu : ${order.menu_type} · Total : <strong>${money(order.total)}</strong></p>`;
  await send(RESTAURANT_EMAIL, `Commande #${order.order_number} — ${order.menu_type}`, wrapHtml("Nouvelle commande", body));
}

module.exports = { sendOrderConfirmation, sendReservationConfirmation, sendNewOrderNotification };
