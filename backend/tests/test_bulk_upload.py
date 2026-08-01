"""Tests for bulk product image upload feature (POST /api/admin/products/upload)."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://angelucci-preview.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "AngelCED26"
ADMIN_PASS = "CE26$Lucc"

# tiny 2-byte "jpeg" is enough (backend only checks extension)
IMG_BYTES = b"\xff\xd8"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"] if "access_token" in r.json() else r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # teardown - delete all created products
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    if r.status_code == 200:
        j = r.json()
        tok = j.get("access_token") or j.get("token")
        h = {"Authorization": f"Bearer {tok}"}
        for pid in ids:
            try:
                requests.delete(f"{BASE_URL}/api/products/{pid}", headers=h, timeout=10)
            except Exception:
                pass


@pytest.mark.parametrize("filename,expected_name,expected_price", [
    ("Tagliatelles al ragù 26.50.jpg", "Tagliatelles al ragù", 26.5),
    ("Parmigiano_24_mois_18.90.png", "Parmigiano 24 mois", 18.9),
    ("Ossobuco - 32 CHF.webp", "Ossobuco", 32.0),
    ("Simple pasta.jpg", "Simple pasta", 0.0),
])
def test_upload_parses_filename(headers, created_ids, filename, expected_name, expected_price):
    files = {"file": (filename, io.BytesIO(IMG_BYTES), "image/jpeg")}
    r = requests.post(
        f"{BASE_URL}/api/admin/products/upload",
        params={"menu_type": "restaurant"},
        files=files,
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == expected_name, f"expected {expected_name!r}, got {data['name']!r}"
    assert data["price"] == expected_price
    assert data["image_url"].startswith("/api/uploads/")
    assert data["menu_type"] == "restaurant"
    created_ids.append(data["id"])


def test_upload_epicerie(headers, created_ids):
    files = {"file": ("Huile olive Toscana 12.50.jpg", io.BytesIO(IMG_BYTES), "image/jpeg")}
    r = requests.post(
        f"{BASE_URL}/api/admin/products/upload",
        params={"menu_type": "epicerie"},
        files=files,
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["menu_type"] == "epicerie"
    assert data["name"] == "Huile olive Toscana"
    assert data["price"] == 12.5
    created_ids.append(data["id"])


def test_uploaded_files_visible_in_products(headers, created_ids):
    # products list endpoint
    r = requests.get(f"{BASE_URL}/api/products", timeout=15)
    assert r.status_code == 200
    prods = r.json()
    ids_seen = {p["id"] for p in prods}
    for pid in created_ids:
        assert pid in ids_seen, f"created product {pid} not in list"


def test_upload_invalid_extension_rejected(headers):
    files = {"file": ("bad.txt", io.BytesIO(b"hello"), "text/plain")}
    r = requests.post(
        f"{BASE_URL}/api/admin/products/upload",
        params={"menu_type": "restaurant"},
        files=files,
        headers=headers,
        timeout=15,
    )
    assert r.status_code == 400


def test_upload_requires_auth():
    files = {"file": ("test 5.00.jpg", io.BytesIO(IMG_BYTES), "image/jpeg")}
    r = requests.post(
        f"{BASE_URL}/api/admin/products/upload",
        params={"menu_type": "restaurant"},
        files=files,
        timeout=15,
    )
    assert r.status_code in (401, 403)
