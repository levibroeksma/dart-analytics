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
<!-- backfill: pending -->

# Production app deploy is CI-only

## Context and Problem Statement
Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Production app deploy is CI-only: reusable `quality.yml` (structure + format/`astro check`/fallow/`npm test`) on PRs and again on `main`, then `deploy.yml` builds and `wrangler deploy`s after GitHub Environment `production` approval; local `deploy.sh` / stale `wrangler.toml` retired; Neon migrate stays out of deploy", because Prevents unformatted/broken code reaching Cloudflare; one gate definition avoids PR/deploy drift; Environment approval keeps a human gate without local deploy scripts.

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-24
