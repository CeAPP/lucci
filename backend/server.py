"""Angelucci's — FastAPI backend."""
import os
import uuid
import logging
import shutil
import random
import string
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import verify_credentials, create_token, get_current_user, require_owner, get_client_ip
from emails import send_order_confirmation, send_reservation_confirmation, send_new_order_notification
from pdf_gen import build_accounting_pdf
from seed import seed_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("angeluccis")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/backend/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Angelucci's API")
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def gen_order_number() -> str:
    ts = datetime.now().strftime("%y%m%d")
    r = "".join(random.choices(string.digits, k=4))
    return f"A{ts}-{r}"


# ==================== MODELS ====================

class LoginRequest(BaseModel):
    username: str
    password: str


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    menu_type: str  # "restaurant" | "epicerie"
    order: int = 0


class AddonOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    price: float = 0.0


class AddonGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    required: bool = False
    multi: bool = False  # True = checkbox, False = radio
    min: int = 0
    max: int = 1
    options: List[AddonOption] = []


class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price: float
    image_url: str = ""
    category_id: str
    menu_type: str  # restaurant | epicerie
    addon_group_ids: List[str] = []
    out_of_stock_until: Optional[str] = None  # ISO date
    is_active: bool = True
    created_at: str = Field(default_factory=now_iso)


class OrderItemAddon(BaseModel):
    id: str
    name: str
    price: float


class OrderItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float
    selected_addons: List[OrderItemAddon] = []
    note: str = ""
    line_total: float


class OrderCustomer(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: EmailStr
    marketing_opt_in: bool = False
    address: str = ""  # for delivery


class OrderCreate(BaseModel):
    menu_type: str  # restaurant | epicerie
    fulfillment_type: str  # takeaway | delivery
    pickup_time: str  # "ASAP" or ISO datetime
    customer: OrderCustomer
    items: List[OrderItem]
    promo_code: Optional[str] = None


class ReservationCreate(BaseModel):
    first_name: str
    phone: str
    email: EmailStr
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    people: int
    comment: str = ""
    honeypot: str = ""  # anti-spam


class SettingsUpdate(BaseModel):
    restaurant_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    vat_takeaway: Optional[float] = None
    vat_delivery: Optional[float] = None
    orders_enabled: Optional[bool] = None
    reservations_enabled: Optional[bool] = None
    grocery_lead_days: Optional[int] = None


class DayHours(BaseModel):
    closed: bool = False
    lunch_start: str = ""
    lunch_end: str = ""
    dinner_start: str = ""
    dinner_end: str = ""


class ScheduleUpdate(BaseModel):
    days: dict  # {mon: DayHours, ...}
    closed_dates: List[str] = []


class PromoCode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    type: str  # percent | fixed | bogo
    value: float
    min_amount: float = 0.0
    product_id: Optional[str] = None
    active: bool = True
    created_at: str = Field(default_factory=now_iso)


# ==================== AUTH ====================

@api.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    ip = get_client_ip(request)
    # Rate limit: 10 attempts / 10 min per IP
    since = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    count = await db.login_attempts.count_documents({"ip": ip, "ts": {"$gte": since}, "success": False})
    if count >= 10:
        raise HTTPException(status_code=429, detail="Trop de tentatives, réessayez plus tard")
    user = verify_credentials(req.username, req.password)
    await db.login_attempts.insert_one({"ip": ip, "username": req.username, "success": bool(user), "ts": now_iso()})
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token(user["username"], user["role"])
    return {"token": token, "username": user["username"], "role": user["role"]}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ==================== PUBLIC: SETTINGS + SCHEDULE + MENU ====================

@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"_id": "settings"}, {"_id": 0})
    return s or {}


@api.put("/settings")
async def update_settings(update: SettingsUpdate, user: dict = Depends(get_current_user)):
    changes = {k: v for k, v in update.model_dump().items() if v is not None}
    if changes:
        await db.settings.update_one({"_id": "settings"}, {"$set": changes})
    s = await db.settings.find_one({"_id": "settings"}, {"_id": 0})
    return s


@api.get("/schedule/{kind}")
async def get_schedule(kind: str):
    if kind not in ("restaurant", "reservation", "epicerie"):
        raise HTTPException(400, "Invalid kind")
    doc = await db.schedules.find_one({"_id": f"schedule_{kind}"}, {"_id": 0})
    return doc or {}


@api.put("/schedule/{kind}")
async def update_schedule(kind: str, upd: ScheduleUpdate, user: dict = Depends(get_current_user)):
    if kind not in ("restaurant", "reservation", "epicerie"):
        raise HTTPException(400, "Invalid kind")
    await db.schedules.update_one(
        {"_id": f"schedule_{kind}"},
        {"$set": {"days": upd.days, "closed_dates": upd.closed_dates, "kind": kind}},
        upsert=True,
    )
    return await db.schedules.find_one({"_id": f"schedule_{kind}"}, {"_id": 0})


# ==================== CATEGORIES ====================

@api.get("/categories")
async def list_categories(menu_type: Optional[str] = None):
    q = {}
    if menu_type:
        q["menu_type"] = menu_type
    return await db.categories.find(q, {"_id": 0}).sort("order", 1).to_list(500)


@api.post("/categories")
async def create_category(cat: Category, user: dict = Depends(get_current_user)):
    doc = cat.model_dump()
    await db.categories.insert_one(doc.copy())
    return doc


@api.put("/categories/{cat_id}")
async def update_category(cat_id: str, cat: Category, user: dict = Depends(get_current_user)):
    doc = cat.model_dump()
    doc["id"] = cat_id
    await db.categories.update_one({"id": cat_id}, {"$set": doc})
    return doc


@api.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(get_current_user)):
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


@api.post("/categories/{cat_id}/move")
async def move_category(cat_id: str, direction: str, user: dict = Depends(get_current_user)):
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404)
    siblings = await db.categories.find({"menu_type": cat["menu_type"]}, {"_id": 0}).sort("order", 1).to_list(500)
    idx = next((i for i, c in enumerate(siblings) if c["id"] == cat_id), None)
    if idx is None:
        raise HTTPException(404)
    swap_idx = idx - 1 if direction == "up" else idx + 1
    if swap_idx < 0 or swap_idx >= len(siblings):
        return {"ok": True}
    other = siblings[swap_idx]
    await db.categories.update_one({"id": cat["id"]}, {"$set": {"order": other["order"]}})
    await db.categories.update_one({"id": other["id"]}, {"$set": {"order": cat["order"]}})
    return {"ok": True}


# ==================== ADDON GROUPS ====================

@api.get("/addon-groups")
async def list_addon_groups():
    return await db.addon_groups.find({}, {"_id": 0}).to_list(500)


@api.post("/addon-groups")
async def create_addon_group(g: AddonGroup, user: dict = Depends(get_current_user)):
    doc = g.model_dump()
    await db.addon_groups.insert_one(doc.copy())
    return doc


@api.put("/addon-groups/{gid}")
async def update_addon_group(gid: str, g: AddonGroup, user: dict = Depends(get_current_user)):
    doc = g.model_dump()
    doc["id"] = gid
    await db.addon_groups.update_one({"id": gid}, {"$set": doc})
    return doc


@api.delete("/addon-groups/{gid}")
async def delete_addon_group(gid: str, user: dict = Depends(get_current_user)):
    await db.addon_groups.delete_one({"id": gid})
    return {"ok": True}


# ==================== PRODUCTS ====================

def _is_available(p: dict, today: date) -> bool:
    if not p.get("is_active", True):
        return False
    oos = p.get("out_of_stock_until")
    if oos:
        try:
            oos_date = date.fromisoformat(oos)
            if today <= oos_date:
                return False
        except Exception:
            pass
    return True


@api.get("/products")
async def list_products(menu_type: Optional[str] = None, admin: bool = False, user: Optional[dict] = None):
    q = {}
    if menu_type:
        q["menu_type"] = menu_type
    docs = await db.products.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if not admin:
        today = date.today()
        docs = [d for d in docs if _is_available(d, today)]
    return docs


@api.get("/products/all")
async def list_products_admin(menu_type: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if menu_type:
        q["menu_type"] = menu_type
    return await db.products.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.post("/products")
async def create_product(p: Product, user: dict = Depends(get_current_user)):
    doc = p.model_dump()
    await db.products.insert_one(doc.copy())
    return doc


@api.put("/products/{pid}")
async def update_product(pid: str, p: Product, user: dict = Depends(get_current_user)):
    doc = p.model_dump()
    doc["id"] = pid
    await db.products.update_one({"id": pid}, {"$set": doc})
    return doc


@api.delete("/products/{pid}")
async def delete_product(pid: str, user: dict = Depends(get_current_user)):
    await db.products.delete_one({"id": pid})
    return {"ok": True}


@api.post("/products/{pid}/oos")
async def set_oos(pid: str, until: str, user: dict = Depends(get_current_user)):
    """Mark out of stock until an ISO date (YYYY-MM-DD), or empty to clear."""
    val = until if until else None
    await db.products.update_one({"id": pid}, {"$set": {"out_of_stock_until": val}})
    return {"ok": True}


@api.post("/products/import-csv")
async def import_csv(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    import csv
    import io as _io
    raw = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(_io.StringIO(raw))
    count = 0
    cats = {c["name"].lower(): c for c in await db.categories.find({}, {"_id": 0}).to_list(500)}
    for row in reader:
        name = row.get("name") or row.get("nom")
        price = row.get("price") or row.get("prix")
        if not name or not price:
            continue
        cat_name = (row.get("category") or row.get("categorie") or "").lower()
        menu_type = (row.get("menu") or row.get("menu_type") or "restaurant").lower()
        cat = cats.get(cat_name)
        if not cat:
            continue
        p = Product(
            name=name,
            description=row.get("description", ""),
            price=float(price),
            image_url=row.get("image") or row.get("image_url", ""),
            category_id=cat["id"],
            menu_type=menu_type,
        )
        await db.products.insert_one(p.model_dump())
        count += 1
    return {"imported": count}


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(400, "Format non supporté")
    name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"url": f"/api/uploads/{name}"}


# ==================== ORDERS ====================

async def _calc_totals(order_in: OrderCreate) -> dict:
    settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
    vat_rate = settings.get("vat_delivery", 0.081) if order_in.fulfillment_type == "delivery" else settings.get("vat_takeaway", 0.026)
    subtotal = sum(it.line_total for it in order_in.items)

    discount = 0.0
    promo_used = None
    if order_in.promo_code:
        promo = await db.promo_codes.find_one({"code": order_in.promo_code.upper(), "active": True}, {"_id": 0})
        if promo and subtotal >= promo.get("min_amount", 0):
            if promo["type"] == "percent":
                discount = subtotal * (promo["value"] / 100.0)
            elif promo["type"] == "fixed":
                discount = min(promo["value"], subtotal)
            elif promo["type"] == "bogo":
                discount = 0.0  # simplified — extend as needed
            promo_used = promo["code"]

    net = max(0.0, subtotal - discount)
    vat_amount = round(net * vat_rate / (1 + vat_rate), 2)  # VAT included in price
    total = round(net, 2)
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount, 2),
        "vat_rate": vat_rate,
        "vat_amount": vat_amount,
        "total": total,
        "promo_code_used": promo_used,
    }


@api.post("/orders")
async def create_order(order_in: OrderCreate):
    settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
    if not settings.get("orders_enabled", True):
        raise HTTPException(400, "Les commandes sont désactivées")

    totals = await _calc_totals(order_in)
    order = {
        "id": str(uuid.uuid4()),
        "order_number": gen_order_number(),
        "menu_type": order_in.menu_type,
        "fulfillment_type": order_in.fulfillment_type,
        "pickup_time": order_in.pickup_time,
        "pickup_time_label": "Dès que possible" if order_in.pickup_time == "ASAP" else order_in.pickup_time,
        "customer": order_in.customer.model_dump(),
        "items": [it.model_dump() for it in order_in.items],
        **totals,
        "status": "new",  # new | preparing | ready | handed | done
        "deleted": False,
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())

    # Marketing opt-in
    if order_in.customer.marketing_opt_in:
        await db.marketing_emails.update_one(
            {"email": order_in.customer.email},
            {
                "$set": {
                    "email": order_in.customer.email,
                    "first_name": order_in.customer.first_name,
                    "last_name": order_in.customer.last_name,
                    "phone": order_in.customer.phone,
                    "source": "order",
                    "last_activity": now_iso(),
                },
                "$inc": {"order_count": 1},
            },
            upsert=True,
        )

    # Send emails (best-effort, non-blocking-ish)
    try:
        await send_order_confirmation(order)
        await send_new_order_notification(order)
    except Exception as e:
        logger.error(f"Email failure: {e}")

    return {"id": order["id"], "order_number": order["order_number"], "total": order["total"]}


@api.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await db.orders.find_one({"id": order_id, "deleted": {"$ne": True}}, {"_id": 0})
    if not o:
        raise HTTPException(404)
    return o


@api.get("/admin/orders")
async def list_orders_admin(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"deleted": {"$ne": True}}
    if status:
        q["status"] = status
    return await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/admin/orders/{order_id}/status")
async def set_order_status(order_id: str, status: str, user: dict = Depends(get_current_user)):
    if status not in ["new", "preparing", "ready", "handed", "done"]:
        raise HTTPException(400)
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    return {"ok": True}


@api.delete("/admin/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(get_current_user)):
    await db.orders.update_one({"id": order_id}, {"$set": {"deleted": True}})
    return {"ok": True}


# ==================== RESERVATIONS ====================

@api.post("/reservations")
async def create_reservation(r: ReservationCreate, request: Request):
    # Honeypot
    if r.honeypot:
        return {"id": "spam", "status": "confirmed"}

    settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
    if not settings.get("reservations_enabled", True):
        raise HTTPException(400, "Les réservations sont désactivées")

    ip = get_client_ip(request)
    since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    recent = await db.reservations.count_documents({"ip": ip, "created_at": {"$gte": since}})
    if recent >= 3:
        raise HTTPException(429, "Trop de réservations récentes, réessayez plus tard")

    # Lead time 30 min for today
    try:
        res_dt = datetime.fromisoformat(f"{r.date}T{r.time}:00")
        if res_dt.date() == datetime.now().date():
            if res_dt < datetime.now() + timedelta(minutes=30):
                raise HTTPException(400, "Délai minimum 30 min pour aujourd'hui")
    except ValueError:
        raise HTTPException(400, "Date/heure invalide")

    doc = {
        "id": str(uuid.uuid4()),
        "first_name": r.first_name,
        "phone": r.phone,
        "email": r.email,
        "date": r.date,
        "time": r.time,
        "people": r.people,
        "comment": r.comment,
        "status": "confirmed",
        "ip": ip,
        "created_at": now_iso(),
    }
    await db.reservations.insert_one(doc.copy())
    # marketing not opted in for reservations by default; capture anyway as passive contact source
    await db.marketing_emails.update_one(
        {"email": r.email},
        {
            "$set": {
                "email": r.email,
                "first_name": r.first_name,
                "phone": r.phone,
                "source": "reservation",
                "last_activity": now_iso(),
            },
            "$inc": {"reservation_count": 1},
        },
        upsert=True,
    )

    try:
        await send_reservation_confirmation(doc)
    except Exception as e:
        logger.error(f"Reservation email failure: {e}")

    return {"id": doc["id"], "status": "confirmed"}


@api.get("/admin/reservations")
async def list_reservations(user: dict = Depends(get_current_user)):
    return await db.reservations.find({}, {"_id": 0, "ip": 0}).sort("date", -1).to_list(500)


@api.patch("/admin/reservations/{rid}/status")
async def set_res_status(rid: str, status: str, user: dict = Depends(get_current_user)):
    if status not in ["confirmed", "cancelled", "done"]:
        raise HTTPException(400)
    await db.reservations.update_one({"id": rid}, {"$set": {"status": status}})
    return {"ok": True}


# ==================== PROMO CODES ====================

@api.get("/admin/promos")
async def list_promos(user: dict = Depends(get_current_user)):
    return await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/admin/promos")
async def create_promo(p: PromoCode, user: dict = Depends(get_current_user)):
    doc = p.model_dump()
    doc["code"] = doc["code"].upper()
    await db.promo_codes.insert_one(doc.copy())
    return doc


@api.delete("/admin/promos/{pid}")
async def delete_promo(pid: str, user: dict = Depends(get_current_user)):
    await db.promo_codes.delete_one({"id": pid})
    return {"ok": True}


# ==================== MARKETING EMAILS (owner only) ====================

@api.get("/admin/marketing-emails")
async def list_marketing(user: dict = Depends(require_owner)):
    return await db.marketing_emails.find({}, {"_id": 0}).sort("last_activity", -1).to_list(2000)


# ==================== ACCOUNTING PDF ====================

@api.get("/admin/accounting/pdf")
async def accounting_pdf(month: int, year: int, user: dict = Depends(get_current_user)):
    start = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc).isoformat()
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc).isoformat()
    orders = await db.orders.find(
        {"deleted": {"$ne": True}, "created_at": {"$gte": start, "$lt": end}}, {"_id": 0}
    ).to_list(5000)
    settings = await db.settings.find_one({"_id": "settings"}, {"_id": 0}) or {}
    pdf_bytes = build_accounting_pdf(month, year, orders, settings.get("restaurant_name", "Angelucci's"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="comptabilite-{year}-{month:02d}.pdf"'},
    )


# ==================== STARTUP ====================

@app.on_event("startup")
async def on_startup():
    await seed_db(db)
    logger.info("DB seeded / verified.")


@api.get("/")
async def root():
    return {"message": "Angelucci's API"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
