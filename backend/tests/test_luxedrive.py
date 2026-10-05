import os, uuid, pytest, requests
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN_EMAIL = "admin@luxedrive.com"
ADMIN_PASS = "Admin1234"
ADMIN_CODE = "LUXE2026"

def _rand_email(prefix="TEST_cust"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"

@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

@pytest.fixture(scope="module")
def customer():
    email = _rand_email()
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST Cust"})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"token": d["access_token"], "user": d["user"], "email": email}

# ---- Auth ----
def test_register_customer_201():
    email = _rand_email()
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Pass1234", "name": "TEST U"})
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "customer"
    assert data["user"]["email"] == email.lower()

def test_register_admin_wrong_code_403():
    email = _rand_email("TEST_adm")
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Pass1234", "name": "A", "role": "company_admin", "admin_code": "WRONG"})
    assert r.status_code == 403

def test_register_admin_valid_code_201():
    email = _rand_email("TEST_adm")
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Pass1234", "name": "A", "role": "company_admin", "admin_code": ADMIN_CODE})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "company_admin"

def test_login_seeded_admin(admin_token):
    assert admin_token

def test_me_returns_user(customer):
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {customer['token']}"})
    assert r.status_code == 200
    assert r.json()["email"] == customer["email"].lower()

def test_me_no_token_401():
    r = requests.get(f"{BASE}/auth/me")
    assert r.status_code == 401

# ---- Cars ----
def test_list_cars():
    r = requests.get(f"{BASE}/cars")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 3
    ids = {c["id"] for c in data}
    assert ids == {"vip", "luxury", "normal"}
    for c in data:
        assert c["price"] > 0

# ---- Orders ----
@pytest.fixture(scope="module")
def created_order(customer):
    sched = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    r = requests.post(f"{BASE}/orders",
        headers={"Authorization": f"Bearer {customer['token']}"},
        json={"car_id": "vip", "pickup_location": "TEST A", "dropoff_location": "TEST B", "scheduled_at": sched, "notes": "TEST"})
    assert r.status_code == 201, r.text
    o = r.json()
    assert o["price"] == 150.0 and o["status"] == "pending" and o["car_name"] == "VIP"
    return o

def test_create_order_customer(created_order):
    assert created_order["id"]

def test_my_orders_only_own(customer, created_order):
    r = requests.get(f"{BASE}/orders/my", headers={"Authorization": f"Bearer {customer['token']}"})
    assert r.status_code == 200
    ids = [o["id"] for o in r.json()]
    assert created_order["id"] in ids
    for o in r.json():
        assert o["user_id"] == customer["user"]["id"]

def test_customer_cannot_list_all_403(customer):
    r = requests.get(f"{BASE}/orders", headers={"Authorization": f"Bearer {customer['token']}"})
    assert r.status_code == 403

def test_admin_cannot_create_order_403(admin_token):
    sched = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    r = requests.post(f"{BASE}/orders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"car_id": "vip", "pickup_location": "X", "dropoff_location": "Y", "scheduled_at": sched})
    assert r.status_code == 403

def test_admin_list_and_filter(admin_token, created_order):
    r = requests.get(f"{BASE}/orders", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert any(o["id"] == created_order["id"] for o in r.json())
    r2 = requests.get(f"{BASE}/orders?status_filter=pending", headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200
    for o in r2.json():
        assert o["status"] == "pending"

def test_admin_accept_order(admin_token, created_order):
    r = requests.patch(f"{BASE}/orders/{created_order['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"}, json={"status": "accepted"})
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"
    # Verify persisted
    r2 = requests.get(f"{BASE}/orders/{created_order['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.json()["status"] == "accepted"

def test_cannot_update_non_pending(admin_token, created_order):
    r = requests.patch(f"{BASE}/orders/{created_order['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"}, json={"status": "rejected"})
    assert r.status_code == 400

def test_reject_flow(customer, admin_token):
    sched = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    r = requests.post(f"{BASE}/orders",
        headers={"Authorization": f"Bearer {customer['token']}"},
        json={"car_id": "normal", "pickup_location": "P", "dropoff_location": "D", "scheduled_at": sched})
    oid = r.json()["id"]
    r2 = requests.patch(f"{BASE}/orders/{oid}/status",
        headers={"Authorization": f"Bearer {admin_token}"}, json={"status": "rejected"})
    assert r2.status_code == 200 and r2.json()["status"] == "rejected"
