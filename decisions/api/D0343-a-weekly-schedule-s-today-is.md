---
id: D0343
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A weekly schedule's "today" is resolved client-side, and `GET /api/schedules/active` exists only to save that lookup its own round trip

## Context and Problem Statement
per the design spec's §5 (`docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`), the server has no fact to resolve "today" from: `players` carries no timezone column, and the API sets no cookie a server-side handler could read one back from. Adding either would be data minimisation in the wrong direction for a value the client already has for free (`new Date()` in the browser's own timezone) — the roadmap correction D321 §8 item 9 named this resolution client-side before Phase 3 was even planned, and D342's Consequences paragraph deferred the write-up to this pass because no route existed yet to hang it on. The convenience route was weighed against reusing the list (`GET /api/schedules`, filtering client-side for `isActive`): the list returns every schedule the caller owns with no `days[]` (`v_training_schedules` alone, no day rows), so the Today card would need a second request for the active schedule's detail regardless — `/active` collapses that into the one call `04-Endpoint-Contracts.md`'s Training Schedules section documents.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "no `/api/schedules/today` endpoint exists. The client resolves "today" itself: `isoWeekday(date)` maps `Date.getDay()` to ISO weekday (`0` → `7` = Sunday, `1`–`6` unchanged), and `todayEntry(schedule, date)` indexes the active schedule's `days[]` for that number, both in `app/src/lib/training/schedules/today.ts`. `GET /api/schedules/active` is added alongside the five CRUD/activation routes as a convenience read: it returns the caller's active `Schedule`, `days[]` populated, or `null` when none is active — never `404` — so the `/training` Today card makes one call instead of fetching `GET /api/schedules` and picking out the active row itself.".

### Consequences
a schedule's weekday resolution can disagree with the player's actual local day only if the browser's clock or timezone is wrong — the same trust boundary every other client-timestamped fact in this app already has (session `startedAt`, activity timestamps), not a new one. `GET /api/schedules/active` is one more route the closed error registry does not touch: it never 404s, so a caller with no active schedule sees `{ ok: true, data: null }`, matching `getActiveSchedule`'s `ServiceResult<Schedule | null>` shape (`app/src/services/schedule.service.ts`). A future per-player timezone column, if one is ever added for an unrelated reason, would let a server-side `/today` become possible without breaking this contract — nothing here forecloses it, and nothing here builds toward it either.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
Refines: D342
