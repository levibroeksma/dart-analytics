---
id: D0366
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, stores, outbox]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Detailed statistics cache in IndexedDB; closed time buckets and replay pages are never refetched

## Context and Problem Statement
the app is multi-page, so an Alpine store dies on every navigation; sessionStorage is too small for coordinate facts over months. A session's `completed_at` is always stamped "now", so no completed session can ever enter a past bucket — which makes past buckets safe to keep and leaves only the current bucket to refetch, the main saving on Neon and Worker cost. An opaque `dataVersion` lets its definition widen later (e.g. to corrections) without a client change.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "detailed-statistics data is cached in IndexedDB behind one module (planned: *lib/client/stats-cache/*; stores per `docs/architecture/10-Statistics/00-Overview.md` §7), keyed per player, section, section version and parameters. A bucket whose end precedes the request is immutable and cached forever; the open bucket and unbucketed results revalidate against an opaque per-(player, game) `dataVersion` token; replay pages are immutable. Logout or a cache schema bump wipes every store; a blocked or empty IndexedDB degrades to network-only.".

### Consequences
the outbox rule that localStorage backs gameplay persistence is unchanged; IndexedDB here is a read cache, never a source of truth. Alpine stores read through the cache module rather than calling the API client directly.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-26
