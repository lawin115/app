# LuxeDrive — PRD

## Problem
A single mobile app for a car-booking company with two interfaces:
- **Customer**: pick car type (VIP / Luxury / Normal), pick pickup & drop-off (map pins or text), date/time, optional notes, see dynamic price with surge badges, request ride, see driver info once accepted, rate after completion.
- **Company admin**: view incoming requests, Accept (and assign a driver + plate) or Reject, mark Completed when the ride ends, see customer ratings and average rating.

## Features
- Email / password auth, JWT bearer. Default admin seeded: `admin@luxedrive.com` / `Admin1234`. Admin signup code `LUXE2026`.
- Fixed base prices: VIP $150, Luxury $90, Normal $45.
- **Surge pricing** (additive on top of 1.0):
  - Night surge +25% when local hour of `scheduled_at` is 22-04.
  - Airport surge +20% when pickup or drop-off contains `airport` or `مطار`.
- **Map pin picker** on native (react-native-maps + expo-location), with "Use my location" button and permission handling. On web preview, graceful text-only fallback.
- **Driver assignment**: admin supplies `driver_name` (required), `driver_plate` (required), `driver_phone` (optional) when accepting. Customer sees these in a dedicated driver card.
- **Ride completion**: admin marks an accepted ride as `completed`.
- **Ratings**: customer rates 1-5 with optional comment after completion. Admin dashboard shows average rating and total ratings.

## Backend endpoints
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- `GET /api/cars`.
- `POST /api/pricing/quote` → `{ base, multiplier, reasons[], total }`.
- `POST /api/orders` (customer) — server computes final price.
- `GET /api/orders/my` (customer).
- `GET /api/orders?status_filter=` (admin).
- `GET /api/orders/stats` (admin) — avg_rating + rated_count.
- `POST /api/orders/{id}/accept` (admin) with driver fields.
- `POST /api/orders/{id}/reject` (admin).
- `POST /api/orders/{id}/complete` (admin).
- `POST /api/orders/{id}/rate` (customer) with rating 1-5.
- `GET /api/orders/{id}` (owner or admin).

## Status machine
`pending → accepted → completed` or `pending → rejected`. Only `completed` orders can be rated. One rating per order.

## Non-goals (future)
- Push notifications
- Payments
- Live driver tracking
- Reverse geocoding of pins into addresses
