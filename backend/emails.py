"""Email sending via Resend + HTML templates."""
import os
import asyncio
import logging
import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
RESTAURANT_EMAIL = os.environ.get("RESTAURANT_EMAIL", "")
RESTAURANT_NAME = os.environ.get("RESTAURANT_NAME", "Angelucci's")
RESTAURANT_PHONE = os.environ.get("RESTAURANT_PHONE", "")
RESTAURANT_ADDRESS = os.environ.get("RESTAURANT_ADDRESS", "")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


BRAND_COLOR = "#7FA9A8"
DARK = "#1A1C18"


def _wrap(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; background:#FDFBF7; padding:24px; color:{DARK};">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#FDFBF7;">
        <tr><td style="padding:24px 16px;text-align:center;background:{BRAND_COLOR};color:#fff;">
          <h1 style="margin:0;font-size:28px;letter-spacing:2px;">{RESTAURANT_NAME.upper()}</h1>
          <p style="margin:6px 0 0;font-size:13px;font-style:italic;">la qualità a discapito della quantità</p>
        </td></tr>
        <tr><td style="padding:32px 24px;background:#F5F2EA;">
          <h2 style="margin:0 0 16px;color:{DARK};font-weight:500;">{title}</h2>
          {body_html}
        </td></tr>
        <tr><td style="padding:16px;text-align:center;font-size:12px;color:#5C6057;">
          {RESTAURANT_ADDRESS}<br/>{RESTAURANT_PHONE}
        </td></tr>
      </table>
    </div>
    """


async def _send(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning(f"[EMAIL SKIPPED — no RESEND_API_KEY] to={to} subject={subject}")
        return False
    try:
        params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
        await asyncio.to_thread(resend.Emails.send, params)
        return True
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return False


def _fmt_price(v: float) -> str:
    return f"CHF {v:.2f}"


async def send_order_confirmation(order: dict) -> None:
    items_html = ""
    for it in order["items"]:
        addons = ""
        if it.get("selected_addons"):
            addons = " · " + ", ".join(a["name"] for a in it["selected_addons"])
        note = f"<br/><em style='color:#5C6057;font-size:12px;'>Note : {it['note']}</em>" if it.get("note") else ""
        items_html += f"""
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06);">
            <strong>{it['quantity']}× {it['name']}</strong>{addons}{note}
          </td>
          <td style="padding:8px 0;text-align:right;border-bottom:1px solid rgba(0,0,0,.06);">
            {_fmt_price(it['line_total'])}
          </td>
        </tr>"""

    body = f"""
    <p>Bonjour {order['customer']['first_name']},</p>
    <p>Merci pour votre commande <strong>#{order['order_number']}</strong>.</p>
    <p><strong>Mode :</strong> {order['fulfillment_type']}<br/>
    <strong>Créneau :</strong> {order.get('pickup_time_label', 'ASAP')}<br/>
    <strong>Menu :</strong> {order['menu_type']}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">{items_html}
      <tr><td style="padding-top:12px;">Sous-total (HT)</td><td style="text-align:right;">{_fmt_price(order['subtotal'])}</td></tr>
      <tr><td>TVA ({order['vat_rate']*100:.1f}%)</td><td style="text-align:right;">{_fmt_price(order['vat_amount'])}</td></tr>"""
    if order.get("discount_amount", 0) > 0:
        body += f"<tr><td>Réduction</td><td style='text-align:right;'>−{_fmt_price(order['discount_amount'])}</td></tr>"
    body += f"""
      <tr><td style="padding-top:8px;font-size:16px;"><strong>Total</strong></td>
          <td style="text-align:right;padding-top:8px;font-size:16px;"><strong>{_fmt_price(order['total'])}</strong></td></tr>
    </table>
    <p style="padding:12px;background:{BRAND_COLOR};color:#fff;"><strong>Paiement sur place</strong> (Twint, cash ou carte).</p>
    <p style="color:#991B1B;">⚠ Si votre commande n'est pas confirmée sous 2 min, appelez-nous au <a href="tel:{RESTAURANT_PHONE}" style="color:#991B1B;">{RESTAURANT_PHONE}</a>.</p>
    <p>À bientôt,<br/>L'équipe {RESTAURANT_NAME}</p>
    """
    await _send(order["customer"]["email"], f"Confirmation commande #{order['order_number']}", _wrap("Votre commande est confirmée", body))


async def send_reservation_confirmation(res: dict) -> None:
    body = f"""
    <p>Bonjour {res['first_name']},</p>
    <p>Votre réservation est <strong style="color:{BRAND_COLOR};">confirmée</strong>.</p>
    <table style="margin:16px 0;font-size:15px;">
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Date</td><td><strong>{res['date']}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Heure</td><td><strong>{res['time']}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#5C6057;">Personnes</td><td><strong>{res['people']}</strong></td></tr>
    </table>
    <p>En cas d'imprévu, appelez-nous au <a href="tel:{RESTAURANT_PHONE}">{RESTAURANT_PHONE}</a>.</p>
    <p>À très vite,<br/>L'équipe {RESTAURANT_NAME}</p>
    """
    await _send(res["email"], "Réservation confirmée", _wrap("Réservation confirmée", body))

    # Notify restaurant
    if RESTAURANT_EMAIL:
        rbody = f"""
        <p><strong>Nouvelle réservation</strong></p>
        <ul>
          <li>Client : {res['first_name']} — {res.get('phone', '')}</li>
          <li>Email : {res['email']}</li>
          <li>Date : {res['date']} · {res['time']}</li>
          <li>Personnes : {res['people']}</li>
          <li>Commentaire : {res.get('comment', '—')}</li>
        </ul>
        """
        await _send(RESTAURANT_EMAIL, f"Nouvelle réservation — {res['date']} {res['time']}", _wrap("Nouvelle réservation", rbody))


async def send_new_order_notification(order: dict) -> None:
    if not RESTAURANT_EMAIL:
        return
    body = f"""
    <p><strong>Nouvelle commande #{order['order_number']}</strong></p>
    <p>Client : {order['customer']['first_name']} {order['customer']['last_name']} — {order['customer']['phone']}<br/>
    Mode : {order['fulfillment_type']} · Créneau : {order.get('pickup_time_label', 'ASAP')}<br/>
    Menu : {order['menu_type']} · Total : <strong>{_fmt_price(order['total'])}</strong></p>
    """
    await _send(RESTAURANT_EMAIL, f"Commande #{order['order_number']} — {order['menu_type']}", _wrap("Nouvelle commande", body))
