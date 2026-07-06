"""Backend integration tests for Angelucci's API."""
import os
import time
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

OWNER_USER = "AngelCED26"
OWNER_PASS = "CE26$Lucc"
STAFF_USER = "AnCED25"
STAFF_PASS = "26$LuANG"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def owner_token():
    r = requests.post(f"{API}/auth/login", json={"username": OWNER_USER, "password": OWNER_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def staff_token():
    r = requests.post(f"{API}/auth/login", json={"username": STAFF_USER, "password": STAFF_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def owner_headers(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


@pytest.fixture
def staff_headers(staff_token):
    return {"Authorization": f"Bearer {staff_token}"}


# ---------- Settings ----------
class TestSettings:
    def test_get_settings(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert s["restaurant_name"] == "Farmacia Angelucci"
        assert s["vat_takeaway"] == 0.026
        assert s["vat_delivery"] == 0.081

    def test_update_settings_persists(self, owner_headers):
        # get current to restore
        orig = requests.get(f"{API}/settings").json()
        new_val = 0.027
        r = requests.put(f"{API}/settings", headers=owner_headers, json={"vat_takeaway": new_val})
        assert r.status_code == 200
        assert r.json()["vat_takeaway"] == new_val
        # verify via GET
        s = requests.get(f"{API}/settings").json()
        assert s["vat_takeaway"] == new_val
        # restore
        requests.put(f"{API}/settings", headers=owner_headers, json={"vat_takeaway": orig["vat_takeaway"]})

    # ---- Iteration 3: new fields ----
    def test_settings_has_preparation_time_minutes(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200
        s = r.json()
        assert "preparation_time_minutes" in s, "preparation_time_minutes must be present in settings"
        assert isinstance(s["preparation_time_minutes"], int)
        assert s["preparation_time_minutes"] == 30  # default per iteration 3

    def test_settings_default_phone_is_international(self):
        r = requests.get(f"{API}/settings")
        s = r.json()
        # per iteration 3 the default is "+41 79 706 39 66"
        assert s.get("phone", "").startswith("+41"), f"phone should start with +41, got: {s.get('phone')!r}"

    def test_settings_address_includes_postal_code(self):
        r = requests.get(f"{API}/settings")
        s = r.json()
        addr = s.get("address", "")
        # Must contain postal code 1006 and city Lausanne
        assert "1006" in addr, f"address must include postal code 1006: {addr!r}"
        assert "Lausanne" in addr, f"address must include Lausanne: {addr!r}"

    def test_update_preparation_time_minutes_persists(self, owner_headers):
        orig = requests.get(f"{API}/settings").json()
        r = requests.put(f"{API}/settings", headers=owner_headers, json={"preparation_time_minutes": 45})
        assert r.status_code == 200, r.text
        assert r.json()["preparation_time_minutes"] == 45
        s = requests.get(f"{API}/settings").json()
        assert s["preparation_time_minutes"] == 45
        # restore
        requests.put(f"{API}/settings", headers=owner_headers,
                     json={"preparation_time_minutes": orig.get("preparation_time_minutes", 30)})


# ---------- Auth ----------
class TestAuth:
    def test_owner_login(self):
        r = requests.post(f"{API}/auth/login", json={"username": OWNER_USER, "password": OWNER_PASS})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "owner"
        assert isinstance(data["token"], str) and len(data["token"]) > 10

    def test_staff_login(self):
        r = requests.post(f"{API}/auth/login", json={"username": STAFF_USER, "password": STAFF_PASS})
        assert r.status_code == 200
        assert r.json()["role"] == "staff"

    def test_wrong_credentials_returns_401(self):
        r = requests.post(f"{API}/auth/login", json={"username": "bad", "password": "wrong-XYZ"})
        assert r.status_code == 401


# ---------- Categories / Products ----------
class TestMenu:
    def test_categories_restaurant(self):
        r = requests.get(f"{API}/categories", params={"menu_type": "restaurant"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_categories_epicerie(self):
        r = requests.get(f"{API}/categories", params={"menu_type": "epicerie"})
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_products_restaurant(self):
        r = requests.get(f"{API}/products", params={"menu_type": "restaurant"})
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert any("Tagliatelles" in n for n in names)

    def test_products_epicerie(self):
        r = requests.get(f"{API}/products", params={"menu_type": "epicerie"})
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert any("Parmigiano" in n for n in names)


# ---------- Schedules ----------
class TestSchedules:
    @pytest.mark.parametrize("kind", ["restaurant", "reservation", "epicerie"])
    def test_schedule_returns_days(self, kind):
        r = requests.get(f"{API}/schedule/{kind}")
        assert r.status_code == 200
        doc = r.json()
        assert "days" in doc
        for day in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]:
            assert day in doc["days"]


# ---------- Orders + VAT ----------
class TestOrders:
    def _get_restaurant_product(self):
        return requests.get(f"{API}/products", params={"menu_type": "restaurant"}).json()[0]

    def test_create_order_takeaway_and_get(self):
        p = self._get_restaurant_product()
        payload = {
            "menu_type": "restaurant",
            "fulfillment_type": "takeaway",
            "pickup_time": "ASAP",
            "customer": {
                "first_name": "TEST_John",
                "last_name": "Doe",
                "phone": "+41791234567",
                "email": "TEST_john@example.com",
                "marketing_opt_in": True,
            },
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "quantity": 2,
                "unit_price": p["price"],
                "selected_addons": [],
                "note": "",
                "line_total": p["price"] * 2,
            }],
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["id"]
        assert data["order_number"].startswith("A")
        assert data["total"] == round(p["price"] * 2, 2)

        # GET
        oid = data["id"]
        r = requests.get(f"{API}/orders/{oid}")
        assert r.status_code == 200
        o = r.json()
        assert o["fulfillment_type"] == "takeaway"
        # VAT inclusive: vat_amount = net * 0.026 / 1.026
        expected_vat = round(o["total"] * 0.026 / 1.026, 2)
        assert abs(o["vat_amount"] - expected_vat) < 0.02
        assert o["vat_rate"] == 0.026

        # persist owner ctx
        pytest.last_order_id = oid
        pytest.last_customer_email = "TEST_john@example.com"

    def test_create_order_delivery_vat(self):
        p = self._get_restaurant_product()
        payload = {
            "menu_type": "restaurant",
            "fulfillment_type": "delivery",
            "pickup_time": "ASAP",
            "customer": {
                "first_name": "TEST_Del",
                "last_name": "Doe",
                "phone": "+41791234567",
                "email": "TEST_del@example.com",
                "marketing_opt_in": False,
                "address": "Rue X 1, Lausanne",
            },
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "quantity": 1,
                "unit_price": p["price"],
                "selected_addons": [],
                "note": "",
                "line_total": p["price"],
            }],
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        o = requests.get(f"{API}/orders/{oid}").json()
        assert o["vat_rate"] == 0.081

    def test_marketing_email_created_for_opt_in(self, owner_headers):
        r = requests.get(f"{API}/admin/marketing-emails", headers=owner_headers)
        assert r.status_code == 200
        emails = [e["email"] for e in r.json()]
        assert "TEST_john@example.com" in emails

    # ---- Iteration 3: postal_code stored on order ----
    def test_create_order_with_postal_code_persists(self):
        p = self._get_restaurant_product()
        payload = {
            "menu_type": "restaurant",
            "fulfillment_type": "delivery",
            "pickup_time": "ASAP",
            "customer": {
                "first_name": "TEST_Postal",
                "last_name": "Doe",
                "phone": "+41791234567",
                "email": "TEST_postal@example.com",
                "marketing_opt_in": False,
                "address": "Av. William-Fraisse 1",
                "postal_code": "1006",
            },
            "items": [{
                "product_id": p["id"],
                "name": p["name"],
                "quantity": 1,
                "unit_price": p["price"],
                "selected_addons": [],
                "note": "",
                "line_total": p["price"],
            }],
        }
        r = requests.post(f"{API}/orders", json=payload)
        assert r.status_code == 200, r.text
        oid = r.json()["id"]
        o = requests.get(f"{API}/orders/{oid}").json()
        assert o["customer"].get("postal_code") == "1006", f"postal_code not persisted: {o['customer']!r}"


# ---------- Reservations ----------
class TestReservations:
    def test_create_reservation(self):
        # tomorrow at 19:00
        d = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/reservations", json={
            "first_name": "TEST_Alice",
            "phone": "+41791111111",
            "email": "TEST_alice@example.com",
            "date": d,
            "time": "19:00",
            "people": 2,
            "comment": "",
            "honeypot": "",
        })
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "confirmed"
        assert r.json()["id"] != "spam"

    def test_reservation_honeypot(self):
        d = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/reservations", json={
            "first_name": "spam",
            "phone": "1",
            "email": "spam@example.com",
            "date": d,
            "time": "19:00",
            "people": 2,
            "honeypot": "bot",
        })
        assert r.status_code == 200
        assert r.json()["id"] == "spam"

    def test_reservation_past_time_400(self):
        d = datetime.now().strftime("%Y-%m-%d")
        past = (datetime.now() - timedelta(hours=1)).strftime("%H:%M")
        r = requests.post(f"{API}/reservations", json={
            "first_name": "TEST_bad",
            "phone": "+41791111111",
            "email": "TEST_bad@example.com",
            "date": d,
            "time": past,
            "people": 2,
        })
        assert r.status_code == 400


# ---------- Admin JWT gating ----------
class TestAdminAuth:
    def test_admin_orders_no_token_401(self):
        r = requests.get(f"{API}/admin/orders")
        assert r.status_code == 401

    def test_admin_orders_with_token(self, owner_headers):
        r = requests.get(f"{API}/admin/orders", headers=owner_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_marketing_owner_ok(self, owner_headers):
        r = requests.get(f"{API}/admin/marketing-emails", headers=owner_headers)
        assert r.status_code == 200

    def test_marketing_staff_forbidden(self, staff_headers):
        r = requests.get(f"{API}/admin/marketing-emails", headers=staff_headers)
        assert r.status_code == 403


# ---------- Product CRUD + OOS ----------
class TestProductAdmin:
    def test_crud_and_oos(self, owner_headers):
        # find a category
        cats = requests.get(f"{API}/categories", params={"menu_type": "restaurant"}).json()
        cid = cats[0]["id"]
        p_payload = {
            "name": "TEST_Product",
            "description": "temp",
            "price": 12.5,
            "image_url": "",
            "category_id": cid,
            "menu_type": "restaurant",
            "addon_group_ids": [],
            "is_active": True,
        }
        r = requests.post(f"{API}/products", headers=owner_headers, json=p_payload)
        assert r.status_code == 200
        pid = r.json()["id"]

        # update
        p_payload["name"] = "TEST_Product_v2"
        r = requests.put(f"{API}/products/{pid}", headers=owner_headers, json=p_payload)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Product_v2"

        # OOS with future date -> hidden from public
        future = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/products/{pid}/oos", headers=owner_headers, params={"until": future})
        assert r.status_code == 200
        public = requests.get(f"{API}/products", params={"menu_type": "restaurant"}).json()
        assert pid not in [x["id"] for x in public]
        # visible in admin all
        adm = requests.get(f"{API}/products/all", headers=owner_headers, params={"menu_type": "restaurant"}).json()
        assert pid in [x["id"] for x in adm]

        # delete
        r = requests.delete(f"{API}/products/{pid}", headers=owner_headers)
        assert r.status_code == 200


# ---------- Category reorder ----------
class TestCategoryReorder:
    def test_move_swaps_order(self, owner_headers):
        cats = requests.get(f"{API}/categories", params={"menu_type": "restaurant"}).json()
        if len(cats) < 2:
            pytest.skip("Need >=2 categories")
        first, second = cats[0], cats[1]
        o1_before, o2_before = first["order"], second["order"]
        r = requests.post(f"{API}/categories/{second['id']}/move", headers=owner_headers, params={"direction": "up"})
        assert r.status_code == 200
        cats_after = requests.get(f"{API}/categories", params={"menu_type": "restaurant"}).json()
        by_id = {c["id"]: c for c in cats_after}
        assert by_id[first["id"]]["order"] == o2_before
        assert by_id[second["id"]]["order"] == o1_before
        # revert
        requests.post(f"{API}/categories/{second['id']}/move", headers=owner_headers, params={"direction": "down"})


# ---------- Accounting PDF ----------
class TestAccounting:
    def test_pdf(self, owner_headers):
        now = datetime.now()
        r = requests.get(f"{API}/admin/accounting/pdf", headers=owner_headers, params={"month": now.month, "year": now.year})
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert len(r.content) > 500
