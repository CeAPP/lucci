"""Iteration 16 — schedule (continuous window) + product reorder endpoint."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"
USER = "AngelCED26"
PWD = "CE26$Lucc"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": USER, "password": PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- schedules: dinner_* must be empty for all 3 kinds ---
@pytest.mark.parametrize("kind", ["restaurant", "reservation", "epicerie"])
def test_schedule_no_dinner(kind):
    r = requests.get(f"{API}/schedule/{kind}", timeout=10)
    assert r.status_code == 200, r.text
    days = r.json().get("days", {})
    assert days, f"No days for {kind}"
    for dkey, d in days.items():
        assert d.get("dinner_start", "") == "", f"{kind}/{dkey} dinner_start not empty: {d}"
        assert d.get("dinner_end", "") == "", f"{kind}/{dkey} dinner_end not empty: {d}"
        if not d.get("closed"):
            assert d.get("lunch_start"), f"{kind}/{dkey} lunch_start missing"
            assert d.get("lunch_end"), f"{kind}/{dkey} lunch_end missing"


# --- product reorder endpoint ---
def test_reorder_products(auth_headers):
    r = requests.get(f"{API}/products?menu_type=restaurant", timeout=10)
    assert r.status_code == 200
    prods = r.json()
    if len(prods) < 2:
        # Seed additional products for testing
        cats = requests.get(f"{API}/categories?menu_type=restaurant", timeout=10).json()
        assert cats, "No restaurant categories"
        cid = cats[0]["id"]
        for i in range(3):
            payload = {
                "name": f"TEST_reorder_{i}",
                "description": "",
                "price": 10.0,
                "image_url": "",
                "category_id": cid,
                "menu_type": "restaurant",
                "addon_group_ids": [],
                "tags": [],
                "variants": [],
                "is_active": True,
            }
            requests.post(f"{API}/products", json=payload, headers=auth_headers, timeout=10)
        prods = requests.get(f"{API}/products?menu_type=restaurant", timeout=10).json()

    ids = [p["id"] for p in prods[:3]]
    # reverse them
    reversed_ids = list(reversed(ids))
    r = requests.post(
        f"{API}/products/reorder",
        json={"ordered_ids": reversed_ids},
        headers=auth_headers,
        timeout=10,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body.get("count") == 3

    # Verify sort_order persisted
    prods2 = requests.get(f"{API}/products?menu_type=restaurant", timeout=10).json()
    by_id = {p["id"]: p for p in prods2}
    for idx, pid in enumerate(reversed_ids):
        assert by_id[pid]["sort_order"] == idx, f"{pid}: expected {idx}, got {by_id[pid]['sort_order']}"

    # Cleanup: delete TEST_ products
    for p in prods2:
        if p["name"].startswith("TEST_reorder_"):
            requests.delete(f"{API}/products/{p['id']}", headers=auth_headers, timeout=10)


def test_reorder_requires_auth():
    r = requests.post(f"{API}/products/reorder", json={"ordered_ids": []}, timeout=10)
    assert r.status_code in (401, 403)
