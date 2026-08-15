"""Iteration 15 — Reservations: seen_by_admin field + admin PATCH endpoints.

Rate-limit: 3 reservations / 15 min / IP. This suite creates exactly 3
reservations and reuses ids across tests.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')

ADMIN_USER = "AngelCED26"
ADMIN_PASS = "CE26$Lucc"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _make_reservation(first_name="TEST_Iter15"):
    payload = {
        "first_name": first_name,
        "phone": "+41780000000",
        "email": "test_res@example.com",
        "date": "2026-12-25",
        "time": "19:30",
        "people": 2,
        "comment": "iter15 test",
        "hp_field": "",
    }
    r = requests.post(f"{BASE_URL}/api/reservations", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["status"] == "confirmed"
    return j["id"]


# Module-scoped: create the 3 reservations we will reuse.
@pytest.fixture(scope="module")
def rids():
    return {
        "for_list_and_seen": _make_reservation("TEST_Iter15_A"),
        "for_status": _make_reservation("TEST_Iter15_B"),
        "for_auth": _make_reservation("TEST_Iter15_C"),
    }


# Reservation POST returns id + status=confirmed (validated inside _make_reservation)
def test_reservations_created(rids):
    assert all(v and v != "spam" for v in rids.values())


# Reservation is persisted with seen_by_admin=false
def test_reservation_has_seen_by_admin_false(auth_headers, rids):
    rid = rids["for_list_and_seen"]
    r = requests.get(f"{BASE_URL}/api/admin/reservations", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    match = [x for x in r.json() if x["id"] == rid]
    assert len(match) == 1
    assert match[0]["seen_by_admin"] is False
    assert match[0]["status"] == "confirmed"


# PATCH /seen sets seen_by_admin=true
def test_patch_seen_sets_true(auth_headers, rids):
    rid = rids["for_list_and_seen"]
    r = requests.patch(f"{BASE_URL}/api/admin/reservations/{rid}/seen",
                       headers=auth_headers, timeout=15)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/admin/reservations", headers=auth_headers, timeout=15)
    match = [x for x in r2.json() if x["id"] == rid][0]
    assert match["seen_by_admin"] is True


# PATCH /status implicitly sets seen_by_admin=true
def test_patch_status_sets_seen_implicitly(auth_headers, rids):
    rid = rids["for_status"]
    r = requests.patch(f"{BASE_URL}/api/admin/reservations/{rid}/status",
                       params={"status": "confirmed"},
                       headers=auth_headers, timeout=15)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/admin/reservations", headers=auth_headers, timeout=15)
    match = [x for x in r2.json() if x["id"] == rid][0]
    assert match["seen_by_admin"] is True
    assert match["status"] == "confirmed"


# Admin endpoints require auth
def test_seen_endpoint_requires_auth(rids):
    rid = rids["for_auth"]
    r = requests.patch(f"{BASE_URL}/api/admin/reservations/{rid}/seen", timeout=15)
    assert r.status_code in (401, 403)


def test_admin_list_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/reservations", timeout=15)
    assert r.status_code in (401, 403)
