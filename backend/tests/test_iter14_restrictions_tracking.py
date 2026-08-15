"""Iteration 14 backend tests:
- Category time-restriction schema (restricted_start_hour/end_hour) persists via POST + PUT
- POST /api/orders blocks products whose category window includes current Zurich hour
- POST /api/orders succeeds outside the window
- Email template contains /suivi/{order_id} tracking link
"""
import os
import re
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://angelucci-preview.preview.emergentagent.com").rstrip("/")
ADMIN_USER = os.environ.get("ADMIN_USERNAME", "AngelCED26")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "CE26$Lucc")


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(api_client):
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ----------------- Category restriction schema ------------------

class TestCategoryRestrictionSchema:
    created_ids = []

    def test_create_category_with_restriction(self, api_client, auth):
        payload = {
            "name": f"TEST_Alcool_{uuid.uuid4().hex[:6]}",
            "menu_type": "restaurant",
            "order": 999,
            "restricted_start_hour": 20,
            "restricted_end_hour": 6,
        }
        r = api_client.post(f"{BASE_URL}/api/categories", json=payload, headers=auth)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["restricted_start_hour"] == 20
        assert data["restricted_end_hour"] == 6
        assert data["name"] == payload["name"]
        assert "id" in data
        TestCategoryRestrictionSchema.created_ids.append(data["id"])

        # Verify persistence via GET
        r2 = api_client.get(f"{BASE_URL}/api/categories?menu_type=restaurant")
        assert r2.status_code == 200
        found = next((c for c in r2.json() if c["id"] == data["id"]), None)
        assert found is not None
        assert found["restricted_start_hour"] == 20
        assert found["restricted_end_hour"] == 6

    def test_update_category_restriction(self, api_client, auth):
        assert TestCategoryRestrictionSchema.created_ids, "prior create test required"
        cid = TestCategoryRestrictionSchema.created_ids[0]
        payload = {
            "id": cid,
            "name": f"TEST_Alcool_upd_{uuid.uuid4().hex[:4]}",
            "menu_type": "restaurant",
            "order": 999,
            "restricted_start_hour": 22,
            "restricted_end_hour": 5,
        }
        r = api_client.put(f"{BASE_URL}/api/categories/{cid}", json=payload, headers=auth)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["restricted_start_hour"] == 22
        assert data["restricted_end_hour"] == 5

        # verify persisted
        r2 = api_client.get(f"{BASE_URL}/api/categories?menu_type=restaurant")
        found = next((c for c in r2.json() if c["id"] == cid), None)
        assert found and found["restricted_start_hour"] == 22 and found["restricted_end_hour"] == 5

    def test_create_category_without_restriction(self, api_client, auth):
        payload = {
            "name": f"TEST_NoRestrict_{uuid.uuid4().hex[:6]}",
            "menu_type": "restaurant",
            "order": 998,
        }
        r = api_client.post(f"{BASE_URL}/api/categories", json=payload, headers=auth)
        assert r.status_code == 200
        data = r.json()
        assert data.get("restricted_start_hour") is None
        assert data.get("restricted_end_hour") is None
        TestCategoryRestrictionSchema.created_ids.append(data["id"])

    @classmethod
    def teardown_class(cls):
        # Cleanup
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        if r.status_code == 200:
            tok = r.json()["token"]
            for cid in cls.created_ids:
                s.delete(f"{BASE_URL}/api/categories/{cid}", headers={"Authorization": f"Bearer {tok}"})


# ----------------- Order restriction enforcement ------------------

def _current_zurich_hour():
    return datetime.now(ZoneInfo("Europe/Zurich")).hour


def _build_order_payload(product):
    return {
        "menu_type": product.get("menu_type", "restaurant"),
        "fulfillment_type": "takeaway",
        "pickup_time": "ASAP",
        "customer": {
            "first_name": "Test",
            "last_name": "Iter14",
            "phone": "0790000000",
            "email": "test_iter14@example.com",
            "marketing_opt_in": False,
        },
        "items": [{
            "product_id": product["id"],
            "name": product["name"],
            "quantity": 1,
            "unit_price": product["price"],
            "selected_addons": [],
            "note": "",
            "line_total": product["price"],
        }],
    }


class TestOrderTimeRestriction:
    """Create a temp category + product, then toggle restriction to include/exclude the current hour."""
    cat_id = None
    prod_id = None

    @classmethod
    def setup_class(cls):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
        assert r.status_code == 200
        tok = r.json()["token"]
        headers = {"Authorization": f"Bearer {tok}"}
        # Create restricted category (start/end set below in tests)
        cat = s.post(f"{BASE_URL}/api/categories", json={
            "name": f"TEST_Iter14Cat_{uuid.uuid4().hex[:6]}",
            "menu_type": "restaurant",
            "order": 500,
        }, headers=headers).json()
        cls.cat_id = cat["id"]
        # Create product in this category
        prod = s.post(f"{BASE_URL}/api/products", json={
            "name": "TEST_Iter14Prod",
            "description": "",
            "price": 10.0,
            "image_url": "",
            "category_id": cls.cat_id,
            "menu_type": "restaurant",
            "addon_group_ids": [],
            "tags": [],
            "variants": [],
        }, headers=headers).json()
        cls.prod_id = prod["id"]
        cls._token = tok

    @classmethod
    def teardown_class(cls):
        s = requests.Session()
        headers = {"Authorization": f"Bearer {cls._token}", "Content-Type": "application/json"}
        if cls.prod_id:
            s.delete(f"{BASE_URL}/api/products/{cls.prod_id}", headers=headers)
        if cls.cat_id:
            s.delete(f"{BASE_URL}/api/categories/{cls.cat_id}", headers=headers)

    def _update_cat(self, sh, eh, api_client, auth):
        payload = {
            "id": self.cat_id,
            "name": "TEST_Iter14Cat",
            "menu_type": "restaurant",
            "order": 500,
            "restricted_start_hour": sh,
            "restricted_end_hour": eh,
        }
        r = api_client.put(f"{BASE_URL}/api/categories/{self.cat_id}", json=payload, headers=auth)
        assert r.status_code == 200, r.text

    def _get_product(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/products?menu_type=restaurant")
        assert r.status_code == 200
        return next(p for p in r.json() if p["id"] == self.prod_id)

    def test_order_blocked_when_hour_in_window(self, api_client, auth):
        """Set restriction window to a 2-hour band around the current Zurich hour and expect 400."""
        h = _current_zurich_hour()
        sh = h
        eh = (h + 1) % 24
        # If sh==eh happens (never with +1 mod 24), skip
        self._update_cat(sh, eh, api_client, auth)
        prod = self._get_product(api_client)
        r = api_client.post(f"{BASE_URL}/api/orders", json=_build_order_payload(prod))
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "ne peut pas être commandée" in detail, f"unexpected detail: {detail}"

    def test_order_blocked_wraparound_window(self, api_client, auth):
        """Force a wrap-around window that includes the current hour (sh > eh)."""
        h = _current_zurich_hour()
        # Choose sh, eh so that sh>eh and (h>=sh or h<eh) is True.
        # Easiest: sh = h, eh = (h - 1) % 24 -> covers all hours except h-1, but requires sh>eh.
        # If h=0 that gives sh=0, eh=23 -> sh<eh so not wrap. Handle separately.
        if h == 0:
            sh, eh = 23, 22  # wrap window covers hours >=23 or <22 -> includes 0
        else:
            sh = h
            eh = (h - 1) % 24
            if sh < eh:
                # shouldn't happen unless h==0 which we handled
                sh, eh = 23, 22
        assert sh > eh, f"expected wrap, got sh={sh} eh={eh}"
        self._update_cat(sh, eh, api_client, auth)
        prod = self._get_product(api_client)
        r = api_client.post(f"{BASE_URL}/api/orders", json=_build_order_payload(prod))
        assert r.status_code == 400, f"expected 400 wrap, got {r.status_code}: {r.text}"
        assert "ne peut pas être commandée" in r.json().get("detail", "")

    def test_order_succeeds_outside_window(self, api_client, auth):
        """Set restriction window to a small band NOT including current hour."""
        h = _current_zurich_hour()
        # pick sh = (h+2)%24, eh = (h+3)%24 -> band excludes h (and neighbors)
        sh = (h + 2) % 24
        eh = (h + 3) % 24
        self._update_cat(sh, eh, api_client, auth)
        prod = self._get_product(api_client)
        r = api_client.post(f"{BASE_URL}/api/orders", json=_build_order_payload(prod))
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "id" in data and "order_number" in data
        # Verify persisted via GET /api/orders/{id}
        got = api_client.get(f"{BASE_URL}/api/orders/{data['id']}")
        assert got.status_code == 200
        assert got.json()["status"] == "new"
        # Clean up order
        # (No delete endpoint public; leave as TEST_ data)


# ----------------- Email template tracking link ------------------

class TestEmailTemplateTrackingLink:
    def test_emails_module_contains_suivi_link(self):
        emails_path = os.path.join(os.path.dirname(__file__), "..", "emails.py")
        emails_path = os.path.abspath(emails_path)
        with open(emails_path, "r") as f:
            src = f.read()
        assert "SUIVRE MA COMMANDE" in src, "tracking CTA text missing in emails.py"
        assert "/suivi/" in src, "/suivi/ path missing"
        # Ensure the href uses order id interpolation
        assert re.search(r"/suivi/\{order\[['\"]id['\"]\]\}", src) or "/suivi/{order['id']}" in src, \
            "tracking URL not interpolating order['id']"


# ----------------- GET /api/orders/{id} (used by /suivi page) ------------------

class TestOrderTrackingApi:
    def test_get_unknown_order_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/orders/does-not-exist-{uuid.uuid4().hex}")
        assert r.status_code == 404
