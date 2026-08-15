"""Backend tests: order creation triggers Pushover; admin orders API works."""
import os
import time
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://angelucci-preview.preview.emergentagent.com").rstrip("/")
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "AngelCED26")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "CE26$Lucc")


def _auth_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login: {r.status_code} {r.text}"
    tok = r.json()["token"]
    return {"Authorization": f"Bearer {tok}"}


def _get_restaurant_product():
    r = requests.get(f"{BASE_URL}/api/products", params={"menu_type": "restaurant"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0, "no restaurant products seeded"
    return data[0]


def test_products_available():
    p = _get_restaurant_product()
    assert "id" in p and p["price"] > 0


def test_create_order_takeaway_and_pushover():
    p = _get_restaurant_product()
    unit = float(p["price"])
    payload = {
        "menu_type": "restaurant",
        "fulfillment_type": "takeaway",
        "pickup_time": "ASAP",
        "customer": {
            "first_name": "TEST",
            "last_name": f"Alarm_{uuid.uuid4().hex[:6]}",
            "phone": "0790000000",
            "email": "test_alarm@example.com",
            "marketing_opt_in": False,
        },
        "items": [{
            "product_id": p["id"],
            "name": p["name"],
            "quantity": 1,
            "unit_price": unit,
            "selected_addons": [],
            "note": "TEST alarm order",
            "line_total": unit,
        }],
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=30)
    assert r.status_code == 200, f"create order failed: {r.status_code} {r.text}"
    body = r.json()
    assert "id" in body and "order_number" in body
    assert body["total"] > 0

    # Verify persistence via admin
    hdrs = _auth_headers()
    lr = requests.get(f"{BASE_URL}/api/admin/orders", headers=hdrs, params={"status": "new"}, timeout=15)
    assert lr.status_code == 200
    ids = [o["id"] for o in lr.json()]
    assert body["id"] in ids, "created order not returned by admin listing"


def test_admin_orders_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/orders", timeout=15)
    assert r.status_code in (401, 403)


def test_admin_advance_order_status():
    # Create an order then advance status new -> preparing
    p = _get_restaurant_product()
    unit = float(p["price"])
    payload = {
        "menu_type": "restaurant",
        "fulfillment_type": "takeaway",
        "pickup_time": "ASAP",
        "customer": {"first_name": "TEST", "last_name": "Adv", "phone": "079", "email": "t@t.com"},
        "items": [{"product_id": p["id"], "name": p["name"], "quantity": 1, "unit_price": unit, "line_total": unit}],
    }
    r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
    assert r.status_code == 200
    oid = r.json()["id"]

    hdrs = _auth_headers()
    pr = requests.patch(f"{BASE_URL}/api/admin/orders/{oid}/status",
                         headers=hdrs, params={"status": "preparing"}, timeout=15)
    assert pr.status_code == 200
    # confirm
    lr = requests.get(f"{BASE_URL}/api/admin/orders", headers=hdrs, timeout=15)
    ord_row = next((o for o in lr.json() if o["id"] == oid), None)
    assert ord_row and ord_row["status"] == "preparing"
