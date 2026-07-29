# Pre-Merge Checklist — iOS Home Screen Auth Fix (Issue #55)

> **Date:** 2026-07-29
> **Branch:** `claude/ios-web-app-auth-6uftxn`
> **Why:** doc-only in-branch (see `11-Neon-Integration.md` "Trusted origins"). These are manual actions the repo owner must run before merge/deploy.

## Actions

- [ ] Look up the deployed Worker URL: `cd app && npx wrangler deployments list`. Shape: `https://<worker-name>.<subdomain>.workers.dev`, unless a custom domain is configured.
- [ ] Register that origin as a trusted origin on the Neon Auth **`main`** branch — Neon console → project → Auth section.
- [ ] Confirm `http://localhost:4321` is still registered on the **`dev`** branch.
- [ ] Verify on an iOS device (no automated test covers this):
  1. Sign in on desktop first — a `403` here means the trusted origin is missing.
  2. Sign in in iOS Safari (tab, not installed).
  3. Add to Home Screen.
  4. Sign in inside the installed app.

## Why mandatory

Auth traffic is now proxied same-origin through `/api/auth/*` and forwards the browser's `Origin` header unchanged (rewriting it would defeat CSRF protection). Better Auth origin-checks that header against `trustedOrigins` on every non-GET request. Without the `main`-branch registration, `POST /api/auth/sign-in/email` returns `403 FORBIDDEN` and login appears broken.
