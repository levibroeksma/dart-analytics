# TUOD — Round/Time Configuration Parity with Score Training

**Date:** 2026-08-29
**Status:** Design approved (brainstorming), ready for `writing-plans`
**Scope:** TUOD setup UI + client clamp + `TuodConfig` bounds + play-again duration carry-over
**Does not change:** Engine (`TuodEngine`), capture/input modes, API routes, ruleset version key (`TUOD_V1` stays), seed presets, Score Training

---

## Overview

TUOD already carries the same `duration_type`/`duration_value` shape as Score Training —
the schema key, the `TuodEngine`'s ROUNDS/MINUTES completion branches, and the MINUTES
countdown timer in the play page are all already wired (`2026-08-20-tuod-frontend-design.md`).
What TUOD's V1 setup deliberately withheld, by that same design, is editability: solo play
picks between exactly two fixed presets ("10 Rounds" / "10 Minutes"), and "the value itself
isn't editable in V1."

Score Training shipped past that same restriction in `2026-07-31-score-training-configurable-
duration-design.md`: mode radios select ROUNDS/MINUTES only, a text field sets the actual
value within bounds, clamped on submit, carried through play-again. This spec applies that
same change to TUOD's solo setup. 1v1 stays exactly as it is today — ROUNDS only, with an
editable rounds field — that part already has parity and is untouched.

---

## Out of scope

- Score Training or any other game's duration bounds/setup
- 1v1 behavior (`forceRoundsIfGuested`, guest-branch UI) — already editable, untouched
- Engine completion rules, capture/input modes, new API endpoints
- New ruleset version key or migration
- Seed preset values (`starting_target`, `finish_bonus`, `miss_penalty`, and the two
  `duration_value` defaults of 10 stay as seeded)

---

## Schema & validation

`TuodConfig` in `app/src/lib/game/rulesets/types.ts` currently has no ceiling and no
duration-type-conditional bound on `duration_value` — only `.min(1)`. Add a `superRefine`
mirroring `ScoreTrainingConfig`'s exactly:

```ts
export const TuodConfig = z
  .object({
    starting_target: z.number().int().min(2),
    finish_bonus: z.number().int().min(1),
    miss_penalty: z.number().int().min(1),
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
  })
  .strict()
  .superRefine((val, ctx) => {
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 100] : [3, 30];
    if (val.duration_value < min || val.duration_value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });
```

Bounds match Score Training's exactly: ROUNDS 1–100 (already what `tuodRoundsBounds()`
enforces client-side today), MINUTES 3–30 (new — TUOD's MINUTES mode currently has no
server-side ceiling at all).

`tuod.validator.ts`'s `maxTurnScore()` is unaffected: its ROUNDS branch already assumes
`duration_value` up to 100 (unchanged), and its MINUTES branch already uses the fixed
`MAX_THREE_DART_CHECKOUT` ceiling regardless of `duration_value`.

### Refinement contract

`scripts/check-refinement-coverage.sh` requires every schema carrying a `superRefine` to
have a matching entry in `app/src/lib/game/rulesets/refinement-contract.ts`. Add a
`tuodContract` mirroring `scoreTrainingContract`'s shape (base config with fixed
`starting_target`/`finish_bonus`/`miss_penalty`/`max_darts_per_turn`, `duration_type`/
`duration_value` varied):

- Accept: `duration_value` 1 and 100 for ROUNDS; 3 and 30 for MINUTES
- Reject: `duration_value` 0 and 101 for ROUNDS; 2 and 31 for MINUTES

Same blind-spot note as Score Training's contract: the ROUNDS floor (1) duplicates the
field-level `.min(1)` and is not load-bearing on its own; the MINUTES floor (3) is strictly
above `.min(1)` and is the first genuinely load-bearing floor probe for this schema. State
this in the contract's JSDoc, not silently.

---

## Duration helper (`app/src/lib/game/tuod-duration.ts`)

Currently ROUNDS-only (`tuodRoundsBounds()`, `clampTuodRounds()`, `tuodRoundsClampNotice()`),
justified by a doc comment stating ROUNDS is "the only free-typed duration value the ruleset
exposes." That premise no longer holds. Generalize to mirror `score-training-duration.ts`
exactly:

```ts
export function tuodDurationBounds(type: TuodDurationType): { min: number; max: number } {
  return type === "ROUNDS" ? { min: 1, max: 100 } : { min: 3, max: 30 };
}

export function clampTuodDuration(
  type: TuodDurationType,
  value: unknown,
): { value: number; clamped: boolean } { /* same floor/clamp logic as clampScoreTrainingDuration */ }

export function tuodDurationClampNotice(type: TuodDurationType): string {
  return type === "ROUNDS" ? "Allowed range: 1–100 rounds" : "Allowed range: 3–30 minutes";
}
```

Delete the stale "only free-typed value" doc comment. Every call site (`tuod-setup.data.ts`)
switches from the ROUNDS-only names to the type-aware ones.

---

## Setup data (`app/src/lib/game/tuod-setup.data.ts`)

Mirror `score-training-setup.data.ts` structurally:

- **`FALLBACK_ROUNDS = 10`** → **`FALLBACK_DURATION: Record<TuodDurationType, number> = { ROUNDS: 10, MINUTES: 10 }`** — keeps TUOD's own existing minutes default (10), not Score Training's (5); the two games' defaults are independent and this spec does not touch TUOD's seed.
- **`init()`** gains `this.$watch("durationType", (type) => this.selectMode(type))`, same placement as Score Training's.
- **New `selectMode(type)`** method: sets `durationType`, resets `durationValue` to
  `durationValueOf(presetForMode(type)) ?? FALLBACK_DURATION[type]`, clears `clampNotice`.
- **`start()`**: currently only clamps/overrides when `guests.length > 0`. Make this
  unconditional — every session, solo or 1v1, clamps `durationValue` via
  `clampTuodDuration(durationType, durationValue)` and sends
  `overrides: { duration_value: value }`. This drops the `overrideValue: number | null`
  branching entirely; the wire config always carries the (possibly clamped) typed value,
  same as Score Training's `start()`.
- `forceRoundsIfGuested()` is unchanged — still locks `durationType` back to `ROUNDS` when a
  guest is added, which now interacts with an already-editable solo value instead of a
  locked preset pick.

---

## Setup form (`TuodSetupForm.astro`)

Mirror `ScoreTrainingSetupForm.astro`'s structure:

- `durationOpts` values become mode-only labels: `[{value:"ROUNDS", label:"Rounds"},
  {value:"MINUTES", label:"Time"}]` — replacing the current preset-name labels ("10 Rounds"
  / "10 Minutes"), which described a fixed choice that no longer exists.
- Solo branch (`x-if="guests.length === 0"`) gains the `Input` + label + clamp-notice block
  next to the `Toggle`, identical structure to Score Training's solo branch (`Input.astro`,
  `type="text"`, `inputmode="numeric"`, `x-model.number="durationValue"`,
  `@input="clampNotice = ''"`, label text switching `Rounds`/`Minutes` by mode).
- Guest branch (`x-if="guests.length > 0"`) is unchanged — already has the Input + clamp
  notice, no Toggle.

---

## Play again (`tuod-play.data.ts`)

`playAgain()`'s existing doc comment states "V1 has nothing to override, unlike Score
Training's `duration_value`" and sends `config: { source: "template", templateRef }` with no
overrides. That claim becomes false once `duration_value` is player-chosen: a replayed
custom-duration TUOD session would silently persist the preset's default value instead of
the value actually played, the same bug Score Training's 07-31 design fixed.

Fix: send `overrides: { duration_value: config.durationValue }`, mirroring
`score-training-play.data.ts`'s `playAgain()` exactly. `config` is the existing
`configSnapshot` already in scope; no new state or fetch. Update the stale doc comment.

---

## Testing

TDD under `app/tests/`, mirroring `app/src/`.

**`tuod-duration.test.ts`** — rewritten for the type-aware API (mirrors
`score-training-duration.test.ts`): bounds per type, floor/ceiling/NaN/non-finite/null/string
clamping per type, clamp-notice text per type.

**`types.test.ts`** (or wherever schema refinement is unit-tested) — TuodConfig accept/reject
boundary cases for both ROUNDS and MINUTES, exercising the new `superRefine`.

**`tuod-setup.data.test.ts`** — new/expanded cases:

- Init defaults to ROUNDS + 10 (from preset when present)
- Mode switch (`selectMode`) resets to the other mode's preset default and clears
  `clampNotice`
- `start()` clamps and overrides unconditionally for both solo and guest sessions
- Existing guest-path tests keep passing under the now-unconditional override

**`tuod-play.data.test.ts`** — `playAgain()` POSTs `overrides: { duration_value }` taken from
the active `configSnapshot`, for both a custom ROUNDS value and a custom MINUTES value.

**`tuod.validator.test.ts`** — confirm unaffected; add a case if `maxTurnScore()`'s ROUNDS
branch needs a boundary check at the new MINUTES ceiling (unlikely, since that branch only
reads ROUNDS).

**Seed mirror** — `app/tests/lib/game/rulesets/seeded-presets.test.ts`'s TUOD entries are
unchanged (values, not editability, are what it mirrors).

**.astro markup** — no Vitest; keep branching inline (D101).

---

## Persistence mapping (engine-ready)

Unchanged from TUOD V1; restated for the hard invariant:

| Concern         | Value                                                |
| ---------------- | ---------------------------------------------------- |
| Capture / input | RECREATIONAL + QUICK_SCORE, ANALYTICS + VISUAL_BOARD |
| Stage type      | One `EXERCISE_BLOCK`                                 |
| Turns / darts   | Attempt totals (QUICK_SCORE) or per-dart (VISUAL_BOARD) |
| Duration        | Copied into configuration snapshot at session create, now player-chosen in solo play too |

---

## Docs

| Doc | Change |
| --- | ------ |
| `docs/game-rules/rulesets/ten-up-one-down.md` | Editable duration value; bounds 1–100 / 3–30; note setup toggle = mode only |
| `app/src/lib/game/rulesets/refinement-contract.ts` JSDoc | New `tuodContract` entry + MINUTES-floor-is-load-bearing note |
| This spec | Canonical design for the feature |
| `DECISIONS.md` / `decisions/game-engine.md` | Row for the bound/editability change, at completion via context-maintenance |

Named explicitly for the same reason the Score Training design named them: a generic
"run context-maintenance at the end" does not reliably surface a refinement-contract doc
comment addition.

---

## Risks & notes

- No backward-compatibility risk: TUOD's ROUNDS ceiling (100) is unchanged; the new MINUTES
  ceiling (30) has no live product path that ever created a MINUTES session above 30 (the
  only source until now was the fixed "10 Minutes" preset).
- Clamp-then-start means the user may briefly see `clampNotice` before navigation —
  identical to Score Training's accepted behavior.
- `TuodSetupForm.astro` and `ScoreTrainingSetupForm.astro` remain two separate files with
  duplicated structure after this change, same as they are today — no shared component
  extraction is in scope here (neither game's original design proposed one).
