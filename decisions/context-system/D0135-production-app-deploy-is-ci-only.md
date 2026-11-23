---
id: D0135
status: accepted
date: 2026-07-24
origin: contemporaneous
original-date:
tags: [context-system, gate, CI, deploy, format, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Production app deploy is CI-only

## Context and Problem Statement
Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts

Per the spec, `deploy.sh` assumed an old Workers/Pages split and a missing prerequisite script, and `wrangler.toml` was stale next to `wrangler.jsonc`. CI lacked `npm test`.

## Decision Drivers
* Unformatted or broken code must not reach production.
* Repeat deploys should not depend on a local script or on memory of Wrangler flags.
* One shared gate definition avoids drift between PR and deploy checks.

## Considered Options
* Keep the local `deploy.sh` path (the state before this record).
* CI-only deploy through a reusable quality workflow and an approval-gated deploy job (chosen).

## Decision Outcome
Chosen option: "Production app deploy is CI-only: reusable `quality.yml` (structure + format/`astro check`/fallow/`npm test`) on PRs and again on `main`, then `deploy.yml` builds and `wrangler deploy`s after GitHub Environment `production` approval; local `deploy.sh` / stale `wrangler.toml` retired; Neon migrate stays out of deploy", because Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts.

### Consequences
* Good, because the shared quality suite gains `npm test`, which CI lacked before.
* Neutral, because the Worker runtime secrets stay in Cloudflare. CI needs only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, plus a GitHub Environment `production` with required reviewers.
* Neutral, because a rejected approval or a red quality run changes nothing in Cloudflare, and a failed `wrangler deploy` leaves the previous Worker version in place.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's success criteria require a PR with failing tests or format to be unmergeable and `main` to re-run the same gates before the approval wait. `.github/workflows/quality.yml` and `.github/workflows/deploy.yml` exist today, and the deploy job sets `environment: production`. `app/scripts/deploy.sh` and `app/wrangler.toml` do not exist.

## Pros and Cons of the Options
### Keep the local `deploy.sh`
* Bad, because it conflicted with the live Astro Worker model and relied on a missing prerequisite script.

### CI-only deploy
* Good, because the same gates run on PRs and on `main`, so gate definitions cannot drift.
* Good, because the Environment approval keeps a human gate without local deploy scripts.

## Evidence / More Information
Decided: 2026-07-24

* `docs/superpowers/specs/2026-07-24-ci-production-deploy-design.md` (§ 1, § 2, § 5–§ 9, § 11): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-24-ci-production-deploy.md` (Global Constraints, Task 4, Task 5, the D135 row): confirmed the file changes and row text.
* Commit `ffd957e7` (2026-07-24): documented the CI deploy and added the D135 row.
