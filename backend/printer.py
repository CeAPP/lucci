"""Star CloudPRNT integration — mC-Print2 (58mm, 32 chars/line).

Protocol overview (Star CloudPRNT):
    1. Printer POSTs to /api/cloudprnt/poll every few seconds.
       - We respond {"jobReady": true, "mediaTypes": ["text/plain"]} if a job
         is pending, otherwise {"jobReady": false}.
    2. If jobReady, the printer immediately GETs the same URL.
       - We respond with Content-Type: text/plain and the ESC/POS bytes.
    3. After printing, the printer sends a DELETE to the same URL.
       - We mark the job as printed.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

# ---------- Star Line Mode commands (mC-Print2 default firmware mode) ----------
# NB: mC-Print2 CloudPRNT expects Star Line Mode by default. ESC/POS GS-prefix
# commands (e.g. GS V, GS !) are printed literally, so we use ESC-prefix Star
# equivalents everywhere.
ESC = b"\x1b"
LF = b"\n"

INIT           = ESC + b"@"              # initialize
BOLD_ON        = ESC + b"E"              # emphasize on
BOLD_OFF       = ESC + b"F"              # emphasize off (Star Line Mode)
ALIGN_LEFT     = ESC + b"\x1d\x61\x00"   # align left  (Star: ESC GS a n)
ALIGN_CENTER   = ESC + b"\x1d\x61\x01"   # align center
ALIGN_RIGHT    = ESC + b"\x1d\x61\x02"   # align right
DBL_H_ON       = ESC + b"h\x01"          # double height on
DBL_H_OFF      = ESC + b"h\x00"
DBL_W_ON       = ESC + b"W\x01"          # double width on
DBL_W_OFF      = ESC + b"W\x00"
# "big" = double width + double height
SIZE_DBL_H     = DBL_W_OFF + DBL_H_ON
SIZE_DBL_BOTH  = DBL_W_ON  + DBL_H_ON
SIZE_NORMAL    = DBL_W_OFF + DBL_H_OFF
# Star: ESC d n → feed to cut position and full/partial cut
CUT            = ESC + b"d\x02"          # feed + full cut
FEED3          = b"\n\n\n"

LINE_WIDTH = 32
SEP        = b"-" * LINE_WIDTH + LF
DSEP       = b"=" * LINE_WIDTH + LF


# ---------- Text helpers ----------
def _strip_accents(s: str) -> str:
    """Replace common accented characters to keep the ESC/POS default codepage safe."""
    import unicodedata
    if not s:
        return ""
    nkfd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nkfd if not unicodedata.combining(c))


def _b(text: str) -> bytes:
    return _strip_accents(text).encode("cp437", errors="replace")


def _line(text: str = "") -> bytes:
    return _b(text) + LF


def _row(left: str, right: str, width: int = LINE_WIDTH) -> bytes:
    """Left/right justify on `width` characters (truncate/pad left col if needed)."""
    left = _strip_accents(left or "")
    right = _strip_accents(right or "")
    max_left = max(1, width - len(right) - 1)
    if len(left) > max_left:
        left = left[: max_left - 1] + "."
    return (left + " " * (width - len(left) - len(right)) + right).encode("cp437", errors="replace") + LF


def _wrap(text: str, width: int = LINE_WIDTH) -> list[str]:
    """Simple word-wrap that never breaks a word longer than `width`."""
    text = _strip_accents(text or "").strip()
    if not text:
        return []
    words, lines, cur = text.split(), [], ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= width:
            cur += " " + w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _money(v: float) -> str:
    try:
        return f"{float(v):.2f}"
    except Exception:
        return "0.00"


def _fmt_dt(iso: str) -> str:
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.astimezone(ZoneInfo("Europe/Zurich")).strftime("%d.%m.%Y %H:%M")
    except Exception:
        return iso or ""


def _fmt_pickup(order: dict) -> str:
    """Format `pickup_time` (either 'ASAP' or ISO) into a friendly HH:MM label."""
    label = order.get("pickup_time_label")
    if label and label != "ASAP":
        return label
    pt = order.get("pickup_time") or ""
    if pt == "ASAP":
        return "Des que possible"
    try:
        from zoneinfo import ZoneInfo
        dt = datetime.fromisoformat(pt.replace("Z", "+00:00"))
        return dt.astimezone(ZoneInfo("Europe/Zurich")).strftime("%d.%m %H:%M")
    except Exception:
        return pt


# ---------- Ticket builders ----------
def _fmt_pay(order: dict) -> str:
    pm = order.get("payment_method")
    ps = order.get("payment_status")
    if pm == "online":
        if ps in ("paid", "confirmed"):
            return "En ligne (PAYE)"
        return "En ligne"
    return "Sur place"


def build_client_ticket(order: dict, header: dict) -> bytes:
    """Full customer receipt with prices & totals."""
    out = bytearray()
    out += INIT
    # --- Header (centered, large) ---
    out += ALIGN_CENTER + BOLD_ON + SIZE_DBL_BOTH
    out += _line(header.get("name") or "FARMACIA ANGELUCCI")
    out += SIZE_NORMAL + BOLD_OFF
    if header.get("address"):
        out += _line(header["address"])
    if header.get("phone"):
        out += _line(f"Tel: {header['phone']}")
    if header.get("website"):
        out += _line(header["website"])
    out += LF
    out += ALIGN_LEFT + SEP

    # --- Order meta ---
    out += BOLD_ON + SIZE_DBL_H
    out += _line(f"CMD #{order.get('order_number', '')}")
    out += SIZE_NORMAL + BOLD_OFF
    out += _line(f"Date : {_fmt_dt(order.get('created_at', ''))}")
    ftype = "Vente a l'emporter" if order.get("fulfillment_type") == "takeaway" else "Livraison"
    out += _line(f"Type : {ftype}")
    out += _line(f"Retrait : {_fmt_pickup(order)}")
    menu_lbl = "Restaurant" if order.get("menu_type") == "restaurant" else "Epicerie"
    out += _line(f"Menu : {menu_lbl}")
    out += SEP

    # --- Customer ---
    cust = order.get("customer") or {}
    full = f"{cust.get('first_name','')} {cust.get('last_name','')}".strip()
    out += _line(f"Client : {full}")
    if cust.get("phone"):
        out += _line(f"Tel    : {cust['phone']}")
    if cust.get("address"):
        out += _line(f"Adresse: {cust['address']}")
    out += SEP

    # --- Items ---
    out += BOLD_ON + _line("ARTICLES") + BOLD_OFF
    for it in order.get("items", []):
        qty = int(it.get("quantity") or 1)
        name = it.get("name") or ""
        line_total = float(it.get("line_total") or 0)
        head = f"{qty}x {name}"
        wrapped = _wrap(head, LINE_WIDTH - 8)  # reserve 8 chars for price
        if wrapped:
            out += _row(wrapped[0], _money(line_total))
            for extra in wrapped[1:]:
                out += _line(f"    {extra}")
        for a in it.get("selected_addons", []) or []:
            aname = a.get("name") or ""
            aprice = float(a.get("price") or 0)
            if aprice:
                out += _row(f"  + {aname}", f"+{_money(aprice)}")
            else:
                out += _line(f"  + {aname}")
        if it.get("note"):
            for w in _wrap(f"Note: {it['note']}", LINE_WIDTH - 4):
                out += _line(f"    {w}")
    out += SEP

    # --- Totals ---
    subtotal = float(order.get("subtotal") or 0)
    discount = float(order.get("discount") or 0)
    total = float(order.get("total") or 0)
    out += _row("Sous-total", _money(subtotal) + " CHF")
    if discount:
        out += _row("Remise", "-" + _money(discount) + " CHF")
    out += LF
    out += BOLD_ON + SIZE_DBL_H
    out += _row(f"TOTAL", f"{_money(total)} CHF")
    out += SIZE_NORMAL + BOLD_OFF
    out += _line(f"Paiement : {_fmt_pay(order)}")
    out += SEP

    # --- Footer ---
    out += ALIGN_CENTER
    out += _line("Merci pour votre commande !")
    if header.get("website"):
        out += _line(header["website"])
    out += FEED3 + CUT
    return bytes(out)


def build_kitchen_ticket(order: dict) -> bytes:
    """Kitchen ticket — items only, big font, no prices, no client contact."""
    out = bytearray()
    out += INIT
    out += ALIGN_CENTER + BOLD_ON + SIZE_DBL_BOTH
    out += _line("CUISINE")
    out += SIZE_NORMAL + BOLD_OFF
    out += ALIGN_LEFT + DSEP

    out += BOLD_ON + SIZE_DBL_H
    out += _line(f"CMD #{order.get('order_number','')}")
    out += SIZE_NORMAL + BOLD_OFF
    out += _line(f"Retrait : {_fmt_pickup(order)}")
    cust = order.get("customer") or {}
    first = cust.get("first_name") or ""
    last_ini = (cust.get("last_name") or "")[:1]
    who = (first + (" " + last_ini + "." if last_ini else "")).strip()
    if who:
        out += _line(f"Client  : {who}")
    ftype = "A EMPORTER" if order.get("fulfillment_type") == "takeaway" else "LIVRAISON"
    out += _line(f"Type    : {ftype}")
    out += DSEP + LF

    for it in order.get("items", []):
        qty = int(it.get("quantity") or 1)
        name = it.get("name") or ""
        # Big font for the article name
        out += BOLD_ON + SIZE_DBL_BOTH
        # Break qty x name across lines if too long — at DBL_BOTH width is 16 chars
        max_big = 16
        head = f"{qty}x {name}"
        head_lines = _wrap(head, max_big) or [head]
        for h in head_lines:
            out += _line(h)
        out += SIZE_NORMAL + BOLD_OFF
        for a in it.get("selected_addons", []) or []:
            aname = a.get("name") or ""
            out += BOLD_ON + _line(f"  + {aname}") + BOLD_OFF
        if it.get("note"):
            for w in _wrap(f">>> {it['note']}", LINE_WIDTH - 2):
                out += BOLD_ON + _line(w) + BOLD_OFF
        out += LF

    out += DSEP + FEED3 + CUT
    return bytes(out)


# ---------- Queue helpers (MongoDB `print_jobs` collection) ----------
async def enqueue_order_prints(db, order: dict, header: dict):
    """Build client + kitchen tickets for `order` and push them to the queue.

    Skips silently if the order was already enqueued (idempotent on order_id
    + kind) to avoid double-printing when the admin clicks Accepter twice.
    """
    now = datetime.now(timezone.utc).isoformat()
    for kind, builder in (("client", build_client_ticket), ("kitchen", build_kitchen_ticket)):
        existing = await db.print_jobs.find_one({"order_id": order["id"], "kind": kind})
        if existing:
            continue
        payload = builder(order, header) if kind == "client" else builder(order)
        await db.print_jobs.insert_one({
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "order_number": order.get("order_number"),
            "kind": kind,
            "payload": payload,           # bytes stored as BSON Binary
            "status": "pending",          # pending -> downloaded -> printed
            "created_at": now,
            "downloaded_at": None,
            "printed_at": None,
        })


async def next_pending_job(db) -> Optional[dict]:
    """FIFO — oldest pending job first."""
    return await db.print_jobs.find_one(
        {"status": {"$in": ["pending", "downloaded"]}},
        sort=[("created_at", 1)],
    )


async def mark_downloaded(db, job_id: str):
    await db.print_jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "downloaded", "downloaded_at": datetime.now(timezone.utc).isoformat()}},
    )


async def mark_printed(db, job_id: str):
    await db.print_jobs.update_one(
        {"id": job_id},
        {"$set": {"status": "printed", "printed_at": datetime.now(timezone.utc).isoformat()}},
    )
