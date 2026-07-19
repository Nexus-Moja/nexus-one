# NEXUS ONE Production Readiness Checklist

## Current baseline — July 19, 2026

### Verified now
- [x] LiveCare smoke test passes
- [x] AI Operations smoke test passes
- [x] Executive module tests pass
- [x] Production foundation security tests pass
- [x] Multilingual checks pass for 4 locales
- [x] 20 accessibility regression checks pass
- [x] Role-based authentication and scoped portal access exist
- [x] Audit logging exists
- [x] Login throttling and account lockout exist
- [x] Hardened HTTP headers and CSP exist
- [x] Docker, Render and Netlify deployment files exist
- [x] Health-check and CI foundations exist

### Blocking items before production
- [x] Commit a package-lock.json and pin dependency versions
- [ ] Complete a clean dependency install and production build in CI
- [ ] Replace SQLite with a managed production database, preferably PostgreSQL
- [ ] Disable preview/demo credentials in production
- [ ] Replace all placeholder secrets and rotate exposed development keys
- [ ] Configure production domain, HTTPS and allowed origins
- [ ] Configure secure email and SMS providers
- [ ] Connect real map/GPS data rather than simulated fleet positions
- [ ] Connect live payment processing and webhook verification
- [ ] Add centralized error monitoring, uptime monitoring and alerting
- [ ] Implement encrypted backups and test restoration
- [ ] Complete HIPAA security/privacy risk assessment and BAAs
- [ ] Run user acceptance testing for every role
- [ ] Run penetration testing before handling real patient data

## Phase 1 — Foundation

### 1. Source control and builds
- [ ] Put the project in a private Git repository
- [ ] Protect the production branch
- [x] Pin all dependency versions
- [x] Generate and commit package-lock.json
- [ ] Make `npm ci`, tests and build mandatory in CI
- [ ] Add staging and production deployment workflows

### 2. Environments
- [ ] Development environment
- [ ] Staging environment with test data only
- [ ] Production environment with separate secrets and database
- [ ] Disable debug and preview functionality in production

### 3. Database
- [ ] Design PostgreSQL production schema
- [ ] Add migrations
- [ ] Add least-privilege database user
- [ ] Encrypt connections
- [ ] Daily backups and point-in-time recovery
- [ ] Restore drill completed successfully

### 4. Secrets and configuration
- [ ] Generate SESSION_SECRET with at least 32 random bytes
- [ ] Generate emergency ADMIN_KEY and store it securely
- [ ] Set APP_ORIGIN to the final HTTPS domain
- [ ] Configure TRUST_PROXY for the selected host
- [ ] Keep `.env.production` and all secrets out of Git
- [ ] Add secret rotation procedure

## Phase 2 — Real functionality

### Authentication and roles
- [ ] Production user provisioning
- [ ] Password reset
- [ ] MFA for staff and facility accounts
- [ ] Session expiration and revocation testing
- [ ] Role-by-role authorization tests
- [ ] Remove all demo accounts

### LiveCare and dispatch
- [ ] Driver mobile GPS ingestion
- [ ] Verified vehicle-to-driver assignment
- [ ] Real-time status updates
- [ ] Facility fleet scoping validation
- [ ] Dispatcher reassignment workflow
- [ ] Location privacy and retention rules
- [ ] Offline/reconnect behavior

### Booking and trip lifecycle
- [ ] Production booking persistence
- [ ] Validation of pickup/drop-off information
- [ ] Cancellation and no-show workflows
- [ ] Signature and proof-of-transport workflow
- [ ] Incident and exception handling
- [ ] Complete audit trail

### Payments and billing
- [ ] Stripe production account
- [ ] Signed webhook verification
- [ ] Idempotent payment processing
- [ ] Refunds and disputes
- [ ] Facility invoicing
- [ ] Receipt delivery
- [ ] No card data stored directly by Nexus

### Notifications
- [ ] Transactional email provider
- [ ] SMS provider
- [ ] Opt-in/opt-out controls
- [ ] Delivery failure handling
- [ ] Templates for booking, assignment, arrival, delay and completion

## Phase 3 — Security, privacy and compliance
- [ ] HIPAA security risk assessment
- [ ] Privacy impact assessment
- [ ] Business Associate Agreements where required
- [ ] Encryption in transit and at rest
- [ ] Minimum-necessary access review
- [ ] Audit log retention and tamper protection
- [ ] Incident response plan
- [ ] Breach response procedure
- [ ] Data retention and deletion policy
- [ ] Vulnerability scanning
- [ ] Independent penetration test
- [ ] Accessibility review against WCAG 2.2 AA / Section 508

## Phase 4 — Operations
- [ ] Centralized application logs
- [ ] Error tracking
- [ ] Uptime monitor
- [ ] Database monitoring
- [ ] Security alerts
- [ ] On-call contact tree
- [ ] Maintenance mode
- [ ] Disaster recovery plan
- [ ] Recovery-time and recovery-point objectives
- [ ] Staff training and support documentation

## Phase 5 — Final launch gate
Production launch is approved only when all are true:
- [ ] Clean production build from a fresh checkout
- [ ] All automated tests pass
- [ ] All critical and high-severity defects closed
- [ ] Role-based UAT signed off
- [ ] Payment, email, SMS, map and GPS integrations verified
- [ ] Backup restore verified
- [ ] Monitoring and alerting verified
- [ ] Security review completed
- [ ] Legal/privacy documents published
- [ ] Production secrets rotated
- [ ] Rollback procedure tested
- [ ] Launch owner gives written approval

## Step 1 — Dependency and CI foundation — Complete
- [x] Exact dependency versions pinned
- [x] `package-lock.json` generated and committed
- [x] Clean `npm ci` verified
- [x] Complete production verification suite passes
- [x] GitHub Actions CI workflow added
- [x] CI uploads the production `dist/` artifact
- [ ] Enable GitHub branch protection and require the CI check after the repository is connected

## Immediate next task
Proceed to Step 2: define the production environments and deployment architecture for development, staging and production.


## Build 039 completion

- [x] Define development, staging, and production environments.
- [x] Add centralized environment validation.
- [x] Add isolated environment templates.
- [x] Disable preview accounts and mock fleet behavior in production.
- [x] Add health, readiness, and version endpoints.
- [x] Define staging and production deployment services.
- [ ] Migrate SQLite persistence to managed PostgreSQL (Build 040).

## Build 040 — PostgreSQL migration status

- [x] Define production PostgreSQL schema.
- [x] Add versioned migration runner.
- [x] Add connection pool and connectivity check.
- [x] Add separate managed staging and production database resources.
- [x] Require PostgreSQL configuration in staging and production.
- [x] Document migration reconciliation and rollback controls.
- [ ] Provision staging PostgreSQL and run migrations against the live instance.
- [ ] Convert the server's synchronous SQLite repositories to asynchronous PostgreSQL repositories.
- [ ] Import legacy SQLite records and reconcile every table.
- [ ] Enable and test point-in-time recovery.
