# NEXUS ONE — Full-Stack Plumbing Release

This package turns the approved Nexus React experience into a working application with persistent transportation requests, facility partnership submissions, request tracking, and an operations workspace.

## What works now

- React/Vite public experience with the official Nexus logo and scrolling hero
- Transportation request submission to a real backend API
- Persistent SQLite database storage
- Unique Nexus confirmation references
- Patient request tracking by reference and phone number
- Facility partnership submission and storage
- Protected operations workspace at `/operations`
- Operations status updates, driver assignment, and vehicle assignment
- Audit log records for booking creation and status changes
- Server-side validation and basic security headers
- Health endpoint at `/api/health`
- Single Node server for the React build and API

## Local start

Requirements: Node.js 22.5 or newer.

```bash
npm install
npm run build
ADMIN_KEY="replace-with-a-long-random-key" npm start
```

Open:

- Website: `http://localhost:4173`
- Operations: `http://localhost:4173/operations`
- Health: `http://localhost:4173/api/health`

Use the same value configured in `ADMIN_KEY` to open the operations data.

## Production environment

Copy `.env.example` to your hosting environment and set at minimum:

```env
PORT=4173
HOST=0.0.0.0
ADMIN_KEY=use-a-long-random-production-secret
```

## Important production hardening still required

This release is a functioning operational MVP. Before collecting protected health information at scale, complete:

1. Migrate SQLite to managed PostgreSQL for multi-instance production hosting.
2. Add staff authentication with MFA and role-based access control.
3. Add encrypted secrets management and database backups.
4. Connect approved email and SMS providers for confirmations and updates.
5. Add Google Maps or another approved geocoding provider.
6. Add payment and insurance integrations only after business and compliance review.
7. Complete HIPAA risk assessment, privacy policies, BAAs, penetration testing, and WCAG audit.
8. Add dispatch, driver, vehicle, invoice, complaint, QA, and document modules to the same API foundation.

## API summary

- `POST /api/bookings`
- `GET /api/bookings/:reference?phone=...`
- `POST /api/partnerships`
- `GET /api/health`
- `GET /api/admin/bookings` with `x-admin-key`
- `PATCH /api/admin/bookings/:reference` with `x-admin-key`
- `GET /api/admin/partnerships` with `x-admin-key`

## Windows quick start

Do not run `vite` directly. Vite is installed locally by npm and should be launched through the provided scripts.

1. Install **Node.js 22 LTS**.
2. Extract this ZIP.
3. Double-click `setup-windows.bat` once.
4. Double-click `start-windows.bat` whenever you want to run NEXUS ONE.
5. Open `http://localhost:4173`.

For development mode, double-click `dev-windows.bat` after setup.

### Why `'vite' is not recognized` happened

That message appears when dependencies have not been installed or when `vite` is typed directly in Command Prompt. Use `npm install` first, then `npm run dev`; npm automatically finds the project-local Vite executable.

## Accessibility and Section 508

This release includes a Section 508/WCAG remediation pass and targets WCAG 2.2 Level AA. Run:

```bash
npm run a11y:check
npm run verify
```

See `ACCESSIBILITY_AUDIT.md` for completed remediation and required manual testing. This package must not be represented as formally certified until comprehensive assistive-technology testing and an ACR/VPAT review are complete.


## NEXUS LiveCare v1

Open `/livecare.html` to track a ride using the confirmation reference and booking phone number.

Included in this release:
- Timestamped trip status history
- Patient/caregiver tracking center
- Expiring 24-hour shared tracking links
- Two-way patient/dispatch messages
- Operations event notes and messages
- Driver and vehicle visibility
- Section 508-oriented keyboard, focus, contrast and reduced-motion support

LiveCare uses the Node server and SQLite database. Deploy the full application to Render or another persistent Node host; standard static Netlify hosting alone will not provide the API/database.


## TrustedSite integration

TrustedSite's asynchronous trustmark loader is installed on the homepage and all platform module pages:

```html
<script src="https://cdn.ywxi.net/js/1.js" async></script>
```

The trustmark may not appear on localhost or an unverified Netlify preview URL. It normally becomes visible after the deployed custom domain is verified and activated in the TrustedSite account. The script does not replace SSL, privacy, HIPAA, or accessibility controls.


## Integrated payments and Google Maps

This master build includes Google Maps address autocomplete, route distance/ETA, estimated fares, Stripe checkout, PayPal hosted checkout, and Venmo eligibility through PayPal. See `GOOGLE_MAPS_SETUP.md` and `PAYMENTS_SETUP.md`.
