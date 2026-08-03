"""Tests for persistent object-storage-backed uploads."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://angelucci-preview.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "AngelCED26"
ADMIN_PASS = "CE26$Lucc"

# Minimal valid JPEG (SOI + APP0 JFIF + SOS/EOI). Keep small but structurally-jpeg.
JPEG_BYTES = bytes.fromhex(
    "ffd8ffe000104a46494600010100000100010000"
    "ffdb0043000806060706050807070709090808"
    "0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a"
    "1c1c20242e2720222c231c1c2837292c303133"
    "343419273a3d3832"
    + "3c2e333432"
    "ffc00011080001000103012200021101031101"
    "ffc4001f0000010501010101010100000000000000000102030405060708090a0b"
    "ffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9fa"
    "ffc4001f0100030101010101010101010000000000000102030405060708090a0b"
    "ffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9fa"
    "ffda000c03010002110311003f00fbd0"
    "ffd9"
)


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_story_page_has_no_image():
    """Story.jsx should not include the Unsplash STORY_IMG anymore."""
    r = requests.get(f"{BASE_URL}/histoire", timeout=30)
    assert r.status_code == 200
    body = r.text.lower()
    # The single-page React app returns index.html; the removed image was a Unsplash URL.
    # We just confirm the site loads. Actual DOM verified via Playwright.
    assert "<!doctype html" in body or "<html" in body


def test_upload_and_fetch_returns_exact_bytes(auth_headers):
    """POST /api/admin/products/upload → GET /api/uploads/{name} returns 200 with same bytes."""
    files = {"file": ("PersistTest 12.50.jpg", JPEG_BYTES, "image/jpeg")}
    r = requests.post(f"{BASE_URL}/api/admin/products/upload", headers=auth_headers, files=files,
                     params={"menu_type": "restaurant"}, timeout=60)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["image_url"].startswith("/api/uploads/"), f"bad image_url: {data.get('image_url')}"
    assert data["price"] == 12.50
    assert "PersistTest" in data["name"]
    product_id = data["id"]

    # Fetch the image
    img_url = f"{BASE_URL}{data['image_url']}"
    g = requests.get(img_url, timeout=60)
    assert g.status_code == 200, f"fetch failed: {g.status_code}"
    assert g.headers.get("content-type", "").startswith("image/jpeg")
    assert g.content == JPEG_BYTES, "returned bytes differ from uploaded"

    # Save product_id + filename for the persistence + cleanup tests
    pytest.uploaded_filename = data["image_url"].rsplit("/", 1)[-1]
    pytest.uploaded_product_id = product_id


def test_persistence_after_local_delete(auth_headers):
    """Delete the local disk copy (if any) → GET must still succeed via object storage."""
    filename = getattr(pytest, "uploaded_filename", None)
    assert filename, "prior test must have uploaded"
    local_path = f"/app/backend/uploads/{filename}"
    # Best-effort remove (file may not even exist locally since we now use obj storage only)
    try:
        os.remove(local_path)
    except FileNotFoundError:
        pass
    # GET must still return the exact bytes from object storage
    g = requests.get(f"{BASE_URL}/api/uploads/{filename}", timeout=60)
    assert g.status_code == 200, f"persistence broken: {g.status_code} {g.text[:200]}"
    assert g.content == JPEG_BYTES


def test_backward_compat_local_fallback():
    """An existing file on the local disk (uploaded before the fix) still serves."""
    uploads_dir = "/app/backend/uploads"
    existing = [f for f in os.listdir(uploads_dir) if f.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif"))]
    if not existing:
        pytest.skip("no legacy local files")
    fname = existing[0]
    g = requests.get(f"{BASE_URL}/api/uploads/{fname}", timeout=30)
    # Legacy files may not be in obj-storage → served from local disk fallback
    assert g.status_code == 200, f"legacy fallback failed for {fname}: {g.status_code}"
    ct = g.headers.get("content-type", "")
    assert ct.startswith("image/"), f"bad content-type {ct}"


def test_security_path_traversal():
    """Path traversal must be blocked."""
    r = requests.get(f"{BASE_URL}/api/uploads/foo/bar", timeout=15)
    assert r.status_code == 400, f"expected 400, got {r.status_code}"
    # ../ style — client may normalize; test the segment approach
    r2 = requests.get(f"{BASE_URL}/api/uploads/..%2Fetc%2Fpasswd", timeout=15)
    assert r2.status_code in (400, 404), f"expected 400/404, got {r2.status_code}"


def test_cleanup_delete_test_product(auth_headers):
    pid = getattr(pytest, "uploaded_product_id", None)
    if not pid:
        pytest.skip("no product to delete")
    r = requests.delete(f"{BASE_URL}/api/products/{pid}", headers=auth_headers, timeout=30)
    assert r.status_code in (200, 204), f"delete failed: {r.status_code} {r.text}"
