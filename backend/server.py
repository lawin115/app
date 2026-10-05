from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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


# ---------------------- Models ----------------------
class Role(str, Enum):
    customer = "customer"
    company_admin = "company_admin"


class OrderStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


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


class OrderCreate(BaseModel):
    car_id: Literal["vip", "luxury", "normal"]
    pickup_location: str = Field(min_length=1, max_length=200)
    dropoff_location: str = Field(min_length=1, max_length=200)
    scheduled_at: str  # ISO datetime string
    notes: Optional[str] = Field(default=None, max_length=500)


class Order(BaseModel):
    id: str
    user_id: str
    customer_name: str
    customer_email: EmailStr
    car_id: str
    car_name: str
    price: float
    pickup_location: str
    dropoff_location: str
    scheduled_at: str
    notes: Optional[str] = None
    status: OrderStatus
    created_at: str
    updated_at: str


class OrderStatusUpdate(BaseModel):
    status: Literal["accepted", "rejected"]


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


# ---------------------- Orders ----------------------
@api_router.post("/orders", response_model=Order, status_code=201)
async def create_order(body: OrderCreate, user: PublicUser = Depends(require_roles(Role.customer))):
    car = CAR_BY_ID.get(body.car_id)
    if not car:
        raise HTTPException(status_code=400, detail="Invalid car type")
    now = now_iso()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "customer_name": user.name,
        "customer_email": user.email,
        "car_id": car["id"],
        "car_name": car["name"],
        "price": car["price"],
        "pickup_location": body.pickup_location,
        "dropoff_location": body.dropoff_location,
        "scheduled_at": body.scheduled_at,
        "notes": body.notes,
        "status": OrderStatus.pending.value,
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


@api_router.patch("/orders/{order_id}/status", response_model=Order)
async def update_order_status(order_id: str, body: OrderStatusUpdate,
                              user: PublicUser = Depends(require_roles(Role.company_admin))):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["status"] != OrderStatus.pending.value:
        raise HTTPException(status_code=400, detail="Order is not pending")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": now_iso()}},
    )
    doc["status"] = body.status
    doc["updated_at"] = now_iso()
    return Order(**doc)


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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
