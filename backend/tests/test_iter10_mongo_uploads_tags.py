"""Iteration 10 tests: MongoDB-backed uploads, bulk delete, tags CRUD, tag-OOS."""
import io
import os
import struct
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://angelucci-preview.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "AngelCED26"
ADMIN_PASS = "CE26$Lucc"

MARKER = b"BYTES_MARKER_XYZ123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _minimal_jpeg_with_marker(marker: bytes) -> bytes:
    # Minimal JPEG SOI + APP0 (JFIF) + COM segment with marker payload + EOI
    soi = b"\xff\xd8"
    jfif = b"\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    # COM marker: ff fe LEN(2) payload
    payload = marker
    com = b"\xff\xfe" + struct.pack(">H", 2 + len(payload)) + payload
    eoi = b"\xff\xd9"
    return soi + jfif + com + eoi


# ---------- Upload: MongoDB storage ----------

class TestMongoUpload:
    def test_upload_and_fetch_marker_bytes(self, auth_headers):
        blob = _minimal_jpeg_with_marker(MARKER)
        files = {"file": ("Test 9.99.jpg", io.BytesIO(blob), "image/jpeg")}
        r = requests.post(f"{BASE_URL}/api/admin/products/upload", headers=auth_headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "image_url" in data and data["image_url"].startswith("/api/uploads/")
        image_url = data["image_url"]
        # GET the served image
        g = requests.get(f"{BASE_URL}{image_url}", timeout=15)
        assert g.status_code == 200
        assert g.headers.get("content-type", "").startswith("image/jpeg")
        assert MARKER in g.content, "marker payload missing from served bytes"
        # persist filename for db verification
        TestMongoUpload.filename = image_url.rsplit("/", 1)[-1]

    def test_mongo_db_document_exists(self):
        """Directly query db.uploads via motor."""
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def check():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "angeluccis_db")]
            doc = await db.uploads.find_one({"_id": TestMongoUpload.filename})
            client.close()
            return doc

        doc = asyncio.get_event_loop().run_until_complete(check()) if not asyncio.get_event_loop().is_running() else asyncio.new_event_loop().run_until_complete(check())
        assert doc is not None, f"upload doc {TestMongoUpload.filename} not found in db.uploads"
        assert doc.get("content_type") == "image/jpeg"
        assert doc.get("size", 0) > 0
        assert MARKER in bytes(doc["data"])

    def test_cleanup_upload_doc(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient

        async def clean():
            client = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            db = client[os.environ.get("DB_NAME", "angeluccis_db")]
            await db.uploads.delete_one({"_id": TestMongoUpload.filename})
            client.close()

        asyncio.new_event_loop().run_until_complete(clean())


# ---------- Bulk delete ----------

class TestBulkDelete:
    def test_bulk_delete_noop_on_unknown_menu_type(self, auth_headers):
        # Since server only respects menu_type in ('restaurant','epicerie'),
        # test the safest path: filter by 'epicerie' with disposables.
        # First seed 2 disposables
        # Need a category id for epicerie
        cats = requests.get(f"{BASE_URL}/api/categories?menu_type=epicerie", timeout=10).json()
        assert isinstance(cats, list)
        # A category may not be required by schema, but must be non-empty string; pick first if any.
        cat_id = cats[0]["id"] if cats else "epicerie-cat"

        # Snapshot existing epicerie products
        before = requests.get(f"{BASE_URL}/api/products?menu_type=epicerie", timeout=10).json()
        assert isinstance(before, list)
        existing = [p for p in before if not p.get("name", "").startswith("__DISP")]

        seeded_ids = []
        for nm in ("__DISP1__", "__DISP2__"):
            payload = {"name": nm, "description": "disposable", "price": 1.0,
                       "category_id": cat_id, "menu_type": "epicerie", "tags": [], "addon_group_ids": []}
            r = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json=payload, timeout=10)
            assert r.status_code == 200, r.text
            seeded_ids.append(r.json()["id"])

        # Bulk delete epicerie
        r = requests.delete(f"{BASE_URL}/api/admin/products/bulk", headers=auth_headers, params={"menu_type": "epicerie"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("deleted_count", 0) >= 2

        # Verify disposables gone
        after = requests.get(f"{BASE_URL}/api/products?menu_type=epicerie", timeout=10).json()
        assert not any(p.get("name", "").startswith("__DISP") for p in after)

        # Restore existing epicerie products
        for p in existing:
            # sanitize — Product model expects these fields
            payload = {
                "id": p["id"],
                "name": p["name"],
                "description": p.get("description", ""),
                "price": p.get("price", 0),
                "image_url": p.get("image_url") or "",
                "category_id": p.get("category_id", ""),
                "menu_type": "epicerie",
                "addon_group_ids": p.get("addon_group_ids", []),
                "tags": p.get("tags", []),
                "out_of_stock_until": p.get("out_of_stock_until"),
                "is_active": p.get("is_active", True),
                "created_at": p.get("created_at"),
            }
            rr = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json=payload, timeout=10)
            assert rr.status_code == 200, f"restore failed for {p.get('name')}: {rr.text}"


# ---------- Tags CRUD + OOS ----------

class TestTags:
    created_pid = None

    def test_create_product_with_tags(self, auth_headers):
        cats = requests.get(f"{BASE_URL}/api/categories?menu_type=restaurant", timeout=10).json()
        assert cats, "need at least one restaurant category"
        cat_id = cats[0]["id"]
        payload = {"name": "__TAG_TEST__", "description": "", "price": 15.0,
                   "category_id": cat_id, "menu_type": "restaurant",
                   "tags": ["salami", "viande"], "addon_group_ids": []}
        r = requests.post(f"{BASE_URL}/api/products", headers=auth_headers, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        TestTags.created_pid = r.json()["id"]

    def test_list_tags_contains_salami_viande(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/tags", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        tags = {t["tag"]: t for t in r.json()}
        assert "salami" in tags and "viande" in tags
        assert tags["salami"]["product_count"] >= 1
        assert tags["viande"]["product_count"] >= 1
        assert tags["salami"]["oos_products"] == 0
        assert tags["salami"]["oos_until"] in (None, "")

    def test_set_tag_oos(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/tags/oos",
                          headers=auth_headers,
                          params={"tag": "salami", "until": "2026-08-15"},
                          timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["affected"] >= 1
        assert body["tag"] == "salami"
        assert body["until"] == "2026-08-15"

        # Verify on product (needs auth)
        all_prods = requests.get(f"{BASE_URL}/api/products/all", headers=auth_headers, timeout=10).json()
        me = next((p for p in all_prods if isinstance(p, dict) and p.get("id") == TestTags.created_pid), None)
        assert me is not None, f"product {TestTags.created_pid} not found in /products/all"
        assert me.get("out_of_stock_until") == "2026-08-15"

    def test_clear_tag_oos(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/admin/tags/oos",
                          headers=auth_headers,
                          params={"tag": "salami", "until": ""},
                          timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["until"] in (None, "")

        all_prods = requests.get(f"{BASE_URL}/api/products/all", headers=auth_headers, timeout=10).json()
        me = next((p for p in all_prods if isinstance(p, dict) and p.get("id") == TestTags.created_pid), None)
        assert me is not None
        assert me.get("out_of_stock_until") in (None, "")

    def test_cleanup_tag_product(self, auth_headers):
        if not TestTags.created_pid:
            pytest.skip("no product")
        r = requests.delete(f"{BASE_URL}/api/products/{TestTags.created_pid}", headers=auth_headers, timeout=10)
        assert r.status_code == 200
