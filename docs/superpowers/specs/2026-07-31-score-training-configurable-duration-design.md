# Score Training — Configurable Duration (Setup V2)

**Date:** 2026-07-31  
**Status:** Design approved (revised 2026-07-31 after validation against the codebase — see Revision log)  
**Scope:** Score Training setup UI + client clamp + `ScoreTrainingConfig` bounds + minutes preset seed (15 → 5) + seed runner registration + play-again duration carry-over  
**Does not change:** Engine, capture/input modes, API routes, TUOD, ruleset version key (`SCORE_TRAINING_V1` stays)

---

## Overview

Setup today exposes two fixed configuration presets as radios (“10 Rounds” / “15 Minutes”). The engine and Zod schema already accept arbitrary `duration_type` / `duration_value` within bounds; this design makes the value editable in the UI and tightens product bounds.

Radios select **mode only** (Rounds vs Timed). A single text field (`Input.astro` + `x-model.number`) sets rounds or minutes. Session create stays **template + overrides**: the matching seeded preset is the base; `duration_value` is overridden with the (possibly clamped) input — on the setup form and on play-again alike.

---

## Goals

| Goal            | Detail                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| Mode radios     | Indicate `ROUNDS` or `MINUTES` only — not preset names                                 |
| Editable value  | `Input.astro`, `type="text"` + `x-model.number`; label = “Rounds” or “Minutes” by mode |
| Template base   | Mode → matching seeded preset; `overrides: { duration_value }`                         |
| Minutes default | Seeded minutes preset becomes **5** (was 15), including existing DBs                   |
| Bounds          | ROUNDS **1–100**, MINUTES **3–30** (Score Training schema only)                        |
| Invalid input   | Clamp to nearest valid bound, then start; notice only when a clamp occurred            |

---

## Out of scope

- TUOD or any other game’s duration bounds / setup
- Persisting last-used mode/value across visits (`$persist` form)
- Engine completion rules, batch validation semantics beyond bound numbers
- New API endpoints or `SCORE_TRAINING_V2` ruleset key
- Changing max_darts / other template fields from the setup form

Play page UI is out of scope, but `playAgain()`’s **session-create payload** is not — see “Play again”.

---

## UI

### `SetupSessionForm.astro` (Score Training)

Replace the `x-for="preset in presets"` radio list with:

1. **Mode radios** — values `"ROUNDS"` | `"MINUTES"`, bound to `durationType`
2. **Duration field** — `<label>` text switches with mode (`Rounds` / `Minutes`); **`Input.astro`**, not a raw `<input>`, carrying `type="text"`, `inputmode="numeric"` and `x-model.number="durationValue"`. `Input.astro` is required, not optional: `07-Frontend/07-Style-Guide.md` §“Implement a reusable class contract once” mandates the shared wrapper, and the bare `.input` class in `global.css` supplies only background/shadow/transition — border, radius, padding and text sizing live in `Input.astro`’s `cn()` composition, so a raw `<input class="input">` renders unstyled. `Input.astro` spreads unknown props, so the Alpine bindings pass through.
3. **Clamp notice** — separate from the error alert; muted/helper copy; `x-show="clampNotice"` + `x-cloak`; cleared on mode change and on user edits to the field via **`@input="clampNotice = ''"` on the duration field**. Explicitly **not** an Alpine `$watch` on `durationValue`: `start()` writes the clamped value back to `durationValue` before setting `clampNotice`, and a `$watch` fires asynchronously after that mutation, so it would blank the notice the user is supposed to read. `@input` fires only on real user typing, which is exactly the intended trigger. (No `$watch` exists anywhere in this codebase today; introducing one here would also be untestable in the factory unit tests, which have no Alpine instance.)
4. **Error alert** — unchanged (load/create/missing-preset failures)
5. **Let’s play** — unchanged button → `start()`

Presets remain loaded in the factory for template resolution; they are **not** listed as user choices.

### Factory state (`score-training-setup.data.ts`)

| Field           | Role                                   |
| --------------- | -------------------------------------- |
| `presets`       | Loaded templates (unchanged fetch)     |
| `durationType`  | `"ROUNDS"` \| `"MINUTES"`              |
| `durationValue` | `number \| string \| null` — see note  |
| `clampNotice`   | `string` — empty when no clamp message |

**`durationValue` is not typed `number`.** Alpine’s `x-model.number` runs `parseFloat` and returns the number only when parsing succeeds: an empty field yields `null`, and unparseable text (`"abc"`) yields the raw **string**. Typing the field `number` would be false at runtime. It is declared `number | string | null` on `ScoreTrainingSetupContext`; the clamp helper takes `unknown` and normalises, and after `start()` the field always holds a valid number again.

Remove `selectedTemplateId`. Resolve `templateRef` only inside `start()` via `presetForMode`.

**Init (after presets load):** `durationType = "ROUNDS"`, `durationValue` = rounds preset’s `duration_value` (fallback **10** if missing).

**Mode change:** set `durationType`; reset `durationValue` to that mode’s preset `duration_value` when present, else literals ROUNDS **10** / MINUTES **5**; clear `clampNotice`.

Styling: no new CSS. The duration field is `Input.astro` (which composes `.input` itself); radios use the `.control` primitive; the error alert is unchanged.

---

## Start flow

```
mode + durationValue
    → resolve preset by configuration.duration_type === durationType
    → clamp durationValue to mode bounds
    → if clamped: set clampNotice to allowed-range copy; write clamped value back
    → POST /api/sessions { source: "template", templateRef, overrides: { duration_value } }
    → toSnapshot(merged config) → game.store.startSession → navigate play
```

### Template resolution

`presetForMode(durationType)`: first preset in `presets` whose `configuration.duration_type` equals the mode. No match → set `error` to `Could not find a preset for this mode.`, abort — no create.

### Clamp rules (client, before POST)

Bounds: ROUNDS `[1, 100]`, MINUTES `[3, 30]`.

| Input                                                  | Result                   |
| ------------------------------------------------------ | ------------------------ |
| Finite integer in range                                | Unchanged; no notice     |
| Finite non-integer                                     | `Math.floor`, then clamp |
| `> max`                                                | → max                    |
| `< min`, `NaN`, non-finite                             | → min                    |
| `null` (empty field), string (`"abc"`), any non-number | → min                    |

`Math.floor` rounds down, not toward zero; negatives clamp to `min` regardless, so the two never differ in effect here.

If the value used for create differs from the pre-clamp input → set:

- ROUNDS: `Allowed range: 1–100 rounds`
- MINUTES: `Allowed range: 3–30 minutes`

Then **continue** with session create immediately (user does not re-tap).

### Create payload

```ts
{
  gameTypeKey: "SCORE_TRAINING",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config: {
    source: "template",
    templateRef: preset.configurationTemplateId,
    overrides: { duration_value: durationValue }, // post-clamp
  },
}
```

`configSnapshot` must reflect the **merged** template + override (same `toSnapshot` path as today after merge).

Server Zod remains authoritative if the client is bypassed.

### Play again

`playAgain()` in `app/src/lib/game/score-training-play.data.ts` posts `config: { source: "template", templateRef }` with **no overrides**, then rebuilds the engine and the countdown from the client-side `configSnapshot`. That is fine while every session equals its template. Once duration is configurable it splits: a 25-round session replayed via Play again persists a **10-round** configuration server-side while the player actually plays 25, and a timed replay persists 5 minutes while the countdown runs the custom value.

That is a stored fact contradicting what happened — it breaks “Store what happened” and the immutability intent behind configuration snapshots, so it is corrected here rather than deferred.

`playAgain()` sends the duration it is about to play:

```ts
config: {
  source: "template",
  templateRef,
  overrides: { duration_value: config.durationValue },
},
```

`config` is the existing `configSnapshot` already in scope (guarded non-null at the top of the method), so no new state and no new fetch. The engine/timer construction below it is untouched — it already reads `config`. Nothing else in the play page changes.

---

## Schema & validation

`ScoreTrainingConfig` in `app/src/lib/game/rulesets/types.ts`:

- ROUNDS: `duration_value` **1–100** (was 1–50)
- MINUTES: `duration_value` **3–30** (was 1–180)

Update in lockstep:

- `refinement-contract.ts` accept/reject cases
- `app/tests/lib/game/rulesets/types.test.ts`
- Any Score Training validator / engine tests that hardcode the old ceilings as schema expectations

TUOD schemas and seeds are untouched.

### The MINUTES floor becomes load-bearing — update both blind-spot notes

`refinement-contract.ts` carries a JSDoc block, and `scripts/check-refinement-coverage.sh` a header comment, both stating the same known gap: floor probes prove nothing, because the field-level `.min(1)` rejects `duration_value: 0` whether or not the `superRefine` floor still exists, so only ceiling probes pin the refinement.

A MINUTES floor of **3** ends that for MINUTES. `duration_value: 2` passes `.min(1)` and is rejected **only** by the refinement, making the `duration_value 2 for MINUTES` reject probe the first genuinely load-bearing floor probe in the contract. ROUNDS keeps a floor of 1 and stays redundant.

Both notes must be corrected to say so — a doc that understates its own coverage is as stale as one that overstates it, and this narrows the D148 gap the contract exists to guard.

---

## Seed

### Fresh installs — edit `database/seeds/0002_default_templates.sql`

Minutes preset (`0198f300-0000-7000-8000-000000000008`):

| Field                          | New value                           |
| ------------------------------ | ----------------------------------- |
| `name`                         | `Score Training — 5 Minutes`        |
| `description`                  | `Five minutes of scoring practice.` |
| `configuration.duration_value` | `5`                                 |

Rounds preset unchanged (10).

Fresh installs must stay in sync with `app/tests/lib/game/rulesets/seeded-presets.test.ts`, which holds a hand-copied mirror of every seeded preset — see Testing.

### Existing DBs — new `database/seeds/0004_score_training_minutes_preset.sql`

`0002` uses `ON CONFLICT (id) DO NOTHING`, so already-applied rows stay at 15. Add seed `0004` that `UPDATE`s that UUID’s `name`, `description`, and full `configuration` JSONB to the 5-minute values (same payload as the edited `0002` row).

Two seed conventions apply (`05-Database/10-Database-Agent-Guide.md`):

- **Explicit `BEGIN`/`COMMIT`.** Seeds wrap themselves; `0002` and `0003` both do. `0004` must too.
- **The Seed Checklist mandates `ON CONFLICT DO NOTHING` for idempotency.** A single-row `UPDATE … WHERE id = …` is idempotent by construction but does not match that shape, so `0004` states the deviation and its reason in its header comment. The checklist entry is reworded to “idempotent by construction (`ON CONFLICT DO NOTHING` for inserts; a targeted `UPDATE` also qualifies)”.

### Seed runner registration — `app/scripts/seed.ts`

`database/README.md`’s apply order is documentation; the executable order is the hardcoded `seedFiles` array in `app/scripts/seed.ts`. It is currently **broken and stale**: it lists only `0001` and `0002`, at `../architecture/docs/database/seeds/` — a path that does not exist in this repo. `npm run db:seed` fails outright today, `0003` has never been registered, and `0004` would never apply no matter what the README says. Nothing else catches it: `db:seed` is not part of `validate:app`.

Fix the paths to `../database/seeds/` and register all four seeds in order. Without this, the existing-DB half of this feature does not ship.

No schema migration.

---

## Docs

| Doc                                                                                                      | Change                                                                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/game-rules/rulesets/score-training.md`                                                             | Timed mode; editable N; bounds 1–100 / 3–30; default minutes 5; note setup radios = mode                  |
| `database/README.md`                                                                                     | Register `0004` in Seed Order                                                                             |
| `docs/architecture/05-Database/10-Database-Agent-Guide.md`                                               | “Current seeds” list gains `0004`; Seed Checklist idempotency wording                                     |
| `docs/architecture/00-Context-Map.md`                                                                    | Seed inventory rows (the `seeds/0001`, `0002` row, the `0003` row, and the Seeds summary row) gain `0004` |
| `app/src/lib/game/rulesets/refinement-contract.ts` JSDoc + `scripts/check-refinement-coverage.sh` header | MINUTES floor is now load-bearing                                                                         |
| This spec                                                                                                | Canonical design for the feature                                                                          |
| `DECISIONS.md`                                                                                           | Row for the product bound change + the play-again override fix, at completion via context-maintenance     |

Named explicitly because a generic “run context-maintenance at the end” does not reliably surface seed-inventory rows spread across three files.

---

## Testing

TDD under `app/tests/`, mirroring `app/src/`.

**Setup factory**

- Init defaults to ROUNDS + 10 (from preset when present)
- Mode switch resets to the other mode’s preset default and clears `clampNotice`
- Clamp: above max, below min, NaN → min; notice set only when clamp fires
- Clamp of the real `x-model.number` outputs: `null` (empty field) and `"abc"` (string) → min
- `start()` resolves correct template by mode and POSTs `overrides.duration_value`
- `start()` leaves `clampNotice` set after writing the clamped value back (the regression an Alpine `$watch` would have introduced)
- Missing mode preset → error, no create

**Play page**

- `playAgain()` POSTs `overrides: { duration_value }` taken from the active `configSnapshot`, for both a custom ROUNDS value and a custom MINUTES value
- The existing `ST4` provenance test asserts the create payload exactly and must gain the `overrides` key. Its guarantee — the replay reuses the original `templateRef` — is unchanged; only the payload shape around it grows

**Setup, existing cases**

- The broken-preset test must stop relying on `duration_value: 0`, which the override now overwrites before validation. Same guarantee (an unparseable merged config blocks create), driven by a genuinely missing required field instead

**Schema**

- Retarget floor/ceiling tests to 1–100 / 3–30 (same guarantees, new numbers — do not re-point at unrelated invalid inputs)

**Seed mirror**

`app/tests/lib/game/rulesets/seeded-presets.test.ts` holds a hand-copied `SEEDED_PRESETS` list whose stated job is turning seed/schema divergence into a failing test. Its Score Training MINUTES entry (`"Score Training — 15 Minutes"`, `duration_value: 15`) must move to `"Score Training — 5 Minutes"` / `5` in the same change as seed `0002`.

This one will **not** fail on its own if forgotten — 15 is still valid under the new 3–30 bounds, so the mirror would simply rot into a silent lie. Treat it as part of the seed edit, not as a test that will catch the seed edit.

**.astro markup:** no Vitest; keep branching in frontmatter / Alpine expressions (D101).

---

## Persistence mapping (engine-ready)

Unchanged from V1 Score Training; restated for the hard invariant:

| Concern         | Value                                                |
| --------------- | ---------------------------------------------------- |
| Capture / input | `RECREATIONAL` + `QUICK_SCORE`                       |
| Stage type      | One `EXERCISE_BLOCK`                                 |
| Turns / darts   | Visit totals only; `darts: []`                       |
| Duration        | Copied into configuration snapshot at session create |

---

## Risks & notes

- Existing Neon/dev DBs need seed `0004` (or reseed) or the UI default for minutes stays 15 until update runs — and `app/scripts/seed.ts` must be repaired first, or `npm run db:seed` cannot apply anything at all.
- Tightening MINUTES max from 180 → 30 rejects any future/orphan sessions created with >30 under old bounds; no live product path created those via the old fixed preset (15 only). ROUNDS raising to 100 is backward-compatible for stored snapshots.
- `routine_steps` seeds a 20-minute Score Training step (`0002`); 20 is inside 3–30, and that column is a routine duration governed by `chk_routine_duration_positive`, not by `ScoreTrainingConfig`. Unaffected either way.
- Clamp-then-start means the user may briefly see `clampNotice` before navigation; acceptable.
- `SetupSessionForm.astro` is generically named and takes `title`/`description` props, but after this change its body is Score-Training-specific. It has exactly one consumer (`pages/games/score-training/setup/index.astro`) and no other game has a setup page, so nothing breaks; recorded so the next game’s setup does not assume it is reusable as-is.

---

## Revision log

Revised 2026-07-31 after validating this design against the codebase. Corrections:

1. **Play-again claim was wrong.** The original text said play-again was an inline clone of the snapshot that already carried the custom value. It is `source: "template"` with no overrides, and drops the value. Now specified as a required change.
2. **Clamp notice mechanism.** A `$watch` on `durationValue` would have erased the notice `start()` had just set; replaced with `@input`.
3. **Duration field component.** `Input.astro` is now mandatory, not an “or”; raw `<input class="input">` renders unstyled.
4. **`durationValue` type.** Was implied `number`; Alpine yields `null` and strings too.
5. **Seed runner.** `app/scripts/seed.ts` is broken and stale, and was previously unmentioned; registering `0004` in the README alone would have been inert.
6. **Seed mirror test.** `seeded-presets.test.ts` was unmentioned and would have rotted silently.
7. **Seed conventions.** `0004` needs `BEGIN`/`COMMIT`; the `ON CONFLICT` checklist deviation is now stated.
8. **Doc targets.** Seed inventory rows in the DB agent guide and context map, and the two refinement blind-spot notes, are named rather than left to a generic maintenance pass.

---

## Approval

Approach 1 and design sections 1–4 approved in brainstorming (2026-07-31). The eight revisions above correct facts about the codebase within the approved approach; the product design that was approved is unchanged.
