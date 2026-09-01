# DartBot v1 Delivery Design

> Status: proposed. Sequencing/plan-decomposition design for building DartBot
> v1. Does not redefine architecture — `docs/architecture/08-DartBot.md`
> (v0.5.0) is canonical and unchanged by this document. This document decides
> what ships in v1, how it splits into plans, and the order they land in.

---

## Purpose

`08-DartBot.md` is a fully decided architecture with nothing implemented.
Building it as one plan is too large a unit of work — this document splits
it into 7 independently landable plans and fixes their order, so
`writing-plans` has a scoped brief per plan instead of the whole 797-line
architecture doc.

---

## V1 Scope

Phases 1–7 of `08-DartBot.md` §Delivery Phases, verbatim:

| Phase | Delivers | Gate |
|---|---|---|
| 1 | Geometry reuse + throw engine + level curve — throwing at a fixed target | Deterministic snapshot tests green |
| 2 | Harness + tier calibration | Tier bands green in CI |
| 3 | `DictatedStrategy` | Five rulesets playable in memory, nothing persisted |
| 4 | Seat admission (D-I): `DARTBOT` through `ParticipantInput`, `SeatFact`, `composeSeatFacts()`, `participantsFromSeats()`, `buildSeatPlan()`, a `dartbot` flag beside `SEAT_CAPS`, and `seatsFromParticipants()` deleted | A session is creatable with a bot seat, `display_name` copied server-side, the seat round-trips as `DARTBOT` in both directions, and the inverted test rewritten rather than deleted |
| 5 | DartBot participant write path (closes the `DECISIONS.md` deferral) | A bot turn persists on its own `participantRef` and is absent from both dart views |
| 6 | The play loop: trigger, `botThrowing` guard, post-delay seat re-check, `undoToActiveSeat()`, the QUICK_SCORE scratch-engine fold | One undo press returns the turn to the human; a QUICK_SCORE bot visit uploads one turn with no darts |
| 7 | `X01Strategy` + decision axis → opponent mode on `501_V1` | Alternating-turn play in one `SHARED` leg |

**Out of scope for v1** (explicitly deferred, unchanged from the architecture
doc): ghost mode (phase 8), pressure/form/correlation realism (phase 9),
`fitProfile` from production darts (phase 10), collision resolver v2 and DDA
(phase 11). None of these are prerequisites for a playable 501 bot opponent.

---

## D-E (population prior) handling

Phase 1's level curve normally shrinks toward a population prior fitted from
production darts (D-E). That fit needs a human to run the extract in
§Calibration §D-E of the architecture doc — no agent can do it.

**v1 ships with a hand-set prior.** The architecture doc is explicit that
this is sufficient to throw correct darts ("a hand-set prior throws
perfectly good darts, it just cannot be called calibrated") — it just can't
yet claim a level plays like anything measured. Phase 1's plan must land the
prior as a **named, isolated constant table** at the `level → SkillProfile`
curve seam (already the documented "primary optimizable seam"), so that
swapping in real D-E numbers later is a data edit, not a redesign. No plan
in this sequence waits on D-E landing.

---

## Plan sequencing

Single sequential chain, phases 1 through 7 in order. Each phase is one
plan, one branch, one PR, merged to `main` before the next phase's branch is
cut. No phase branch ever targets another phase branch — every branch is a
single hop off `main` (Hard Invariants: branch-stacking cap, prompt
integration).

| # | Plan | Branch (suggested) | Depends on (merged) |
|---|---|---|---|
| 1 | Throw engine + level curve | `dartbot-1-throw-engine` | — |
| 2 | Calibration harness + tier bands | `dartbot-2-calibration` | 1 |
| 3 | `DictatedStrategy`, 5 rulesets in memory | `dartbot-3-dictated-strategy` | 1, 2 |
| 4 | Seat admission (D-I/D-J) | `dartbot-4-seat-admission` | — (independent of 1–3; may be built any time before 6, but stays after 3 in this chain per your sequencing choice) |
| 5 | DartBot write path | `dartbot-5-write-path` | 4 |
| 6 | Play loop | `dartbot-6-play-loop` | 4, 5 (stub thrower only — doc confirms it does not need 1–3 in full) |
| 7 | `X01Strategy` + 501 opponent mode | `dartbot-7-x01-opponent` | 1, 2, 3, 6 |

---

## What each plan inherits (no re-derivation)

Every plan pulls its content from `08-DartBot.md` rather than restating
design. `writing-plans` is invoked once per phase, after the prior phase has
merged, scoped to exactly these sections:

| Plan | Pulls from `08-DartBot.md` |
|---|---|
| 1 | §Module Boundary (file layout under `modules/dartbot/`), §The Throw Pipeline, §The scatter model, §Skill Model, §Determinism and Replay, §Anti-Patterns rows on geometry duplication / `Math.random()` / score-steering / timers, §Test Strategy rows "geometry reuse," "determinism," "injected rng" |
| 2 | §Calibration (corpus, cold start, `fitProfile` shape — prior itself hand-set per above), §Test Strategy rows "tier bands," "distributional" |
| 3 | §Strategy Layer and Game Coverage table (5 dictated rulesets), §GameView contracts, §Anti-Patterns row "per-ruleset throw engine," §Test Strategy row "contract" |
| 4 | §Persistence §The participant-type gap (full table — this is the literal task list), §Open Decisions D-I/D-J, §Anti-Patterns rows on the two collapse fallbacks (`GUEST`/`PLAYER` mislabeling) |
| 5 | §Persistence §The DartBot participant, §Calibration §Bot darts are already excluded (verifying, not re-implementing), §Test Strategy row "attribution" |
| 6 | §The Play Loop (all four subsections: trigger, capture-mode record paths, re-entrancy, undo), §Anti-Patterns rows on `undo()` popping one turn / missing seat re-check / instance-held `dartIndex` / scratch-engine leakage, §Test Strategy rows "undo," "visit fold," "re-entrancy" |
| 7 | §Strategy Layer and Game Coverage (501 row), §Skill Model §Decision degrades too, §Persistence §Two presentation roles table (Opponent row), `match-outcome.module.ts` reference in §Related Documents |

Each plan closes with `context-maintenance` and `run-all-gates`
(repo-mandatory regardless of this document).

---

## Self-review

- Placeholders: none — every phase's Delivers/Gate is copied verbatim from
  the canonical doc, not invented here.
- Internal consistency: sequencing table and inheritance table agree phase
  4 has no code dependency on 1–3 but is nonetheless placed after them in
  the chain per the user's explicit choice of strict sequential order over
  the two-track split.
- Scope: this document decides sequencing only; it defers all architectural
  content to `08-DartBot.md`, so each of the 7 downstream plans stays
  independently sized.
- Ambiguity: "depends on" in the sequencing table means "must be merged to
  `main` first," not "shares a branch" — stated explicitly to avoid a
  `writing-plans` invocation assuming stacked branches.
