---
id: D0494
status: accepted
date: 2026-10-25
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

# A statistics `tz` is a named zone; offset-style strings are refused

## Context and Problem Statement
Node's `Intl` accepts `+01:00` as a fixed offset, while Postgres reads the same string POSIX-style with the sign flipped, so SQL day buckets and the JS windows disagreed by two hours. The skipped-midnight bound sat an hour early on those days (#1088 review).

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`isValidTimeZone` (`pages/api/statistics/types.ts`), shared by `StatisticsRangeQuery`, the routine section query and `StatisticsHomeQuery`, rejects a `tz` that starts with an optional sign and a digit (`+01:00`, `-0500`, `1`) before the `Intl` check. Named zones such as `Etc/GMT+5` and `UTC` pass. `homeWindows` starts a local day whose midnight a clock change skips (America/Santiago, America/Havana) at the change instant.".

### Consequences
a hand-made request with an offset `tz` now answers `422 VALIDATION_FAILED`; browsers send IANA names and are unaffected. No schema change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/pages/api/statistics/types.test.ts` holds "rejects an offset-style tz". `app/tests/modules/stats/home-stats.module.test.ts` covers `homeWindows` for America/Santiago.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-25
Supersedes: none (refines D493).

* Commit `01286642` (PR #808, 2026-10-25; adds the D494 row to `decisions/api.md`): rebuilt Confirmation; source of the split-copied Context and Consequences. The commit changes both test files.
