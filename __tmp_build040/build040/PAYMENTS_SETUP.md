# NEXUS ONE Payment Integration

Integrated payment entry points:

- Stripe Payment Link: cards and eligible Apple Pay / Google Pay wallets.
- PayPal Hosted Button: hosted button ID `X5LEDQNNSJLD8`.
- PayPal payment page: PayPal and eligible Venmo funding.
- Booking confirmation, Patient module, and Billing module share the same payment destinations.

## Current behavior

The application calculates route mileage, ETA, and an estimated fare. After the booking is created, the customer is shown secure payment choices alongside the booking reference. Checkout is processed on Stripe or PayPal hosted pages.

## Production requirement

Hosted checkout is active, but automatic Paid/Pending status reconciliation requires provider webhooks and a server-side transaction table. Never place Stripe secret keys in Vite/client environment variables. Configure separate restricted Google Maps and payment credentials for production.
