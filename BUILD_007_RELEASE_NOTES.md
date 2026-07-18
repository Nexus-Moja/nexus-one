# NEXUS ONE Build 007 — Revenue Cycle Management

## Integrated capabilities
- Unified claim and invoice records generated from existing NEXUS trip records.
- Payer classification for self-pay, facility accounts, Medicaid, Medicare, commercial insurance and workers' compensation.
- CMS-1500 operational draft document generation for payer review (not direct electronic submission).
- Claim status workflow: Draft, Ready to Submit, Submitted, Accepted, Denied, Partially Paid and Paid.
- Manual payment posting and automatic balance recalculation.
- Accounts receivable, gross charges, payments and clean-claim readiness metrics.
- Claims and payment CSV exports.
- Existing Stripe and PayPal/Venmo hosted payment links preserved.
- Print/save-PDF financial document workflow.

## Production boundary
This build is a connected working prototype using browser storage. It does not submit claims to a clearinghouse or verify eligibility. Production deployment requires authenticated server APIs, encrypted PHI storage, role-based access, audit trails, payer-specific coding validation, webhook reconciliation and a HIPAA-aligned hosting/security configuration.
