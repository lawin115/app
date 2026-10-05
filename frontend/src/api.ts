import { tokenStore } from "./token-store";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Role = "customer" | "company_admin";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type CarType = {
  id: "vip" | "luxury" | "normal";
  name: string;
  name_ar: string;
  price: number;
  description: string;
  image: string;
};

export type OrderStatus = "pending" | "accepted" | "rejected" | "completed";

export type PricingQuote = {
  base: number;
  multiplier: number;
  reasons: string[];
  total: number;
};

export type Order = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  car_id: string;
  car_name: string;
  base_price: number;
  surge_multiplier: number;
  surge_reasons: string[];
  price: number;
  pickup_location: string;
  dropoff_location: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  scheduled_at: string;
  notes?: string | null;
  status: OrderStatus;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_plate?: string | null;
  rating?: number | null;
  rating_comment?: string | null;
  rated_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = { access_token: string; token_type: string; user: User };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  register: (body: { email: string; password: string; name: string; role: Role; admin_code?: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request<User>("/auth/me"),
  listCars: () => request<CarType[]>("/cars"),
  pricingQuote: (body: {
    car_id: string;
    pickup_location: string;
    dropoff_location: string;
    scheduled_at: string;
  }) => request<PricingQuote>("/pricing/quote", { method: "POST", body: JSON.stringify(body) }),
  createOrder: (body: {
    car_id: string;
    pickup_location: string;
    dropoff_location: string;
    pickup_lat?: number | null;
    pickup_lng?: number | null;
    dropoff_lat?: number | null;
    dropoff_lng?: number | null;
    scheduled_at: string;
    notes?: string;
  }) => request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  myOrders: () => request<Order[]>("/orders/my"),
  allOrders: (status?: OrderStatus) =>
    request<Order[]>(`/orders${status ? `?status_filter=${status}` : ""}`),
  acceptOrder: (id: string, body: { driver_name: string; driver_phone?: string; driver_plate: string }) =>
    request<Order>(`/orders/${id}/accept`, { method: "POST", body: JSON.stringify(body) }),
  rejectOrder: (id: string) =>
    request<Order>(`/orders/${id}/reject`, { method: "POST" }),
  completeOrder: (id: string) =>
    request<Order>(`/orders/${id}/complete`, { method: "POST" }),
  rateOrder: (id: string, body: { rating: number; comment?: string }) =>
    request<Order>(`/orders/${id}/rate`, { method: "POST", body: JSON.stringify(body) }),
  statsOrders: () => request<{ avg_rating: number | null; rated_count: number }>("/orders/stats"),
};
