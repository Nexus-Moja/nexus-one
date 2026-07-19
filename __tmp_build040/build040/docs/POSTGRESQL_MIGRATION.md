# Build 040 — PostgreSQL Migration Runbook

## What this build establishes

- Managed PostgreSQL resources for staging and production in `render.yaml`.
- Versioned, idempotent schema migrations in `database/migrations/`.
- Connection pooling through `pg`.
- Environment validation that forbids SQLite in staging and production.
- Deployment-time migration command (`npm run db:migrate`).
- Database connectivity command (`npm run db:status`).
- Local PostgreSQL for engineering through `docker-compose.postgres.yml`.

## Local validation

```bash
npm ci
docker compose -f docker-compose.postgres.yml up -d
set DATABASE_URL=postgresql://nexus:nexus_local_only@localhost:5432/nexus_one
set DB_SSL=false
npm run db:migrate
npm run db:status
```

## Staging cutover

1. Provision the Render staging database from `render.yaml`.
2. Confirm `DATABASE_URL` is injected from `nexus-one-staging-db`.
3. Run `npm run db:migrate` as the pre-deploy command.
4. Verify connectivity with `npm run db:status`.
5. Export the legacy SQLite data and import it during a controlled maintenance window.
6. Reconcile row counts for users, bookings, partnerships, audit records, status history, messages, and tracking links.
7. Run the full role and workflow test suite against staging.

## Production cutover controls

- Take a final SQLite backup before migration.
- Freeze writes during the final export/import window.
- Record row counts and checksums before and after migration.
- Keep the legacy database read-only until production acceptance is signed.
- Enable managed backups and point-in-time recovery before opening production traffic.
- Do not place protected health information in logs, migration output, or CI artifacts.

## Rollback

If validation fails, stop production traffic, restore the prior application release, and reconnect the read-only legacy database backup. Do not attempt an in-place reverse migration without an approved rollback script and verified backup.

## Important runtime note

Build 040 creates and validates the production PostgreSQL schema and deployment infrastructure. The current application server still uses the legacy synchronous SQLite query layer. The route-by-route asynchronous PostgreSQL repository cutover must be completed and tested against a provisioned staging database before production deployment. Environment validation intentionally blocks staging/production from being labeled ready without PostgreSQL configuration.
