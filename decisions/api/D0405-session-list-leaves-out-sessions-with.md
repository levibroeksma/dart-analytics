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

# Session list leaves out sessions with no darts

## Context and Problem Statement
a session with no darts has nothing to replay and no insight.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* List every terminal session, including those with no darts (the behaviour before this record).
* Filter `dart_count > 0` in the list query (chosen).

## Decision Outcome
Chosen option: "`GET /api/statistics/games/:gameTypeKey/sessions` (`findGameSessionsPage`) filters `v_stats_session_facts.dart_count > 0` in the query. No migration: the view is unchanged.", because a session with no darts has nothing to replay and no insight.

### Consequences
never-started abandoned sessions no longer appear in the list; section aggregates (`completion`, `volume`) are unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/repositories/statistics.repository.test.ts` asserts that the session list query excludes sessions with no darts.

## Pros and Cons of the Options
### List sessions with no darts
* Bad, because a session with no darts has nothing to replay and no insight.

### Filter in the query
* Good, because it needs no migration: the view is unchanged.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (narrows D367 decision 4's list population).

* Commit `0a7ce6c5` (2026-10-04, PR #766; adds the D405 row and the repository test): rebuilt Considered Options, Confirmation and Pros and Cons.
