---
id: D0367
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session, status, validation]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Phase 1b resolves seven gaps D365 left open: `:gameTypeKey`, bucket widening, rule-free session-result, list ordering, per-section status defaults, `dataVersion`'s formula, and Singles Training's intent tag

## Context and Problem Statement
each gap blocked an otherwise-ready implementation task with a real ambiguity D365 didn't anticipate at the level of a shared cross-endpoint contract. (1) A route keyed on ruleset version would fragment one game's history across pages the moment it gains a second version. (2)–(4) make the IndexedDB cache's coverage math and the session list's pagination well-defined without inventing client-side date arithmetic. (5) closes a validation gap D365 left as "constrained by `includesAbandoned`" without saying what that means at the boundary. (6) picks a concrete, cheap formula for the opaque token D365 already named. (7) is a documentation correction the plan surfaced while wiring `STATS_TAGS`: verified directly against the engine's own `record()` contract, not assumed from the tag table's prior text.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "seven gaps the shared query contract (D365) and `10-Statistics/00-Overview.md` left open, resolved for the phase 1 build (`docs/superpowers/plans/2026-09-26-statistics-phase-1b-foundation.md`):
1. The game-page route segment is `:gameTypeKey` (`game_types.implementation_key`), not `:rulesetKey` — a game page spans ruleset versions (e.g. Singles V1–V3), and `configSensitive` is what keeps versions from blending within it.
2. A bucketed request is widened to whole buckets: the server floors `from` to the start of its own bucket in `tz` and echoes the widened range as `range: { from, to }`. A bucket is `closed` iff `bucketEnd ≤ min(to, now)`, so the client never caches a partial bucket as closed and needs no timezone arithmetic of its own.
3. `session-result` is rule-free in phase 1: `v_stats_session_facts` exposes `counted_score = SUM(turns.total_score)`, `turn_count`, `dart_count`, `duration_seconds` for the owner participant, with `min`/`max` counted score per bucket (both re-aggregate exactly). Which extreme is the personal best is a per-game-type registry value, `RESULT_DIRECTION`; a game whose headline is not a pure function of these components gets `null` — no PB line, sums only.
4. The session list orders by `(completed_at DESC, session_id DESC)`; its opaque cursor encodes both, a documented per-endpoint ordering key under `03-Shared-Conventions.md`'s existing cursor treatment.
5. Status defaults are per-section: an `includesAbandoned` section (`completion`) accepts only `status=all`, its default; every other section accepts only `status=completed`, its default; the session list accepts all three and defaults to `all`. Anything else is `VALIDATION_FAILED`.
6. `dataVersion` = base64url of `v1:<count>:<max completed_at epoch ms>` over the player's terminal sessions of that game type, all statuses, all time — one index-backed query per request.
7. Singles Training is `intent-derived`, not `intent-stored` as `00-Overview.md` §3 previously listed it: its engine (`singles-training.engine.module.ts` `record` JSDoc) writes both intent columns `NULL` by design, since every ring on the current number is a valid aim and `chk_dart_target_consistency` (`0007`) rejects a number without a zone. The aimed number is recovered from the visit index, the same way as Shanghai and Around the Clock, so Singles moves from phase 2's `intent-stored` family to phase 4's `intent-derived` family.".

### Consequences
`10-Statistics/00-Overview.md` §3, §5, §6 and `01-Section-Catalog.md` §1.2 are corrected/extended to match this block (version bump 1.1.0). `06-API/04-Endpoint-Contracts.md` gains the two built routes' full contracts. `RESULT_DIRECTION` is `null` for 501, TUOD, 121, Singles Training, Doubles Training, Bob's 27 and Around the Clock in phase 1 — filed as discovered work (issue #615) rather than invented here, since each needs its own game-specific section (phase 4) to define a real headline. Root `CLAUDE.md`'s applied-migration range extends to `0043`, citing the green phase 1a deploy run as the proof.

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
Refines: D365
