# Visual Board Input — Design

> status: canonical (until superseded)
> scope: `database/` migration + seed, `app/` engines/API/frontend, `docs/architecture/`
> updated: 2026-08-05

---

## Purpose

Capture darts by tapping where they landed on the dartboard SVG, instead of
typing a visit total or picking a ring from a keypad.

Two goals, equally weighted:

- **Faster input.** One press-drag-release per dart, no arithmetic, no ring
  picker.
- **Spatial facts.** Where a dart landed — including where it missed — becomes
  a stored fact, making heatmaps, miss margins and pattern discovery derivable.

## Not a deviation

`06-Spec/04-Runtime-Layer.md` already reserved this: "`location_x` /
`location_y` board coordinates are deferred: the current schema does not define
these columns, and they may be added in a future schema revision **when the UI
can capture them**." This design is that revision. `input_modes` is a seeded
lookup with two rows, built to grow.

The philosophy is unchanged. Coordinates are a fact — the highest-resolution
statement of what happened. Everything they imply (margin, radius, angle,
sector, bust rate) stays derived.

## Non-goals

Each is its own later spec.

- **Heatmap and scatter visualisation.** This design makes the data exist. It
  renders no chart.
- **Miss-margin dashboards, pattern discovery.**
- **Retrofitting the other four games** (Bob's 27, Singles Training, Doubles
  Training, TUOD). Mechanical once this lands: a capability seed row plus the
  engine's visual path. Doubles Training and Bob's 27 gain true miss margins
  free, because they already declare per-dart intent.
- **Backfill of existing sessions.** Impossible by design — they have no
  coordinates, and completed gameplay is immutable.
- **Replacing the keypad.** It remains the accessible alternative input.

---

## Decisions taken

| # | Decision | Rationale |
| - | -------- | --------- |
| 1 | `VISUAL_BOARD` is a third `input_modes` row | Sessions stay self-describing; existing sessions and modes untouched |
| 2 | `location_x` / `location_y` are nullable columns on `darts` | Coordinates annotate the same fact row; every existing view and engine keeps working |
| 3 | Target, zone and score are resolved **at throw time** by a shared pure classifier | Board geometry stays out of SQL; engines score a dart without a round trip |
| 4 | Units are **regulation millimetres**, origin bull centre, y-axis down | The SVG is already drawn in them; margins read as "8 mm short of T20"; survives an SVG redesign |
| 5 | Intent stays ruleset-declared | No extra taps; margin is derived from the intended zone's centroid where a ruleset declares one |
| 6 | Off-board handled two ways: surround tap stores real coordinates; a "no location" action stores `MISS` with NULL coordinates | A bounce-out has no honest landing point; a surround miss does, and it is the data the feature exists for |
| 7 | Capability declared in a cross-runtime constant **and** a seeded capability table | Code owns "this engine implements this mode"; the database still cannot hold an undeclared combination |
| 8 | App mode persists server-side in `player_settings` | Supersedes D60's deferral clause — the value now gates which games are visible, so a per-device value would disagree across devices |

### Rejected alternatives

- **Adapter above unchanged engines.** A capture module summing taps into a
  visit total while separately emitting dart facts. Rejected: the visit total
  and the dart rows become two independent truths for one visit, against
  Pattern 18's single-owner fact log.
- **New ruleset versions (`FIVE_OH_ONE_V2`).** Zero risk to existing sessions,
  but forks each game's rules into two maintained copies, and every future game
  repeats the fork.
- **Coordinates only, zone derived in views.** Purest reading of "store facts",
  but board geometry becomes a database concern and every existing view needs a
  second code path for coord-less rows.
- **Sidecar `dart_locations` table.** Structurally explicit, but an extra table,
  an extra insert and a join in every spatial view.
- **`CHECK` enumerating legal mode triples.** Same guarantee as the capability
  table, but one expression listing every game, edited by migration on every
  change, and unqueryable.
- **Capability as a `game_types` or `ruleset_versions` column.** Claims a
  capability the engine may not implement, with nothing catching the drift.

---

## Database

### Migration `0017`

- `darts.location_x`, `darts.location_y` — `NUMERIC(6,2)`, nullable, millimetres.
- `chk_dart_location_pair` — both NULL or both present.
- `ruleset_version_capabilities` — `(ruleset_version_id, capture_mode_id,
  input_mode_id)`, composite primary key, each column FK'd to its lookup.
- Composite FK from `exercise_sessions` `(ruleset_version_id, capture_mode_id,
  input_mode_id)` to that primary key. The database then physically cannot hold
  a session whose mode combination is undeclared.
- The two `player_settings` FKs that `03-Player-Layer.md` specifies but
  migration `0003` never created: `default_capture_mode_id` → `capture_modes`,
  `default_input_mode_id` → `input_modes`.

Migrations `0001`–`0016` are untouched.

### Seed `0005`

- `input_modes` row `3 / VISUAL_BOARD`.
- `ruleset_version_capabilities` rows covering the combination **each of the six
  existing ruleset versions already uses** — `501_V1`, `TUOD_V1`, `SINGLES_V1`,
  `SCORE_TRAINING_V1`, `BOBS27_V1`, `DOUBLES_TRAINING_V1`. The exact triple per
  ruleset is read from its current validator during planning; quick-score games
  and dart-level games do not share one. No current session shape may be
  invalidated by the new composite FK — this is a correctness precondition of
  migration `0017`, not a detail.
- `ANALYTICS + VISUAL_BOARD` rows for `501_V1` and `SCORE_TRAINING_V1` only.

No new `dart_zones` row. A surround tap is `MISS` with real coordinates.

### Coordinate contract

Origin at bull centre. Y increases downward, matching the SVG viewBox
(`-220,-220,440,440`). Regulation radii, in millimetres:

| Ring | Radius |
| ---- | ------ |
| Inner bull | 0 – 6.35 |
| Outer bull | 6.35 – 15.9 |
| Inner single | 15.9 – 97 |
| Treble | 97 – 107 |
| Outer single | 107 – 162 |
| Double | 162 – 170 |
| Surround (scores 0, coordinates stored) | 170 – 220 |

Sectors are 18° wide, 20 centred on the upward vertical.

---

## Documentation changes

- `06-Spec/04-Runtime-Layer.md`
  - The deferred-coordinates paragraph is replaced by the shipped contract.
  - The capture-depth list gains a fourth pairing: **`ANALYTICS +
    VISUAL_BOARD`** — hit target, hit zone, score and coordinates always;
    intention only where the ruleset declares it.
  - The 501 bust limitation is rewritten as **mode-scoped**: it holds for
    `QUICK_SCORE` sessions and is retired for `VISUAL_BOARD` ones. Not deleted —
    sessions played before this remain unfixable.
  - The "application keeps `total_score` consistent with dart rows" line gains
    an explicit **bust carve-out** (see below), without which the two statements
    contradict each other.
- `03-Player-Layer.md` — v1 deferral note updated: settings endpoints ship.
- `06-API/04-Endpoint-Contracts.md` — the settings endpoints.
- `06-Spec/05-Read-Model-Layer.md` and `05-Database/05-Views.md` — view
  contracts for `v_dart_locations` and `v_player_settings`.
- `00-Context-Map.md` — new files registered; migration range updated to `0017`.
- `decisions/**` — new decisions, append-only, routed per `DECISIONS.md`:
  coordinates shipped (`database.md`), `VISUAL_BOARD` + capability table
  (`architecture.md`), engine input-mode branch + mode-scoped bust
  (`game-engine.md`), settings un-deferral superseding D60's deferral clause
  (`api.md`).

---

## Engine

`TurnFact` already carries `darts: DartFact[]`; quick-score games emit it empty.
A dormant path gets used rather than a new one invented.

- `DartFact` and `DartObservation` each gain `locationX: number | null` and
  `locationY: number | null`. That is the entire type widening.
- `GameEngineFactory.create(config, prior)` also takes the session's input mode.
  Under `QUICK_SCORE` both engines behave exactly as today.
- Under `VISUAL_BOARD`, `record()` accepts one `DartObservation` per dart.
  `turns.total_score` is derived as the sum of counted dart board scores —
  which is what `04-Runtime-Layer.md` already defines that column to be.
- `undo()` becomes per-dart in visual mode, still an exact inverse over
  `facts()`, still unbounded depth.
- Stage types are unchanged: 501 keeps `LEG`, Score Training keeps its existing
  stage. Mapping is one `TurnFact` per visit, one `DartFact` per tap.

### The bust becomes visible

A busted visit persists as `total_score = 0` **with** dart rows whose own scores
are non-zero. Counted zero, thrown non-zero — that asymmetry is the fact today's
schema cannot express, and it is what makes bust rate and true checkout
percentage computable. It is also why `04-Runtime-Layer.md` needs the carve-out
above: for a bust, `total_score` legitimately diverges from the sum of its dart
rows.

### 501's double-out confirm gate

`finishedOnDouble` exists because quick-score input cannot tell where the
winning dart landed. A tap can — the zone is resolved from the coordinate. The
gate stays for `QUICK_SCORE`; `FiveOhOneVisitInput` keeps its current shape for
that path.

---

## API

- `GET` / `PATCH /api/players/me/settings` — controller → service → repository,
  read via `v_player_settings`, per `06-API/04-Endpoint-Contracts.md` and the
  frozen envelope conventions.
- Session creation rejects a mode triple absent from the capability
  declaration.
- **The Worker re-classifies coordinates on write.** The batch validator
  recomputes `classify(x, y)` and rejects a payload whose submitted
  `hit_zone_id` or `score` disagrees. Without this the client is the sole
  authority on the analytical fact, and a stale or tampered client writes
  permanent garbage into the dataset this feature exists to build.
- `quick-score.validator.ts` keeps enforcing "no dart rows" for
  `RECREATIONAL + QUICK_SCORE`. Visual sessions are `ANALYTICS + VISUAL_BOARD`
  and take a separate rule path.

---

## Frontend

### Geometry is code; the SVG is presentation

`lib/game/board/board-geometry.module.ts` holds the radii and one pure
`classify(x, y) → { targetNumber, zoneKey, score }`. It lives in `lib/` because
it is **cross-runtime** — the Worker validator imports the same function.

A test parses `dartboard.svg`'s path radii and asserts they equal the
constants, so a future SVG redesign cannot silently change what a "treble"
means. This is the drift the design is most exposed to.

### Component layering

Per the file-location rules (`scripts/check-file-locations.sh`):

- `components/ui/DartBoard.astro` — inlines the SVG, no logic.
- `modules/game/board-input.module.ts` — pointer handling, magnifier state,
  screen→mm transform via inverse `getScreenCTM()`. Portable; imports no API
  client.
- The play pages' Alpine factory wires the module to the engine.

### Interaction

The precision problem is real: the treble ring is 10 mm tall, and on a phone the
board renders around 340 px wide, so roughly 1 mm ≈ 1 px — a 10 px band under a
~45 px fingertip. A misclassified tap corrupts the fact log, not just the UI.

Press opens a ~4× zoomed inset near the touch point, offset so the thumb never
covers it, showing a crosshair and the live resolved read ("T20 · 60"). Drag
adjusts inside the inset. Release commits the dart and advances. A "no location"
action beside the board covers bounce-outs: `MISS`, score 0, coordinates NULL.
Undo is per dart.

### Settings and games page

- Profile page gains the app-mode form, reading and writing the settings
  endpoints.
- Games page filters its cards by capability and shows an analytics-mode
  banner when analytics capture is on.
- The games page stays `prerender = true`; the filter runs client-side in
  Alpine against the settings store, consistent with D97 — prerendered
  protected shells are public by design, and the JWT-gated API is the real
  boundary.

### Accessibility

Pointer-only input excludes keyboard and switch users. The existing keypad
stays reachable as the alternative input for these sessions. The board is
additive at the UI level, even though it is a distinct persisted mode.

Styling uses semantic tokens and `cn()` only, per `07-Style-Guide.md` and the
style gates.

---

## Read model

`v_dart_locations` exposes coordinates plus derived polar form (radius mm, angle
degrees), and — where the ruleset declared intent — the margin to the intended
zone's centroid.

Everything is derived in the view. Nothing computed is stored. Existing `v_*`
views are untouched; coord-less darts return NULL and remain valid rows.

---

## Testing

Vitest, under `app/tests/` mirroring `app/src/`.

- **Classifier boundaries** — every ring edge (6.35 / 15.9 / 97 / 107 / 162 /
  170 / 220), the 18° sector boundaries and their 9° offset, bull vs outer
  bull, surround vs off-board.
- **SVG-vs-constants parity** — parses `dartboard.svg`, asserts declared radii
  equal the geometry module.
- **Constant ↔ seed parity** for `ruleset_version_capabilities`.
- **`constraint-mirror.test.ts`** gains `chk_dart_location_pair` bounds; the
  `// MIRRORS:` anchor lands in `pages/api/sessions/types.ts`.
- **Engine rehydration** in both input modes from persisted `EngineFacts`;
  per-dart `undo()` as exact inverse of `record()`.
- **Worker rejection** of coordinate/zone disagreement, and of an undeclared
  mode triple.

### Gates

`scripts/check-game-engines.sh` extended to assert every registered engine
declares its supported input modes; `scripts/check-constraint-mirror.sh`;
`npm run validate:app`; the `context-maintenance` skill.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| SVG redesign silently shifts ring meaning | SVG-vs-constants parity test |
| Client submits mismatched zone/score | Worker re-classifies on write |
| Capability constant and seed drift | Parity test + composite FK |
| Fat-finger misclassification biases treble/double data | Magnifier; commit on release, not press |
| Composite FK rejects an existing session shape | Seed `0005` covers all six ruleset versions' current combination |
| Engine branch doubles the paths under test | Rehydration tested in both modes; `QUICK_SCORE` behaviour asserted unchanged |
