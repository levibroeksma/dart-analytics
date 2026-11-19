---
id: D0173
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/astro, PWA, manifest]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `apple-mobile-web-app-capable` meta tags + `app/public/manifest.json` (`scope`/`start_url

## Context and Problem Statement
No manifest or meta tags existed; "Add to Home Screen" produced an unconfigured Safari Web Clip that could break navigation out to Safari on an auth redirect

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`apple-mobile-web-app-capable` meta tags + `app/public/manifest.json` (`scope`/`start_url: "/"`, `display: "standalone"`) declare the app as an installable PWA", because No manifest or meta tags existed; "Add to Home Screen" produced an unconfigured Safari Web Clip that could break navigation out to Safari on an auth redirect.

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
Decided: 2026-07-29
