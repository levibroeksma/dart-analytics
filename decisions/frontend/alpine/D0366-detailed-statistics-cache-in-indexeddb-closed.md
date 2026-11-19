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

# Detailed statistics cache in IndexedDB; closed time buckets and replay pages are never refetched

## Context and Problem Statement
the app is multi-page, so an Alpine store dies on every navigation; sessionStorage is too small for coordinate facts over months. A session's `completed_at` is always stamped "now", so no completed session can ever enter a past bucket — which makes past buckets safe to keep and leaves only the current bucket to refetch, the main saving on Neon and Worker cost. An opaque `dataVersion` lets its definition widen later (e.g. to corrections) without a client change. The statistics-pages architecture spec lists IndexedDB persistence among its brainstorming decisions (item 5): only data the client lacks is fetched, and closed time buckets are never refetched. Section 7 of `docs/architecture/10-Statistics/00-Overview.md`, added by the same commit, defines the stores `sectionResults`, `sessionLists`, `replayPages`, `facts` and `meta`.

## Decision Drivers
* Only keys absent or stale in the cache are requested. Splitting a series request into its open bucket is the main cost saving for Neon and Workers (overview § 7, Fetch rule).
* Every cache read and write degrades to network-only when IndexedDB is blocked or empty, never to an error (overview § 7).
* Completed gameplay is immutable, so replay pages never invalidate (overview § 7 table).

## Considered Options
* An Alpine store.
* `sessionStorage`.
* IndexedDB behind one module (chosen).

Rationale unknown — no source found for any further option.

## Decision Outcome
Chosen option: "detailed-statistics data is cached in IndexedDB behind one module (planned: *lib/client/stats-cache/*; stores per `docs/architecture/10-Statistics/00-Overview.md` §7), keyed per player, section, section version and parameters. A bucket whose end precedes the request is immutable and cached forever; the open bucket and unbucketed results revalidate against an opaque per-(player, game) `dataVersion` token; replay pages are immutable. Logout or a cache schema bump wipes every store; a blocked or empty IndexedDB degrades to network-only.".

### Consequences
the outbox rule that localStorage backs gameplay persistence is unchanged; IndexedDB here is a read cache, never a source of truth. Alpine stores read through the cache module rather than calling the API client directly.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Alpine store
* Bad, because the app is multi-page, so an Alpine store dies on every navigation.

### `sessionStorage`
* Bad, because it is too small for coordinate facts over months.

### IndexedDB behind one module
* Good, because past buckets are safe to keep, which leaves only the current bucket to refetch. The Reason names this as the main saving on Neon and Worker cost.
* Good, because an opaque `dataVersion` lets its definition widen later without a client change.

## Evidence / More Information
Decided: 2026-09-26

* `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md` (Decisions made during brainstorming, item 5; Rollout): rebuilt Context.
* Commit `19ab33f1` (2026-09-26; adds the D366 row and `docs/architecture/10-Statistics/00-Overview.md` § 7): rebuilt Context, Decision Drivers, Considered Options and Pros and Cons.
