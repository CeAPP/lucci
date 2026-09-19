"""
Node.js migration parity tests — verifies all Express endpoints match
the previous Python/FastAPI contract.
"""
import os
import io
import re
import time
import pytest
import requests
from datetime import datetime, timedelta

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
# Fallback: read frontend/.env
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"

ADMIN_USER = "AngelCED26"
ADMIN_PASS = "CE26$Lucc"
STAFF_USER = "AnCED25"
STAFF_PASS = "26$LuANG"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def owner_token(s):
    r = s.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["role"] == "owner"
    return data["token"]


@pytest.fixture(scope="session")
def staff_token(s):
    r = s.post(f"{API}/auth/login", json={"username": STAFF_USER, "password": STAFF_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture()
def owner_hdr(owner_token):
    return {"Authorization": f"Bearer {owner_token}"}


# =============== HEALTH / PUBLIC ===============
def test_root(s):
    r = s.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("message") == "Angelucci's API"

def test_login_bad(s):
    r = s.post(f"{API}/auth/login", json={"username": "x", "password": "y"}, timeout=10)
    assert r.status_code == 401

def test_auth_me(s, owner_hdr):
    r = s.get(f"{API}/auth/me", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert r.json()["username"] == ADMIN_USER

def test_settings(s):
    r = s.get(f"{API}/settings", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)

def test_theme(s):
    r = s.get(f"{API}/theme", timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ("primary", "font_display", "font_body"):
        assert k in data

def test_content(s):
    r = s.get(f"{API}/content", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), dict)

def test_schedules(s):
    for k in ("restaurant", "reservation", "epicerie"):
        r = s.get(f"{API}/schedule/{k}", timeout=10)
        assert r.status_code == 200

def test_schedule_bad_kind(s):
    r = s.get(f"{API}/schedule/xxx", timeout=10)
    assert r.status_code == 400

def test_categories(s):
    r = s.get(f"{API}/categories", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_categories_filtered(s):
    r = s.get(f"{API}/categories?menu_type=restaurant", timeout=10)
    assert r.status_code == 200
    for c in r.json():
        assert c["menu_type"] == "restaurant"

def test_products_restaurant(s):
    r = s.get(f"{API}/products?menu_type=restaurant", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_products_epicerie(s):
    r = s.get(f"{API}/products?menu_type=epicerie", timeout=10)
    assert r.status_code == 200

def test_addon_groups(s):
    r = s.get(f"{API}/addon-groups", timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# =============== ADMIN AUTH GUARDS ===============
def test_admin_requires_auth(s):
    r = s.get(f"{API}/admin/orders", timeout=10)
    assert r.status_code == 401

def test_staff_no_marketing(s, staff_token):
    r = s.get(f"{API}/admin/marketing-emails",
              headers={"Authorization": f"Bearer {staff_token}"}, timeout=10)
    assert r.status_code == 403


# =============== PRODUCT CRUD + REORDER ===============
@pytest.fixture()
def a_category(s, owner_hdr):
    cats = s.get(f"{API}/categories?menu_type=restaurant").json()
    assert cats, "seed categories missing"
    return cats[0]


def test_product_full_lifecycle(s, owner_hdr, a_category):
    payload = {
        "name": "TEST_MIGR_PROD",
        "price": 12.5,
        "menu_type": "restaurant",
        "category_id": a_category["id"],
        "description": "test",
    }
    r = s.post(f"{API}/products", json=payload, headers=owner_hdr, timeout=10)
    assert r.status_code == 200, r.text
    p = r.json()
    pid = p["id"]
    assert p["name"] == "TEST_MIGR_PROD"

    # GET verifies persistence
    got = s.get(f"{API}/products?menu_type=restaurant").json()
    assert any(x["id"] == pid for x in got)

    # PUT update
    p["price"] = 15.0
    r = s.put(f"{API}/products/{pid}", json=p, headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert r.json()["price"] == 15.0

    # Reorder
    r = s.post(f"{API}/products/reorder", json={"ordered_ids": [pid]},
               headers=owner_hdr, timeout=10)
    assert r.status_code == 200 and r.json()["ok"]

    # OOS via query param
    r = s.post(f"{API}/products/{pid}/oos?until=2099-01-01", headers=owner_hdr, timeout=10)
    assert r.status_code == 200

    # DELETE
    r = s.delete(f"{API}/products/{pid}", headers=owner_hdr, timeout=10)
    assert r.status_code == 200


# =============== CSV EXPORT (UTF-8 BOM + 11 columns) ===============
def test_csv_export(s, owner_hdr):
    r = s.get(f"{API}/products/export-csv", headers=owner_hdr, timeout=15)
    assert r.status_code == 200
    ct = r.headers.get("Content-Type", "")
    assert "text/csv" in ct
    # UTF-8 BOM
    assert r.content.startswith(b"\xef\xbb\xbf"), "CSV must start with UTF-8 BOM"
    header = r.content.decode("utf-8-sig").splitlines()[0]
    cols = [c.strip() for c in header.split(",")]
    assert len(cols) == 11, f"expected 11 columns, got {len(cols)}: {cols}"
    # Filename check
    cd = r.headers.get("Content-Disposition", "")
    assert re.search(r"produits-angeluccis-\d{8}\.csv", cd), cd


# =============== CONTENT PUT (query params) ===============
def test_content_put_query_params(s, owner_hdr):
    r = s.put(f"{API}/content?page=test&key=migr&value=hello", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] and data["value"] == "hello"

    r = s.get(f"{API}/content?page=test", timeout=10)
    assert r.status_code == 200
    assert r.json().get("test", {}).get("migr") == "hello"


def test_theme_put_query_params(s, owner_hdr):
    r = s.put(f"{API}/theme?primary=%237FA9A8", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert r.json()["primary"] == "#7FA9A8"


# =============== ORDER (onsite) ===============
@pytest.fixture()
def sample_product(s):
    prods = s.get(f"{API}/products?menu_type=restaurant").json()
    # find first that's not in restricted-hour category if possible
    cats = {c["id"]: c for c in s.get(f"{API}/categories?menu_type=restaurant").json()}
    for p in prods:
        c = cats.get(p["category_id"], {})
        if c.get("restricted_start_hour") is None:
            return p
    return prods[0] if prods else None


def test_create_onsite_order(s, sample_product):
    if not sample_product:
        pytest.skip("no seed products")
    p = sample_product
    order = {
        "menu_type": "restaurant",
        "fulfillment_type": "takeaway",
        "pickup_time": "ASAP",
        "payment_method": "onsite",
        "customer": {
            "first_name": "TEST", "last_name": "Migr",
            "phone": "0790000000", "email": "test@example.com",
        },
        "items": [{
            "product_id": p["id"], "name": p["name"], "quantity": 1,
            "unit_price": p["price"], "line_total": p["price"],
            "notes": "test note", "addons": [],
        }],
    }
    r = s.post(f"{API}/orders", json=order, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and "order_number" in data
    assert data["order_number"].startswith("A")

    # GET
    g = s.get(f"{API}/orders/{data['id']}", timeout=10)
    assert g.status_code == 200
    assert g.json()["status"] == "new"


# =============== RESERVATION ===============
def test_reservation_lead_time(s):
    now = datetime.now()
    # today + 5 min → should be rejected
    r = s.post(f"{API}/reservations", json={
        "first_name": "TEST_migr", "phone": "0790000001", "email": "res@example.com",
        "date": now.strftime("%Y-%m-%d"),
        "time": (now + timedelta(minutes=5)).strftime("%H:%M"),
        "people": 2,
    }, timeout=10)
    assert r.status_code == 400


def test_reservation_honeypot(s):
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r = s.post(f"{API}/reservations", json={
        "first_name": "TEST_bot", "phone": "0000", "email": "b@b.com",
        "date": tomorrow, "time": "19:00", "people": 2,
        "honeypot": "iamabot",
    }, timeout=10)
    assert r.status_code == 200
    assert r.json()["id"] == "spam"


def test_reservation_valid(s):
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r = s.post(f"{API}/reservations", json={
        "first_name": "TEST_migr", "phone": "0790000002", "email": "res2@example.com",
        "date": tomorrow, "time": "19:30", "people": 3, "comment": "test",
    }, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "confirmed"


def test_admin_reservations_list(s, owner_hdr):
    r = s.get(f"{API}/admin/reservations", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# =============== ORDERS ADMIN (status via query) ===============
def test_admin_orders_list(s, owner_hdr):
    r = s.get(f"{API}/admin/orders", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_order_status_and_reprint(s, owner_hdr, sample_product):
    if not sample_product:
        pytest.skip("no seed product")
    # Create an order
    p = sample_product
    r = s.post(f"{API}/orders", json={
        "menu_type": "restaurant", "fulfillment_type": "takeaway",
        "pickup_time": "ASAP", "payment_method": "onsite",
        "customer": {"first_name": "TEST", "last_name": "St", "phone": "079", "email": "s@s.com"},
        "items": [{"product_id": p["id"], "name": p["name"], "quantity": 1,
                   "unit_price": p["price"], "line_total": p["price"], "addons": []}],
    }, timeout=15)
    assert r.status_code == 200, r.text
    oid = r.json()["id"]

    # PATCH status via query param
    r = s.patch(f"{API}/admin/orders/{oid}/status?status=preparing",
                headers=owner_hdr, timeout=10)
    assert r.status_code == 200

    # Reprint
    r = s.post(f"{API}/admin/orders/{oid}/reprint", headers=owner_hdr, timeout=10)
    assert r.status_code == 200


# =============== PROMOS ===============
def test_promo_lifecycle(s, owner_hdr):
    r = s.post(f"{API}/admin/promos", json={
        "code": "TESTMIGR", "type": "percent", "value": 10, "scope": "all",
    }, headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    pid = r.json()["id"]

    r = s.get(f"{API}/admin/promos", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert any(x["id"] == pid for x in r.json())

    r = s.patch(f"{API}/admin/promos/{pid}?active=false", headers=owner_hdr, timeout=10)
    assert r.status_code == 200

    r = s.delete(f"{API}/admin/promos/{pid}", headers=owner_hdr, timeout=10)
    assert r.status_code == 200


# =============== MARKETING EMAILS (owner only) ===============
def test_marketing_emails_owner(s, owner_hdr):
    r = s.get(f"{API}/admin/marketing-emails", headers=owner_hdr, timeout=10)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# =============== ACCOUNTING PDF ===============
def test_accounting_pdf(s, owner_hdr):
    now = datetime.now()
    r = s.get(f"{API}/admin/accounting/pdf?month={now.month}&year={now.year}",
              headers=owner_hdr, timeout=20)
    assert r.status_code == 200
    assert r.headers.get("Content-Type") == "application/pdf"
    assert r.content.startswith(b"%PDF"), "PDF must start with %PDF"


# =============== IMAGE UPLOAD ===============
def test_image_upload(s, owner_hdr):
    # 1x1 PNG
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff"
           b"\xff?\x00\x05\xfe\x02\xfe\xa7\x8a\xa2\x00\x00\x00\x00IEND\xaeB`\x82")
    files = {"file": ("test.png", png, "image/png")}
    r = s.post(f"{API}/upload", headers=owner_hdr, files=files, timeout=15)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("/api/uploads/")
    fname = url.rsplit("/", 1)[-1]

    g = s.get(f"{API}/uploads/{fname}", timeout=10)
    assert g.status_code == 200
    assert g.headers.get("Content-Type") == "image/png"
    assert g.content.startswith(b"\x89PNG")


# =============== CLOUDPRNT ===============
def test_cloudprnt_poll_shape(s):
    r = s.post(f"{API}/cloudprnt/poll", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "jobReady" in data
    assert isinstance(data["jobReady"], bool)


def test_cloudprnt_ticket_bytes_when_ready(s, owner_hdr, sample_product):
    """If a print job exists, verify Content-Type text/plain, ends with ESC d 2, no GS V bytes."""
    if not sample_product:
        pytest.skip("no product")
    # Force-create a print job via order + status=preparing
    p = sample_product
    r = s.post(f"{API}/orders", json={
        "menu_type": "restaurant", "fulfillment_type": "takeaway",
        "pickup_time": "ASAP", "payment_method": "onsite",
        "customer": {"first_name": "TESTPRN", "last_name": "X", "phone": "0791", "email": "p@p.com"},
        "items": [{"product_id": p["id"], "name": p["name"], "quantity": 1,
                   "unit_price": p["price"], "line_total": p["price"], "addons": []}],
    }, timeout=15).json()
    oid = r["id"]
    s.patch(f"{API}/admin/orders/{oid}/status?status=preparing",
            headers=owner_hdr, timeout=10)
    time.sleep(0.3)

    # Poll shape
    poll = s.post(f"{API}/cloudprnt/poll", timeout=10).json()
    assert poll["jobReady"] is True, poll
    token = poll["jobToken"]

    # GET ticket
    g = s.get(f"{API}/cloudprnt/poll?token={token}", timeout=10)
    assert g.status_code == 200
    assert g.headers.get("Content-Type", "").startswith("text/plain")
    body = g.content
    # ends with ESC d 2
    assert body.endswith(b"\x1b\x64\x02"), f"ticket must end with ESC d 2, ends with {body[-6:]!r}"
    # No GS V bytes
    assert b"\x1d\x56" not in body, "ticket must not contain GS V bytes"

    # DELETE marks printed
    d = s.delete(f"{API}/cloudprnt/poll?token={token}", timeout=10)
    assert d.status_code == 200
