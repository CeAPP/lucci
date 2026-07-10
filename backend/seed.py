"""Seed initial DB data: default schedule, settings, one demo product per menu."""
import uuid
from datetime import datetime, timezone


DEFAULT_SETTINGS = {
    "_id": "settings",
    "restaurant_name": "Farmacia Angelucci",
    "phone": "+41 79 706 39 66",
    "email": "info@angeluccis.ch",
    "address": "Av. William-Fraisse 1, 1006 Lausanne",
    "vat_takeaway": 0.026,
    "vat_delivery": 0.081,
    "orders_enabled": True,
    "reservations_enabled": True,
    "grocery_lead_days": 7,
    "preparation_time_minutes": 30,
}


def default_day(open_lunch=True, open_dinner=True):
    return {
        "closed": not (open_lunch or open_dinner),
        "lunch_start": "11:30" if open_lunch else "",
        "lunch_end": "14:30" if open_lunch else "",
        "dinner_start": "18:30" if open_dinner else "",
        "dinner_end": "22:30" if open_dinner else "",
    }


def default_schedule(kind: str):
    days = {
        "mon": default_day(True, True),
        "tue": default_day(True, True),
        "wed": default_day(True, True),
        "thu": default_day(True, True),
        "fri": default_day(True, True),
        "sat": default_day(False, True),
        "sun": {"closed": True, "lunch_start": "", "lunch_end": "", "dinner_start": "", "dinner_end": ""},
    }
    return {"_id": f"schedule_{kind}", "kind": kind, "days": days, "closed_dates": []}


async def seed_db(db):
    # Settings
    if not await db.settings.find_one({"_id": "settings"}):
        await db.settings.insert_one(DEFAULT_SETTINGS.copy())
    else:
        # Backfill any missing fields
        existing = await db.settings.find_one({"_id": "settings"})
        missing = {k: v for k, v in DEFAULT_SETTINGS.items() if k not in existing}
        if missing:
            await db.settings.update_one({"_id": "settings"}, {"$set": missing})

    # Schedules
    for kind in ["restaurant", "reservation", "epicerie"]:
        if not await db.schedules.find_one({"_id": f"schedule_{kind}"}):
            await db.schedules.insert_one(default_schedule(kind))

    # Categories (both menus)
    if await db.categories.count_documents({}) == 0:
        cats = [
            {"id": str(uuid.uuid4()), "name": "Antipasti", "menu_type": "restaurant", "order": 0},
            {"id": str(uuid.uuid4()), "name": "Primi Piatti", "menu_type": "restaurant", "order": 1},
            {"id": str(uuid.uuid4()), "name": "Secondi", "menu_type": "restaurant", "order": 2},
            {"id": str(uuid.uuid4()), "name": "Dolci", "menu_type": "restaurant", "order": 3},
            {"id": str(uuid.uuid4()), "name": "Fromages", "menu_type": "epicerie", "order": 0},
            {"id": str(uuid.uuid4()), "name": "Pâtes fraîches", "menu_type": "epicerie", "order": 1},
            {"id": str(uuid.uuid4()), "name": "Huiles & Condiments", "menu_type": "epicerie", "order": 2},
        ]
        await db.categories.insert_many(cats)
        primi = next(c for c in cats if c["name"] == "Primi Piatti")
        fromages = next(c for c in cats if c["name"] == "Fromages")

        # One demo product per menu
        now = datetime.now(timezone.utc).isoformat()
        await db.products.insert_many([
            {
                "id": str(uuid.uuid4()),
                "name": "Tagliatelles al ragù",
                "description": "Pâtes fraîches maison, sauce bolognaise mijotée 6 heures.",
                "price": 26.50,
                "image_url": "https://images.pexels.com/photos/36445107/pexels-photo-36445107.jpeg",
                "category_id": primi["id"],
                "menu_type": "restaurant",
                "addon_group_ids": [],
                "out_of_stock_until": None,
                "is_active": True,
                "created_at": now,
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Parmigiano Reggiano 24 mois (250g)",
                "description": "Affiné 24 mois, DOP Émilie-Romagne. Texture friable, notes de fruits secs.",
                "price": 18.90,
                "image_url": "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800",
                "category_id": fromages["id"],
                "menu_type": "epicerie",
                "addon_group_ids": [],
                "out_of_stock_until": None,
                "is_active": True,
                "created_at": now,
            },
        ])
