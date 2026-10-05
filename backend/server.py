from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
from enum import Enum


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get('JWT_EXPIRE_MINUTES', '10080'))
ADMIN_SIGNUP_CODE = os.environ.get('ADMIN_SIGNUP_CODE', 'LUXE2026')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="LuxeDrive API")
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------------- Catalog ----------------------
CAR_CATALOG = [
    {
        "id": "vip",
        "name": "VIP",
        "name_ar": "في آي بي",
        "price": 150.0,
        "description": "Mercedes S-Class or equivalent. Chauffeur included.",
        "image": "https://images.unsplash.com/photo-1610099610040-ab19f3a5ec35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwxfHxibGFjayUyMG1lcmNlZGVzJTIwcyUyMGNsYXNzfGVufDB8fHx8MTc5MTIxODAzMXww&ixlib=rb-4.1.0&q=85",
    },
    {
        "id": "luxury",
        "name": "Luxury",
        "name_ar": "فاخرة",
        "price": 90.0,
        "description": "Premium sedan. Business-class comfort.",
        "image": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwxfHxibGFjayUyMG1vZGVybiUyMHNlZGFufGVufDB8fHx8MTc5MTIxODAzMXww&ixlib=rb-4.1.0&q=85",
    },
    {
        "id": "normal",
        "name": "Normal",
        "name_ar": "عادية",
        "price": 45.0,
        "description": "Clean, reliable, everyday rides.",
        "image": "https://images.unsplash.com/photo-1767972885672-d469ccec0bd2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxzaWx2ZXIlMjBtb2Rlcm4lMjBzZWRhbnxlbnwwfHx8fDE3OTEyMTgwMzF8MA&ixlib=rb-4.1.0&q=85",
    },
]
CAR_BY_ID = {c["id"]: c for c in CAR_CATALOG}

# Surge rules
NIGHT_SURGE = 0.25  # +25% for 22:00-04:59
AIRPORT_SURGE = 0.20  # +20% if pickup or dropoff mentions airport


# ---------------------- Models ----------------------
class Role(str, Enum):
    customer = "customer"
    company_admin = "company_admin"


class OrderStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    completed = "completed"


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(min_length=1, max_length=80)
    role: Role = Role.customer
    admin_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PublicUser(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: Role


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class CarType(BaseModel):
    id: str
    name: str
    name_ar: str
    price: float
    description: str
    image: str


class PricingQuoteIn(BaseModel):
    car_id: Literal["vip", "luxury", "normal"]
    pickup_location: str
    dropoff_location: str
    scheduled_at: str


class PricingQuote(BaseModel):
    base: float
    multiplier: float
    reasons: List[str]
    total: float


class OrderCreate(BaseModel):
    car_id: Literal["vip", "luxury", "normal"]
    pickup_location: str = Field(min_length=1, max_length=200)
    dropoff_location: str = Field(min_length=1, max_length=200)
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    scheduled_at: str  # ISO datetime string
    notes: Optional[str] = Field(default=None, max_length=500)


class Order(BaseModel):
    id: str
    user_id: str
    customer_name: str
    customer_email: EmailStr
    car_id: str
    car_name: str
    base_price: float
    surge_multiplier: float
    surge_reasons: List[str]
    price: float
    pickup_location: str
    dropoff_location: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    scheduled_at: str
    notes: Optional[str] = None
    status: OrderStatus
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_plate: Optional[str] = None
    rating: Optional[int] = None
    rating_comment: Optional[str] = None
    rated_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str


class AcceptOrderIn(BaseModel):
    driver_name: str = Field(min_length=1, max_length=80)
    driver_phone: Optional[str] = Field(default=None, max_length=40)
    driver_plate: str = Field(min_length=1, max_length=20)


class RateOrderIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=400)


# ---------------------- Helpers ----------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGORITHM)


def user_to_public(doc: dict) -> PublicUser:
    return PublicUser(id=doc["id"], email=doc["email"], name=doc["name"], role=Role(doc["role"]))


async def current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> PublicUser:
    unauthorized = HTTPException(status_code=401, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    if not credentials or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        user_id = payload["sub"]
    except Exception:
        raise unauthorized
    doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise unauthorized
    return user_to_public(doc)


def require_roles(*allowed: Role):
    async def dep(user: PublicUser = Depends(current_user)) -> PublicUser:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user
    return dep


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_airport(text: str) -> bool:
    t = (text or "").lower()
    return "airport" in t or "مطار" in t


def _is_night_hour(scheduled_at: str) -> bool:
    try:
        dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
    except Exception:
        return False
    hour = dt.hour
    return hour >= 22 or hour < 5


def compute_quote(car_id: str, pickup: str, dropoff: str, scheduled_at: str) -> PricingQuote:
    car = CAR_BY_ID.get(car_id)
    if not car:
        raise HTTPException(status_code=400, detail="Invalid car type")
    base = float(car["price"])
    multiplier = 1.0
    reasons: List[str] = []
    if _is_night_hour(scheduled_at):
        multiplier += NIGHT_SURGE
        reasons.append(f"Night surge +{int(NIGHT_SURGE * 100)}%")
    if _is_airport(pickup) or _is_airport(dropoff):
        multiplier += AIRPORT_SURGE
        reasons.append(f"Airport surge +{int(AIRPORT_SURGE * 100)}%")
    total = round(base * multiplier, 2)
    return PricingQuote(base=base, multiplier=round(multiplier, 2), reasons=reasons, total=total)


# ---------------------- Auth Routes ----------------------
@api_router.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")

    role = body.role
    if role == Role.company_admin:
        if not body.admin_code or body.admin_code != ADMIN_SIGNUP_CODE:
            raise HTTPException(status_code=403, detail="Invalid admin signup code")

    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": role.value,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    user = user_to_public(doc)
    token = make_token(user.id, user.role.value)
    return TokenOut(access_token=token, user=user)


@api_router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower()
    doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user = user_to_public(doc)
    token = make_token(user.id, user.role.value)
    return TokenOut(access_token=token, user=user)


@api_router.get("/auth/me", response_model=PublicUser)
async def me(user: PublicUser = Depends(current_user)):
    return user


# ---------------------- Cars ----------------------
@api_router.get("/cars", response_model=List[CarType])
async def list_cars():
    return [CarType(**c) for c in CAR_CATALOG]


# ---------------------- Pricing ----------------------
@api_router.post("/pricing/quote", response_model=PricingQuote)
async def pricing_quote(body: PricingQuoteIn):
    return compute_quote(body.car_id, body.pickup_location, body.dropoff_location, body.scheduled_at)


# ---------------------- Orders ----------------------
@api_router.post("/orders", response_model=Order, status_code=201)
async def create_order(body: OrderCreate, user: PublicUser = Depends(require_roles(Role.customer))):
    car = CAR_BY_ID.get(body.car_id)
    if not car:
        raise HTTPException(status_code=400, detail="Invalid car type")
    quote = compute_quote(body.car_id, body.pickup_location, body.dropoff_location, body.scheduled_at)
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "customer_name": user.name,
        "customer_email": user.email,
        "car_id": car["id"],
        "car_name": car["name"],
        "base_price": quote.base,
        "surge_multiplier": quote.multiplier,
        "surge_reasons": quote.reasons,
        "price": quote.total,
        "pickup_location": body.pickup_location,
        "dropoff_location": body.dropoff_location,
        "pickup_lat": body.pickup_lat,
        "pickup_lng": body.pickup_lng,
        "dropoff_lat": body.dropoff_lat,
        "dropoff_lng": body.dropoff_lng,
        "scheduled_at": body.scheduled_at,
        "notes": body.notes,
        "status": OrderStatus.pending.value,
        "driver_name": None,
        "driver_phone": None,
        "driver_plate": None,
        "rating": None,
        "rating_comment": None,
        "rated_at": None,
        "completed_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return Order(**doc)


@api_router.get("/orders/my", response_model=List[Order])
async def my_orders(user: PublicUser = Depends(require_roles(Role.customer))):
    cursor = db.orders.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1)
    return [Order(**d) async for d in cursor]


@api_router.get("/orders", response_model=List[Order])
async def all_orders(status_filter: Optional[OrderStatus] = None,
                     user: PublicUser = Depends(require_roles(Role.company_admin))):
    q = {}
    if status_filter:
        q["status"] = status_filter.value
    cursor = db.orders.find(q, {"_id": 0}).sort("created_at", -1)
    return [Order(**d) async for d in cursor]


@api_router.post("/orders/{order_id}/accept", response_model=Order)
async def accept_order(order_id: str, body: AcceptOrderIn,
                       user: PublicUser = Depends(require_roles(Role.company_admin))):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["status"] != OrderStatus.pending.value:
        raise HTTPException(status_code=400, detail="Order is not pending")
    update = {
        "status": OrderStatus.accepted.value,
        "driver_name": body.driver_name,
        "driver_phone": body.driver_phone,
        "driver_plate": body.driver_plate,
        "updated_at": now_iso(),
    }
    await db.orders.update_one({"id": order_id}, {"$set": update})
    doc.update(update)
    return Order(**doc)


@api_router.post("/orders/{order_id}/reject", response_model=Order)
async def reject_order(order_id: str, user: PublicUser = Depends(require_roles(Role.company_admin))):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["status"] != OrderStatus.pending.value:
        raise HTTPException(status_code=400, detail="Order is not pending")
    update = {"status": OrderStatus.rejected.value, "updated_at": now_iso()}
    await db.orders.update_one({"id": order_id}, {"$set": update})
    doc.update(update)
    return Order(**doc)


@api_router.post("/orders/{order_id}/complete", response_model=Order)
async def complete_order(order_id: str, user: PublicUser = Depends(require_roles(Role.company_admin))):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["status"] != OrderStatus.accepted.value:
        raise HTTPException(status_code=400, detail="Only accepted rides can be completed")
    now = now_iso()
    update = {"status": OrderStatus.completed.value, "updated_at": now, "completed_at": now}
    await db.orders.update_one({"id": order_id}, {"$set": update})
    doc.update(update)
    return Order(**doc)


@api_router.post("/orders/{order_id}/rate", response_model=Order)
async def rate_order(order_id: str, body: RateOrderIn,
                     user: PublicUser = Depends(require_roles(Role.customer))):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    if doc["status"] != OrderStatus.completed.value:
        raise HTTPException(status_code=400, detail="Only completed rides can be rated")
    if doc.get("rating") is not None:
        raise HTTPException(status_code=400, detail="Already rated")
    now = now_iso()
    update = {
        "rating": body.rating,
        "rating_comment": body.comment,
        "rated_at": now,
        "updated_at": now,
    }
    await db.orders.update_one({"id": order_id}, {"$set": update})
    doc.update(update)
    return Order(**doc)


@api_router.get("/orders/stats", response_model=dict)
async def orders_stats(user: PublicUser = Depends(require_roles(Role.company_admin))):
    pipeline = [
        {"$match": {"rating": {"$ne": None}}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    out = {"avg_rating": None, "rated_count": 0}
    async for row in db.orders.aggregate(pipeline):
        out["avg_rating"] = round(row.get("avg") or 0, 2)
        out["rated_count"] = row.get("count", 0)
    return out


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, user: PublicUser = Depends(current_user)):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if user.role == Role.customer and doc["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return Order(**doc)


@api_router.get("/")
async def root():
    return {"message": "LuxeDrive API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def seed_admin():
    await db.users.create_index("email", unique=True)
    existing = await db.users.find_one({"email": "admin@luxedrive.com"})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": "admin@luxedrive.com",
            "name": "LuxeDrive Admin",
            "password_hash": hash_password("Admin1234"),
            "role": Role.company_admin.value,
            "created_at": now_iso(),
        })
        logger.info("Seeded default company admin: admin@luxedrive.com / Admin1234")

    # Backfill schema for pre-existing orders
    await db.orders.update_many(
        {"base_price": {"$exists": False}},
        [{"$set": {
            "base_price": "$price",
            "surge_multiplier": 1.0,
            "surge_reasons": [],
            "pickup_lat": None,
            "pickup_lng": None,
            "dropoff_lat": None,
            "dropoff_lng": None,
            "driver_name": None,
            "driver_phone": None,
            "driver_plate": None,
            "rating": None,
            "rating_comment": None,
            "rated_at": None,
            "completed_at": None,
        }}],
    )


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
