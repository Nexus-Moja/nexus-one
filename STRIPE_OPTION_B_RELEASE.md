# NEXUS ONE v1.0.6 — Stripe Option B

Implemented server-created Stripe Checkout Sessions.

## Included
- `POST /api/payments/stripe/checkout`
- `POST /api/payments/stripe/webhook`
- `GET /api/payments/stripe/session`
- Webhook signature verification using the unmodified raw request body
- Booking-linked Checkout metadata and client reference
- Payment and booking payment-status persistence
- Idempotent Checkout Session creation
- Checkout rate limiting
- Success and cancellation return URLs
- Removal of the visible “Select language” title

## Deployment requirement
The full Node service must be deployed. A static `dist/` upload alone cannot run Checkout Session or webhook API endpoints.

Configure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `APP_ORIGIN` in the hosting environment. Do not commit live credentials to the ZIP.
