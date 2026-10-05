# LuxeDrive — PRD

## Problem
A single mobile app for a car-booking company with two interfaces:
- **Customer**: pick car type (VIP / Luxury / Normal), enter pickup & drop-off, date/time, optional notes, see price, send request.
- **Company admin**: view incoming requests, accept or reject. When accepted, the customer sees the status update.

## MVP scope
- Email/password auth (customer self-signup; admin via signup code `LUXE2026`).
- Default admin seeded: `admin@luxedrive.com` / `Admin1234`.
- Car catalog with fixed prices: VIP $150, Luxury $90, Normal $45.
- Create order (status=pending).
- Customer orders screen with polling for status updates.
- Admin dashboard: filter by pending / accepted / rejected / all, accept or reject each order.
- JWT bearer token stored in SecureStore (localStorage on web).

## Backend endpoints
- `POST /api/auth/register` – customer or company_admin (requires admin_code).
- `POST /api/auth/login` – returns bearer token.
- `GET /api/auth/me`
- `GET /api/cars`
- `POST /api/orders` – customer only.
- `GET /api/orders/my` – customer only.
- `GET /api/orders?status_filter=` – admin only.
- `PATCH /api/orders/{id}/status` – admin only (accept / reject).
- `GET /api/orders/{id}` – owner or admin.

## Design
Dark luxe (Midnight + Antique Gold). See `design_guidelines.json`.

## Non-goals (MVP)
- Map pin selection
- Push notifications
- Payments
- Multi-driver assignment
