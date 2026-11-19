---
id: D0030
status: accepted
date:
origin: contemporaneous
original-date:
tags: [api]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# API runtime = Astro server endpoints on Cloudflare Workers in `app/` (EU) with Neon

## Context and Problem Statement
Latency to Neon Frankfurt; no separate Node service

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "API runtime = Astro server endpoints on Cloudflare Workers in `app/` (EU) with Neon serverless driver", because Latency to Neon Frankfurt; no separate Node service.

### Consequences
* Neutral, because the Worker reaches Neon through `@neondatabase/serverless`, an HTTP/WebSocket driver, since Workers have no TCP pool.
* Neutral, because the Neon project is new and sits in the Frankfurt region.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: Cont. session

* Commit `8b23f90e` (2026-07-11; adds the `DECISIONS.md` ledger row D30): origin of the split-copied Context and Decision Outcome; no section rebuilt from it.
* `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md` (Approved Decisions, Section 3 Runtime stack, Goal): rebuilt Consequences.
