/** DB seed & schedule migration — direct port of backend/seed.py */
const crypto = require("crypto");

const DEFAULT_SETTINGS = {
  _id: "settings",
  restaurant_name: "Farmacia Angelucci",
  phone: "+41 79 706 39 66",
  email: "info@angeluccis.ch",
  address: "Av. William-Fraisse 1, 1006 Lausanne",
  vat_takeaway: 0.026,
  vat_delivery: 0.081,
  orders_enabled: true,
  reservations_enabled: true,
  grocery_lead_days: 7,
  epicerie_days_ahead: 7,
  preparation_time_minutes: 30,
};

const defaultDay = (open = true) => ({
  closed: !open,
  lunch_start: open ? "09:00" : "",
  lunch_end: open ? "22:30" : "",
  dinner_start: "",
  dinner_end: "",
});

function defaultSchedule(kind) {
  return {
    _id: `schedule_${kind}`,
    kind,
    days: {
      mon: defaultDay(false),
      tue: defaultDay(true),
      wed: defaultDay(true),
      thu: defaultDay(true),
      fri: defaultDay(true),
      sat: defaultDay(true),
      sun: defaultDay(false),
    },
    closed_dates: [],
  };
}

async function seedDb(db) {
  // Settings
  const s = await db.collection("settings").findOne({ _id: "settings" });
  if (!s) {
    await db.collection("settings").insertOne({ ...DEFAULT_SETTINGS });
  } else {
    const missing = {};
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) if (!(k in s)) missing[k] = v;
    if (Object.keys(missing).length) await db.collection("settings").updateOne({ _id: "settings" }, { $set: missing });
  }

  // Schedules
  for (const kind of ["restaurant", "reservation", "epicerie"]) {
    const cur = await db.collection("schedules").findOne({ _id: `schedule_${kind}` });
    if (!cur) {
      await db.collection("schedules").insertOne(defaultSchedule(kind));
    } else {
      // Migration: fold split lunch/dinner into a continuous window
      const days = cur.days || {};
      let changed = false;
      for (const [dkey, d] of Object.entries(days)) {
        if (d.dinner_end) {
          const newEnd = d.dinner_end;
          const newStart = d.lunch_start || d.dinner_start || "";
          days[dkey] = { closed: !!d.closed, lunch_start: newStart, lunch_end: newEnd, dinner_start: "", dinner_end: "" };
          changed = true;
        }
      }
      if (changed) await db.collection("schedules").updateOne({ _id: `schedule_${kind}` }, { $set: { days } });
    }
  }

  // Categories + one demo product per menu (only if empty)
  const catCount = await db.collection("categories").countDocuments({});
  if (catCount === 0) {
    const cats = [
      { id: crypto.randomUUID(), name: "Antipasti", menu_type: "restaurant", order: 0 },
      { id: crypto.randomUUID(), name: "Primi Piatti", menu_type: "restaurant", order: 1 },
      { id: crypto.randomUUID(), name: "Secondi", menu_type: "restaurant", order: 2 },
      { id: crypto.randomUUID(), name: "Dolci", menu_type: "restaurant", order: 3 },
      { id: crypto.randomUUID(), name: "Fromages", menu_type: "epicerie", order: 0 },
      { id: crypto.randomUUID(), name: "Pâtes fraîches", menu_type: "epicerie", order: 1 },
      { id: crypto.randomUUID(), name: "Huiles & Condiments", menu_type: "epicerie", order: 2 },
    ];
    await db.collection("categories").insertMany(cats);
    const primi = cats.find(c => c.name === "Primi Piatti");
    const fromages = cats.find(c => c.name === "Fromages");
    const now = new Date().toISOString();
    await db.collection("products").insertMany([
      {
        id: crypto.randomUUID(),
        name: "Tagliatelles al ragù",
        description: "Pâtes fraîches maison, sauce bolognaise mijotée 6 heures.",
        price: 26.50,
        image_url: "https://images.pexels.com/photos/36445107/pexels-photo-36445107.jpeg",
        category_id: primi.id,
        menu_type: "restaurant",
        addon_group_ids: [],
        out_of_stock_until: null,
        is_active: true,
        created_at: now,
      },
      {
        id: crypto.randomUUID(),
        name: "Parmigiano Reggiano 24 mois (250g)",
        description: "Affiné 24 mois, DOP Émilie-Romagne. Texture friable, notes de fruits secs.",
        price: 18.90,
        image_url: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800",
        category_id: fromages.id,
        menu_type: "epicerie",
        addon_group_ids: [],
        out_of_stock_until: null,
        is_active: true,
        created_at: now,
      },
    ]);
  }
}

module.exports = { seedDb };
