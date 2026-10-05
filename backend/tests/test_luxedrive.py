"""
LuxeDrive backend API tests.
Covers: auth, cars, pricing/quote (surge), orders CRUD, accept-with-driver,
reject, complete, rate, admin stats, role gates, legacy backfill readability.
"""
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN_EMAIL = "admin@luxedrive.com"
ADMIN_PASS = "Admin1234"
ADMIN_CODE = "LUXE2026"


# ---------------------- helpers ----------------------
def _rand_email(prefix="TEST_cust"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"


def _iso_at_hour(hour: int, days_ahead: int = 1) -> str:
    """Build a UTC ISO timestamp at a specific hour (used so night-surge is deterministic)."""
    base = datetime.now(timezone.utc) + timedelta(days=days_ahead)
    dt = base.replace(hour=hour, minute=0, second=0, microsecond=0)
    return dt.isoformat()


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------------- fixtures ----------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def customer():
    email = _rand_email()
    r = requests.post(f"{BASE}/auth/register",
                      json={"email": email, "password": "Pass1234", "name": "TEST Cust"})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "email": email}


@pytest.fixture(scope="module")
def customer2():
    email = _rand_email("TEST_cust2")
    r = requests.post(f"{BASE}/auth/register",
                      json={"email": email, "password": "Pass1234", "name": "TEST Cust2"})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "email": email}


# ---------------------- Auth ----------------------
def test_register_customer_201():
    email = _rand_email()
    r = requests.post(f"{BASE}/auth/register",
                      json={"email": email, "password": "Pass1234", "name": "TEST U"})
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "customer"
    assert data["user"]["email"] == email.lower()


def test_register_admin_wrong_code_403():
    email = _rand_email("TEST_adm")
    r = requests.post(f"{BASE}/auth/register", json={
        "email": email, "password": "Pass1234", "name": "A",
        "role": "company_admin", "admin_code": "WRONG"})
    assert r.status_code == 403


def test_login_seeded_admin(admin_token):
    assert admin_token


def test_me_no_token_401():
    r = requests.get(f"{BASE}/auth/me")
    assert r.status_code == 401


# ---------------------- Cars ----------------------
def test_list_cars():
    r = requests.get(f"{BASE}/cars")
    assert r.status_code == 200
    data = r.json()
    assert {c["id"] for c in data} == {"vip", "luxury", "normal"}


# ---------------------- Pricing / Surge ----------------------
# VIP base=150, luxury=90, normal=45
class TestPricingQuote:
    def test_daytime_non_airport_1x(self):
        payload = {
            "car_id": "normal",
            "pickup_location": "Downtown",
            "dropoff_location": "Mall",
            "scheduled_at": _iso_at_hour(14),
        }
        r = requests.post(f"{BASE}/pricing/quote", json=payload)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["base"] == 45.0
        assert q["multiplier"] == 1.0
        assert q["reasons"] == []
        assert q["total"] == 45.0

    def test_night_only_plus_25(self):
        payload = {
            "car_id": "luxury",
            "pickup_location": "Hotel",
            "dropoff_location": "Office",
            "scheduled_at": _iso_at_hour(23),
        }
        r = requests.post(f"{BASE}/pricing/quote", json=payload)
        q = r.json()
        assert q["multiplier"] == 1.25
        assert any("Night" in s for s in q["reasons"])
        assert q["total"] == round(90.0 * 1.25, 2)

    def test_night_early_morning_hour_4(self):
        # hour=4 should still be night (hour < 5)
        payload = {
            "car_id": "normal",
            "pickup_location": "A", "dropoff_location": "B",
            "scheduled_at": _iso_at_hour(4),
        }
        q = requests.post(f"{BASE}/pricing/quote", json=payload).json()
        assert q["multiplier"] == 1.25

    def test_hour_5_is_not_night(self):
        q = requests.post(f"{BASE}/pricing/quote", json={
            "car_id": "normal", "pickup_location": "A", "dropoff_location": "B",
            "scheduled_at": _iso_at_hour(5)}).json()
        assert q["multiplier"] == 1.0

    def test_airport_only_plus_20(self):
        payload = {
            "car_id": "vip",
            "pickup_location": "Riyadh Airport",
            "dropoff_location": "Hotel",
            "scheduled_at": _iso_at_hour(12),
        }
        q = requests.post(f"{BASE}/pricing/quote", json=payload).json()
        assert q["multiplier"] == 1.2
        assert any("Airport" in s for s in q["reasons"])
        assert q["total"] == round(150.0 * 1.2, 2)

    def test_airport_arabic_match(self):
        q = requests.post(f"{BASE}/pricing/quote", json={
            "car_id": "normal", "pickup_location": "فندق",
            "dropoff_location": "مطار الرياض",
            "scheduled_at": _iso_at_hour(12)}).json()
        assert q["multiplier"] == 1.2

    def test_night_and_airport_plus_45(self):
        payload = {
            "car_id": "vip",
            "pickup_location": "Home", "dropoff_location": "JFK Airport",
            "scheduled_at": _iso_at_hour(23),
        }
        q = requests.post(f"{BASE}/pricing/quote", json=payload).json()
        assert q["multiplier"] == 1.45
        assert len(q["reasons"]) == 2
        assert q["total"] == round(150.0 * 1.45, 2)

    def test_invalid_car_id_422(self):
        r = requests.post(f"{BASE}/pricing/quote", json={
            "car_id": "bogus", "pickup_location": "A", "dropoff_location": "B",
            "scheduled_at": _iso_at_hour(12)})
        assert r.status_code == 422


# ---------------------- Orders: create with surge + coords ----------------------
class TestCreateOrder:
    def test_server_computes_price_ignores_client(self, customer):
        sched = _iso_at_hour(23)  # night
        r = requests.post(f"{BASE}/orders", headers=_auth(customer["token"]), json={
            "car_id": "vip",
            "pickup_location": "Home",
            "dropoff_location": "Dubai Airport",
            "scheduled_at": sched,
            "price": 9999,  # client-supplied, should be ignored
        })
        assert r.status_code == 201, r.text
        o = r.json()
        assert o["base_price"] == 150.0
        assert o["surge_multiplier"] == 1.45
        assert set(o["surge_reasons"]) and len(o["surge_reasons"]) == 2
        assert o["price"] == round(150.0 * 1.45, 2)
        assert o["status"] == "pending"

    def test_coords_echoed(self, customer):
        sched = _iso_at_hour(14)
        r = requests.post(f"{BASE}/orders", headers=_auth(customer["token"]), json={
            "car_id": "normal",
            "pickup_location": "P", "dropoff_location": "D",
            "scheduled_at": sched,
            "pickup_lat": 24.7136, "pickup_lng": 46.6753,
            "dropoff_lat": 24.4539, "dropoff_lng": 54.3773,
        })
        assert r.status_code == 201, r.text
        o = r.json()
        assert o["pickup_lat"] == 24.7136 and o["pickup_lng"] == 46.6753
        assert o["dropoff_lat"] == 24.4539 and o["dropoff_lng"] == 54.3773
        assert o["surge_multiplier"] == 1.0

    def test_admin_cannot_create_order(self, admin_token):
        r = requests.post(f"{BASE}/orders", headers=_auth(admin_token), json={
            "car_id": "vip", "pickup_location": "A", "dropoff_location": "B",
            "scheduled_at": _iso_at_hour(14)})
        assert r.status_code == 403


# ---------------------- Orders: accept/reject/complete/rate ----------------------
def _make_order(cust, car="normal", hour=14, pickup="A", dropoff="B"):
    r = requests.post(f"{BASE}/orders", headers=_auth(cust["token"]), json={
        "car_id": car, "pickup_location": pickup, "dropoff_location": dropoff,
        "scheduled_at": _iso_at_hour(hour)})
    assert r.status_code == 201, r.text
    return r.json()


class TestAcceptFlow:
    def test_accept_with_driver_sets_fields(self, customer, admin_token):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                          json={"driver_name": "Ali", "driver_plate": "RUH-123", "driver_phone": "0501234567"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "accepted"
        assert d["driver_name"] == "Ali" and d["driver_plate"] == "RUH-123"
        assert d["driver_phone"] == "0501234567"
        # Customer sees driver fields in /orders/my
        r2 = requests.get(f"{BASE}/orders/my", headers=_auth(customer["token"]))
        assert r2.status_code == 200
        my = [x for x in r2.json() if x["id"] == o["id"]][0]
        assert my["driver_name"] == "Ali" and my["driver_plate"] == "RUH-123"

    def test_accept_without_driver_name_422(self, customer, admin_token):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                          json={"driver_plate": "ABC-1"})
        assert r.status_code == 422

    def test_accept_without_driver_plate_422(self, customer, admin_token):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                          json={"driver_name": "Omar"})
        assert r.status_code == 422

    def test_accept_phone_optional(self, customer, admin_token):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                          json={"driver_name": "Omar", "driver_plate": "XYZ-9"})
        assert r.status_code == 200
        assert r.json()["driver_phone"] is None

    def test_accept_non_pending_400(self, customer, admin_token):
        o = _make_order(customer)
        requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                      json={"driver_name": "N", "driver_plate": "P"})
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                         json={"driver_name": "N2", "driver_plate": "P2"})
        assert r.status_code == 400

    def test_customer_cannot_accept_403(self, customer):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(customer["token"]),
                          json={"driver_name": "N", "driver_plate": "P"})
        assert r.status_code == 403


class TestRejectFlow:
    def test_admin_reject_pending(self, customer, admin_token):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/reject", headers=_auth(admin_token))
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_reject_non_pending_400(self, customer, admin_token):
        o = _make_order(customer)
        requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                      json={"driver_name": "N", "driver_plate": "P"})
        r = requests.post(f"{BASE}/orders/{o['id']}/reject", headers=_auth(admin_token))
        assert r.status_code == 400

    def test_customer_cannot_reject_403(self, customer):
        o = _make_order(customer)
        r = requests.post(f"{BASE}/orders/{o['id']}/reject", headers=_auth(customer["token"]))
        assert r.status_code == 403


class TestCompleteFlow:
    def test_complete_accepted(self, customer, admin_token):
        o = _make_order(customer)
        requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                      json={"driver_name": "N", "driver_plate": "P"})
        r = requests.post(f"{BASE}/orders/{o['id']}/complete", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "completed"
        assert d["completed_at"] is not None

    def test_complete_non_accepted_400(self, customer, admin_token):
        o = _make_order(customer)  # still pending
        r = requests.post(f"{BASE}/orders/{o['id']}/complete", headers=_auth(admin_token))
        assert r.status_code == 400

    def test_customer_cannot_complete_403(self, customer, admin_token):
        o = _make_order(customer)
        requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                      json={"driver_name": "N", "driver_plate": "P"})
        r = requests.post(f"{BASE}/orders/{o['id']}/complete", headers=_auth(customer["token"]))
        assert r.status_code == 403


# ---------------------- Rating ----------------------
def _complete_order(cust, admin_token):
    o = _make_order(cust)
    requests.post(f"{BASE}/orders/{o['id']}/accept", headers=_auth(admin_token),
                  json={"driver_name": "N", "driver_plate": "P"})
    requests.post(f"{BASE}/orders/{o['id']}/complete", headers=_auth(admin_token))
    return o


class TestRating:
    def test_rate_completed_saves(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                          json={"rating": 5, "comment": "Great"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rating"] == 5 and d["rating_comment"] == "Great"
        assert d["rated_at"] is not None

    def test_rate_comment_optional(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                          json={"rating": 4})
        assert r.status_code == 200
        assert r.json()["rating"] == 4

    def test_rate_twice_400(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r1 = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                           json={"rating": 3})
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                           json={"rating": 2})
        assert r2.status_code == 400
        assert "already" in r2.json()["detail"].lower()

    def test_rate_non_completed_400(self, customer, admin_token):
        o = _make_order(customer)  # pending
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                         json={"rating": 5})
        assert r.status_code == 400

    def test_rate_by_other_customer_403(self, customer, customer2, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer2["token"]),
                         json={"rating": 5})
        assert r.status_code == 403

    def test_rate_zero_422(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                         json={"rating": 0})
        assert r.status_code == 422

    def test_rate_six_422(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                         json={"rating": 6})
        assert r.status_code == 422

    def test_admin_cannot_rate_403(self, customer, admin_token):
        o = _complete_order(customer, admin_token)
        r = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(admin_token),
                         json={"rating": 5})
        assert r.status_code == 403


# ---------------------- Stats ----------------------
class TestStats:
    def test_customer_cannot_see_stats_403(self, customer):
        r = requests.get(f"{BASE}/orders/stats", headers=_auth(customer["token"]))
        assert r.status_code == 403

    def test_admin_stats_reflects_ratings(self, customer, admin_token):
        # Create and rate 2 fresh orders with known ratings
        for rating in (4, 2):
            o = _complete_order(customer, admin_token)
            rr = requests.post(f"{BASE}/orders/{o['id']}/rate", headers=_auth(customer["token"]),
                               json={"rating": rating})
            assert rr.status_code == 200
        r = requests.get(f"{BASE}/orders/stats", headers=_auth(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["avg_rating"], (int, float))
        assert d["rated_count"] >= 2
        assert 1.0 <= d["avg_rating"] <= 5.0


# ---------------------- Legacy backfill readability ----------------------
class TestLegacyBackfill:
    def test_my_orders_readable(self, customer):
        # If any legacy orders exist in DB without base_price, startup backfill should have added them.
        # This endpoint will fail with 500 or ValidationError if any order is missing required fields.
        r = requests.get(f"{BASE}/orders/my", headers=_auth(customer["token"]))
        assert r.status_code == 200
        for o in r.json():
            assert "base_price" in o and o["base_price"] is not None
            assert "surge_multiplier" in o
            assert isinstance(o["surge_reasons"], list)

    def test_admin_list_all_readable(self, admin_token):
        r = requests.get(f"{BASE}/orders", headers=_auth(admin_token))
        assert r.status_code == 200
        for o in r.json():
            assert o.get("base_price") is not None
