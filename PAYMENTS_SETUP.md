# NEXUS ONE Stripe Checkout Sessions

## Production architecture

The booking confirmation page calls `POST /api/payments/stripe/checkout`. The Node server creates a Stripe-hosted Checkout Session and returns its one-time URL. The browser redirects to Stripe; no secret key is exposed to the client.

Stripe payment events are received at `POST /api/payments/stripe/webhook`. The handler verifies the `Stripe-Signature` header using the raw request body and updates the booking/payment records.

## Required production environment variables

- `APP_ORIGIN=https://your-production-domain`
- `STRIPE_SECRET_KEY=sk_live_...`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `SESSION_SECRET=` at least 32 random characters

Never place `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in files committed to source control or in variables beginning with `VITE_`.

## Stripe Dashboard setup

Create an event destination/webhook endpoint pointing to:

`https://your-production-domain/api/payments/stripe/webhook`

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

## Hosting requirement

This integration requires the included Node server (`npm start`) and persistent writable storage for SQLite. A static-only Netlify deployment of `dist/` cannot execute these API routes. Deploy the full service using the included Docker/Render configuration or another Node host with persistent disk.

## Local test

1. Use Stripe test keys in the environment.
2. Run `npm run build && npm start`.
3. Run Stripe CLI forwarding: `stripe listen --forward-to localhost:4173/api/payments/stripe/webhook`.
4. Put the CLI-provided signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Create a booking with a calculated fare and open Stripe Checkout.
