# NEXUS ONE

NEXUS ONE is a healthcare mobility platform for scheduling, dispatch, patient tracking, billing, compliance, and executive visibility.

## Enterprise repository layout

- apps/: portal experiences for patients, drivers, dispatch, facility, fleet, billing, compliance, executive, and admin users
- platform/: shared platform services for identity, authorization, notifications, messaging, payments, audit, reporting, maps, and AI
- services/: backend service boundaries and orchestration
- shared/: reusable UI, components, localization, accessibility, and utilities
- infrastructure/: deployment, environment, and operational assets
- docs/: governance, architecture, security, product, and release documentation
- tests/: automated validation and regression coverage
- scripts/: build, deployment, and operational scripts

## What works now

- React/Vite public experience with the official Nexus logo and scrolling hero
- Transportation request submission to a real backend API
- Persistent SQLite database storage
- Unique Nexus confirmation references
- Patient request tracking by reference and phone number
- Facility partnership submission and storage
- Protected operations workspace at /operations
- Operations status updates, driver assignment, and vehicle assignment
- Audit log records for booking creation and status changes
- Server-side validation and basic security headers
- Health endpoint at /api/health
- Single Node server for the React build and API

## Local start

Requirements: Node.js 22.5 or newer.

```bash
npm install
npm run build
ADMIN_KEY="replace-with-a-long-random-key" npm start
```

Open:

- Website: http://localhost:4173
- Operations: http://localhost:4173/operations
- Health: http://localhost:4173/api/health

## Production notes

This release is a functioning operational MVP. Before collecting protected health information at scale, complete:

1. Migrate SQLite to managed PostgreSQL for multi-instance production hosting.
2. Add staff authentication with MFA and role-based access control.
3. Add encrypted secrets management and database backups.
4. Connect approved email and SMS providers for confirmations and updates.
5. Add Google Maps or another approved geocoding provider.
6. Add payment and insurance integrations only after business and compliance review.
7. Complete HIPAA risk assessment, privacy policies, BAAs, penetration testing, and WCAG audit.
8. Add dispatch, driver, vehicle, invoice, complaint, QA, and document modules to the same API foundation.
