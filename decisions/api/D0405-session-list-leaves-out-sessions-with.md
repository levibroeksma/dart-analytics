---
id: D0405
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Session list leaves out sessions with no darts

## Context and Problem Statement
a session with no darts has nothing to replay and no insight.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`GET /api/statistics/games/:gameTypeKey/sessions` (`findGameSessionsPage`) filters `v_stats_session_facts.dart_count > 0` in the query. No migration: the view is unchanged.", because a session with no darts has nothing to replay and no insight.

### Consequences
never-started abandoned sessions no longer appear in the list; section aggregates (`completion`, `volume`) are unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (narrows D367 decision 4's list population).
