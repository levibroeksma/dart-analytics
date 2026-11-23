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

# A weekly schedule's "today" is resolved client-side, and `GET /api/schedules/active` exists only to save that lookup its own round trip

## Context and Problem Statement
per the design spec's §5 (`docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`), the server has no fact to resolve "today" from: `players` carries no timezone column, and the API sets no cookie a server-side handler could read one back from. Adding either would be data minimisation in the wrong direction for a value the client already has for free (`new Date()` in the browser's own timezone) — the roadmap correction D321 §8 item 9 named this resolution client-side before Phase 3 was even planned, and D342's Consequences paragraph deferred the write-up to this pass because no route existed yet to hang it on. The convenience route was weighed against reusing the list (`GET /api/schedules`, filtering client-side for `isActive`): the list returns every schedule the caller owns with no `days[]` (`v_training_schedules` alone, no day rows), so the Today card would need a second request for the active schedule's detail regardless — `/active` collapses that into the one call `04-Endpoint-Contracts.md`'s Training Schedules section documents.

## Decision Drivers
* `players` carries no timezone column and the API sets no cookie the server could read one from.
* A new fact about the player to resolve the weekday would be data minimisation in the wrong direction.
* `GET /api/schedules` returns summaries and `GET /api/schedules/:scheduleId` returns the `days[]`, so the Today card needs the active schedule's detail.

## Considered Options
* A server-side `/api/schedules/today` endpoint (the spec lists none).
* Resolve "today" on the client and reuse `GET /api/schedules`, picking the active row client-side. The spec marks this as open against the convenience route.
* Resolve "today" on the client and add `GET /api/schedules/active` (chosen).

## Decision Outcome
Chosen option: "no `/api/schedules/today` endpoint exists. The client resolves "today" itself: `isoWeekday(date)` maps `Date.getDay()` to ISO weekday (`0` → `7` = Sunday, `1`–`6` unchanged), and `todayEntry(schedule, date)` indexes the active schedule's `days[]` for that number, both in `app/src/lib/training/schedules/today.ts`. `GET /api/schedules/active` is added alongside the five CRUD/activation routes as a convenience read: it returns the caller's active `Schedule`, `days[]` populated, or `null` when none is active — never `404` — so the `/training` Today card makes one call instead of fetching `GET /api/schedules` and picking out the active row itself.".

### Consequences
a schedule's weekday resolution can disagree with the player's actual local day only if the browser's clock or timezone is wrong — the same trust boundary every other client-timestamped fact in this app already has (session `startedAt`, activity timestamps), not a new one. `GET /api/schedules/active` is one more route the closed error registry does not touch: it never 404s, so a caller with no active schedule sees `{ ok: true, data: null }`, matching `getActiveSchedule`'s `ServiceResult<Schedule | null>` shape (`app/src/services/schedule.service.ts`). A future per-player timezone column, if one is ever added for an unrelated reason, would let a server-side `/today` become possible without breaking this contract — nothing here forecloses it, and nothing here builds toward it either.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/training/schedules/today.test.ts` asserts the `Date.getDay()` to ISO weekday mapping with Sunday as 7. `app/tests/pages/api/schedules/schedules.test.ts` covers `GET /api/schedules/active` with an active schedule and with `null`.

## Pros and Cons of the Options
### Server-side `/today`
* Bad, because the server has no timezone or cookie to resolve the player's weekday from.

### Client-side with the list
* Bad, because the list carries no `days[]`, so the Today card needs a second request for the active schedule's detail.

### Client-side with `/active`
* Good, because the Today card makes one call for the active schedule with `days[]`.

## Evidence / More Information
Decided: 2026-09-20
Refines: D342

* `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md` (§ 4, § 5, § 7): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-18-weekly-training-schedules.md` (Resolved judgement calls): resolved the spec's open convenience-route question, rebuilt Considered Options.
* Commit `02e403ea` (2026-09-20; docs slice adding the D343 row): no section rebuilt from it.
