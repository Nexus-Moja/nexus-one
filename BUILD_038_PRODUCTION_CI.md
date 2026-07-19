# Build 038 — Production CI Workflow

## Completed

- Added `.github/workflows/ci.yml` for GitHub Actions.
- Runs automatically on pushes and pull requests targeting `main`, `master`, or `develop`.
- Supports manual runs through `workflow_dispatch`.
- Uses Node.js 22.12.0 and npm dependency caching.
- Installs only the exact locked dependency tree with `npm ci`.
- Runs the complete production verification suite.
- Runs the internationalization test separately so it cannot be skipped.
- Uploads the generated `dist/` directory as a traceable build artifact.
- Cancels stale CI runs when a newer commit is pushed to the same branch.
- Uses read-only repository permissions and a 20-minute job timeout.

## Required GitHub repository setting

After uploading the project to GitHub, protect the production branch and require the check named:

`Install, verify and build`

A pull request should not be mergeable unless that check passes.

## Local equivalent

```bash
npm run ci
```

This runs the same locked installation and validation sequence used by the workflow.

## Step 1 status

Step 1 is complete:

- Exact package versions are pinned.
- `package-lock.json` is committed.
- Clean `npm ci` is verified.
- Automated production verification is configured in CI.
- The production build is retained as a CI artifact.
