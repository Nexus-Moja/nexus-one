# NEXUS ONE v1.0 — Production Foundation

## Included
- Environment-based configuration and production secret validation
- SQLite persistence with WAL mode for single-instance deployment
- User, role and session database schema
- PBKDF2-SHA512 password hashing
- Bearer-token sessions with expiration and revocation
- Login lockout after repeated failures
- Role-protected audit API
- Request-rate limiting for authentication
- CSP and modern HTTP security headers
- Multi-stage, non-root Docker image
- Persistent Docker data volume
- GitHub Actions build, regression and container checks
- Health endpoint for orchestration

## First secure startup
1. Copy `.env.example` to `.env`.
2. Set a long `SESSION_SECRET` and `ADMIN_KEY`.
3. Add `BOOTSTRAP_ADMIN_EMAIL` and a 12+ character `BOOTSTRAP_ADMIN_PASSWORD` for the first startup only.
4. Run `docker compose up --build -d`.
5. Remove the bootstrap password from `.env` after the administrator account exists, then restart.

## Authentication API
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `POST /api/auth/logout`
- `GET /api/admin/audit` for ADMIN, QA and EXECUTIVE roles

## Production boundary
This foundation is deployable for controlled pilot use on a single application instance. Before handling production PHI at scale, migrate persistence to a managed encrypted database, place the service behind a TLS reverse proxy/WAF, use a managed secrets store, complete a HIPAA risk assessment, execute penetration testing, configure backups, and establish BAAs with all vendors handling PHI.
