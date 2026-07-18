# NEXUS ONE Platform v1

This release consolidates the planned NEXUS ONE experience into one shared platform shell.

## Included modules

- Public homepage and booking flow
- NEXUS LiveCare trip tracking
- Patient Portal
- Facility Portal
- Dispatch Center
- Fleet Management
- Driver Workspace
- Executive Intelligence
- QA & Compliance
- Billing & Reports
- Administration
- Detailed Operations workspace

## Shared experience standards

- One Nexus navigation and logo
- One red `Book a Ride` action that routes to the homepage booking workflow
- One navy/medical-blue hero framework
- Shared typography, cards, tables, timeline, status badges and accessibility controls
- Section 508/WCAG-oriented keyboard focus, contrast and reduced-motion behavior
- The supplied Nexus coverage graphic is embedded in the homepage carousel and LiveCare hero

## Functional backend

The Node server currently provides:

- Booking creation and persistent SQLite storage
- Confirmation references
- Patient/LiveCare lookup by reference and phone
- Status history and audit events
- Patient/caregiver messages to dispatch
- Expiring secure family tracking links
- Facility partnership submissions
- Protected operations APIs and status updates

## Current integration boundary

Patient, facility, driver, fleet, executive, QA, billing and admin modules are integrated workspace MVPs. Their live operational data models will be expanded in subsequent releases. The booking, LiveCare and operations workflows are the currently persisted end-to-end capabilities.
