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

export type OrderStatus = "pending" | "accepted" | "rejected";

export type Order = {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  car_id: string;
  car_name: string;
  price: number;
  pickup_location: string;
  dropoff_location: string;
  scheduled_at: string;
  notes?: string | null;
  status: OrderStatus;
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
  createOrder: (body: {
    car_id: string;
    pickup_location: string;
    dropoff_location: string;
    scheduled_at: string;
    notes?: string;
  }) => request<Order>("/orders", { method: "POST", body: JSON.stringify(body) }),
  myOrders: () => request<Order[]>("/orders/my"),
  allOrders: (status?: OrderStatus) =>
    request<Order[]>(`/orders${status ? `?status_filter=${status}` : ""}`),
  updateOrderStatus: (id: string, status: "accepted" | "rejected") =>
    request<Order>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
