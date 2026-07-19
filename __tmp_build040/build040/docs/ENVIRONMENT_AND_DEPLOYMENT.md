# NEXUS ONE Environment and Deployment Architecture

## Environment model

| Environment | Branch | Purpose | Data | Deployment |
|---|---|---|---|---|
| Development | feature branches | Local engineering | Local SQLite and test fixtures | Manual |
| Staging | `develop` | Production-like QA | Isolated non-PHI test data | Automatic after CI |
| Production | `main` | Live operations | Production data | Manual approval after CI |

Never share secrets, databases, API keys, storage buckets, or webhook endpoints between staging and production.

## Required controls

- Copy the matching `.env.*.example` file into the hosting provider's secret manager.
- Never commit a populated `.env` file.
- Production must keep preview accounts and mock fleet data disabled.
- Production `APP_ORIGIN` must use HTTPS.
- Production session and administrator secrets must meet the minimum lengths enforced at startup.
- Enable payments and notifications only after their corresponding secrets have been configured.

## Deployment flow

1. Create a feature branch and open a pull request.
2. GitHub Actions installs locked dependencies and runs all verification checks.
3. Merge approved changes into `develop` to deploy staging.
4. Complete staging role, browser, mobile, security, and workflow validation.
5. Merge the approved release into `main`.
6. Approve the production deployment in Render and Netlify.
7. Verify `/health`, `/ready`, and `/version` immediately after deployment.
8. Roll back to the previous successful release if any production check fails.

## Health endpoints

- `/health` — process, release, environment, and application health.
- `/ready` — confirms the application can reach its persistence layer.
- `/version` — reports the deployed application version and release identifier.

## Current database note

Build 039 preserves SQLite while the environments are established. Build 040 will migrate persistence to managed PostgreSQL and provide migrations, connection pooling, backup policy, and recovery verification.
