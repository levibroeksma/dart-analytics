# Catalog Cards and Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store game/exercise tags in the DB (generated from the rules docs) and render them on a reusable catalog card for the Games screen and the routine builder's exercise picker, with the dart hover/throw animation.

**Architecture:** A TS generator parses `docs/game-rules/TAGS.md` plus each playable rules file's `## Tags` table and writes one idempotent seed (vocabulary + type links only). Per-template difficulty is hand-set in its own seed, like every other template column, and an integration test proves it agrees with the docs' labelled Difficulty sets (the `capabilities.ts` ↔ seed `0007` parity pattern). Migration `0047` adds the lookup and link tables, the template column and the read views. A drift gate keeps docs and the generated seed equal. The API exposes tags via a view, and Astro components (`Tag`, `DifficultyMeter`, `DifficultyLegend`, `CatalogCard`) plus an Alpine throw factory render them.

**Tech Stack:** PostgreSQL (dbmate migrations, SQL seeds), Drizzle (introspected `app/src/db/schema.ts`), Astro + Alpine.js, TypeScript, Vitest, bash gates.

**Spec:** `docs/superpowers/specs/2026-10-18-catalog-cards-and-tags-design.md`

## Global Constraints

- New migration only: `database/migrations/0047_catalog_tags.sql`. Never edit `0001`–`0046`.
- Lookups use SMALLINT ids written by the seed. The DB never generates ids. Link tables FK to UUID `game_types.id` / `exercise_types.id`.
- No generic EAV or polymorphic FK: two typed link tables.
- Controlled sets are lookup tables (agent guide rule 7): no `TEXT CHECK (... IN (...))` enums. The tag context is a `tag_contexts` lookup.
- No string-splitting of names for structure. Group names and labels come from DB columns.
- The API reads views only (`v_*`). No raw tables are exposed.
- Scope: only types with an existing `game_types` / `exercise_types` row and a playable card or system template. No coming-soon rows.
- Pill base: `padding 3px 9px; radius 9999px; font 600 11px Montserrat`. Hues: Skill 285, Format 310, Pressure 260, Family 237. Session role uses mono `600 10px`, `.08em`.
- Meter: bars `4px` wide, heights `5/8/11/14px`, gap `2px`. Lit colour `oklch(74% .16 H)` with H = 150, 95, 60, 28 for levels 1–4. Off colour `oklch(100% 0 0 / .15)`.
- Throw timings: hover `transform .35s cubic-bezier(.2,.9,.3,1.2), opacity .25s`. Wind `translate(-52px,-36px)` over `.16s ease-out`. Throw at 170ms to `translate(420px,-36px)` over `.38s cubic-bezier(.55,0,.85,.4)`. Navigate at 550ms. Rest state `rotate(-45deg)`, opacity `.45`. Hover `translate(-38px,-36px)`, opacity `.95`.
- With reduced motion: no dart motion, and navigation is immediate. Hover motion only under `@media (hover: hover)`.
- The reduced-motion check lives once, in `app/src/lib/ui/motion.ts` (`prefersReducedMotion()`); the three existing `matchMedia` copies are repointed to it in this branch (user-approved, not discovered work).
- The meter carries `role="img"`, `aria-label="Difficulty: <Name>"` and `title="Difficulty: <Name>"` (title for the future desktop hover).
- Tap + adds the step and does nothing else.
- Commits: conventional, concise, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Incidental findings become GitHub issues (`capturing-discovered-work`) and are never fixed in the same pass.

## Review Focus

1. **A rules file whose Tags table changes after the seed was generated.** The gate must fail in CI, not drift silently. Owned by Task 3 (`check-tag-seeds.sh` mismatch test).
2. **Re-running seeds after a tag is removed from a doc.** The stale link row must disappear: the seed deletes, then inserts. Owned by Task 2 (seed shape test).
3. **A double tap or Enter spam on a game card during the throw.** It must navigate once only. Owned by Task 6 (`ignores second tap`).
4. **Tags fetch failure on the Games page.** Cards still render and link, with no tags, and the page does not block. Owned by Task 7 (`gamesIndex` tags failure test).
5. **A picker entry with no tags** (`SWITCHING`, `DOUBLE_PATTERN`). The card renders with no meter and no pills, and + still adds. Owned by Task 8 (`groupCatalog` untagged test).
6. **A template difficulty set in the seed that the docs do not list** (or vice versa). The parity test must fail. Owned by Task 4 (integration parity test).

---

## File Structure

| Path                                                                                                                                                                           | Responsibility                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `docs/game-rules/rulesets/{501,121,cricket,tactics,score-training,singles-training,doubles-training,bobs-27,ten-up-one-down,shanghai,around-the-clock,baseball-darts}.md`      | add `Game type: \`KEY\`` header line                            |
| `scripts/check-game-rules.sh`, `scripts/test-check-game-rules.sh`                                                                                                              | validate the optional `Game type:` header shape                 |
| `app/scripts/tags/parse-tags.ts`                                                                                                                                               | pure parsers: vocabulary, a file's Tags blocks, header keys     |
| `app/scripts/generate-tag-seed.ts`                                                                                                                                             | CLI: build seed SQL. `--check` compares with the committed seed |
| `database/seeds/0042_catalog_tags.sql`                                                                                                                                         | generated, committed: `tag_axes`, `tag_contexts`, `tags`, link rows |
| `database/seeds/0043_exercise_template_difficulty.sql`                                                                                                                         | hand-authored: `difficulty_tag_id` per system template          |
| `database/migrations/0047_catalog_tags.sql`                                                                                                                                    | tables, column, views                                           |
| `app/tests/integration/template-difficulty-parity.test.ts`                                                                                                                     | docs labels ↔ seeded template difficulty, per type              |
| `app/src/lib/ui/motion.ts`                                                                                                                                                     | `prefersReducedMotion()` shared helper                          |
| `scripts/check-tag-seeds.sh`                                                                                                                                                   | drift gate, wired in `.github/workflows/quality.yml`            |
| `app/src/repositories/catalog.repository.ts`                                                                                                                                   | `findCatalogTags(db)`                                           |
| `app/src/services/catalog.service.ts`                                                                                                                                          | `listCatalogTags()`                                             |
| `app/src/pages/api/catalog-tags/{index,types}.ts`                                                                                                                              | `GET /api/catalog-tags`                                         |
| `app/src/lib/client/api/catalog.ts`                                                                                                                                            | `fetchCatalogTags()`                                            |
| `app/src/lib/catalog/tags.ts`                                                                                                                                                  | shared types + `cardTags()` ordering helper                     |
| `app/src/styles/global.css`                                                                                                                                                    | tag/meter tokens, `catalog-card`, `card-dart` classes           |
| `app/src/components/ui/{Tag,DifficultyMeter,DifficultyLegend,CatalogCard}.astro`                                                                                               | reusable UI                                                     |
| `app/src/lib/ui/card-throw.data.ts`                                                                                                                                            | Alpine factory for hover/throw/navigate                         |
| `app/src/icons/dart-accent.svg`                                                                                                                                                | card dart (from the design project)                             |
| `app/src/pages/games/index.astro`, `app/src/lib/game/games-index.data.ts`, `app/src/lib/game/rulesets/{games-visibility,types}.ts`                                             | Games screen                                                    |
| `app/src/components/layout/training/routines/ExercisePicker.astro`, `app/src/lib/training/routines/routine-builder.data.ts`, `app/src/lib/training/routines/catalog-groups.ts` | picker                                                          |

---

### Task 1: Explicit game-type key in playable rulesets

**Files:**

- Modify: the 12 ruleset files listed above. Add one header line under `Entry points:`. Keys come from `game_types.implementation_key` in `database/seeds/*game_engine_reference*.sql`. Look each one up; don't guess.
- Modify: `scripts/check-game-rules.sh` (header checks section)
- Test: `scripts/test-check-game-rules.sh` + fixtures

**Interfaces:**

- Produces: header line regex `^Game type: \`[A-Z0-9_]+\`$`(game shape only, optional). Exercises already carry`- Type constant: \`KEY\``under`## Exercise type`, and Task 2 reads that.

- [ ] **Step 1:** Add fixtures: a game file with `Game type: \`cricket\``(lowercase) and one with`Game type: CRICKET`(no backticks). Expect each to report`Game type: must be \`UPPER_SNAKE\``.
- [ ] **Step 2:** Run `bash scripts/test-check-game-rules.sh`. Expect FAIL on the new cases.
- [ ] **Step 3:** In `check-game-rules.sh`, if a `game`-shape file has a line starting `Game type:`, it must match the regex. Absence is allowed, because unbuilt games have none.
- [ ] **Step 4:** Add the header to the 12 playable rulesets. Confirm each has a complete `## Tags` section with a `### Routine step` block where `Entry points` includes routine step. Missing tables are discovered work; file an issue and do not author them.
- [ ] **Step 5:** Run `bash scripts/check-game-rules.sh && bash scripts/test-check-game-rules.sh`. Expect PASS.
- [ ] **Step 6:** Commit `docs(game-rules): explicit Game type key on playable rulesets`.

### Task 2: Tag parser and seed generator

**Files:**

- Create: `app/scripts/tags/parse-tags.ts`, `app/scripts/generate-tag-seed.ts`, `database/seeds/0042_catalog_tags.sql` (generated)
- Test: `app/tests/scripts/parse-tags.test.ts`, `app/tests/scripts/generate-tag-seed.test.ts`

**Interfaces:**

- Produces:
  ```ts
  type Axis = { key: string; name: string; rule: "primary"|"one"|"many"; exclusive: string|null; values: { key: string; name: string }[] };
  type TagRef = { axis: string; key: string; primary: boolean };
  type TagBlock = { context: "STANDALONE"|"ROUTINE_STEP"; tags: TagRef[]; difficultyLabels: { key: string; label: string|null }[] };
  parseVocabulary(md: string): Axis[]
  parseRulesFile(md: string): { gameTypeKey: string|null; exerciseTypeKey: string|null; blocks: TagBlock[] }
  buildSeedSql(input: { axes: Axis[]; games: Map<string, TagBlock[]>; exercises: Map<string, TagBlock[]> }): { sql: string; warnings: string[] }
  ```
- Axis keys are TAGS.md heading names upper-snaked: `SKILL, SESSION_ROLE, FORMAT, DIFFICULTY, MECHANIC, PRESSURE, FAMILY`. Ids are 1-based in TAGS.md order: axes by Axes-table order, tags by global order (axis order, then row order). `tag_contexts`: `STANDALONE` = 1, `ROUTINE_STEP` = 2.
- Exercise Tags have one flat table, which maps to context `ROUTINE_STEP`. A game with no `### Routine step` block also emits a `ROUTINE_STEP` block copied from Standalone without its FAMILY rows (spec "Missing tag sources").
- A `ROUTINE_STEP` block with several labelled Difficulty values writes **no** DIFFICULTY link row for that type/context: per-template difficulty owns it (seed `0043`, Task 4). An unlabelled single Difficulty writes one row as usual.
- The generator never reads template seeds. `difficultyLabels` is exported only for the parity test (Task 4).
- The parser asserts the same shape invariants `check-game-rules.sh` enforces (one primary skill, exactly one Difficulty/Family where required, `NONE` exclusive) and throws on a breach, so the two parsers cannot disagree silently.

- [ ] **Step 1:** Write the parser tests:
  - `parseVocabulary` on the real TAGS.md returns 7 axes; SKILL has 7 values, FORMAT[1].key is `ONE_V_ONE`, PRESSURE.exclusive is `NONE`.
  - `parseRulesFile` on `cricket.md` returns `gameTypeKey: "CRICKET"` and a STANDALONE block containing `{axis:"SKILL",key:"SCORING",primary:true}`.
  - On `doubles-lock.md` it returns `exerciseTypeKey: "DOUBLES_LOCK"` and one ROUTINE_STEP block.
  - The label `INTERMEDIATE (1 dart)` gives `{key:"INTERMEDIATE",label:"1 dart"}`.
- [ ] **Step 2:** Run `cd app && npx vitest run tests/scripts/parse-tags.test.ts`. Expect FAIL (module missing).
- [ ] **Step 3:** Implement the parsers. Line-based markdown table parsing, with no new dependency.
- [ ] **Step 4:** Write the generator tests:
  - The SQL contains `DELETE FROM game_type_tags;` and `DELETE FROM exercise_type_tags;` before the inserts.
  - Lookups are written as `INSERT ... ON CONFLICT (id) DO UPDATE`.
  - Link inserts resolve the type via `(SELECT id FROM game_types WHERE implementation_key = 'CRICKET')` and the context via `(SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP')`.
  - A multi-label Difficulty block writes no DIFFICULTY link row; a single unlabelled one does.
  - Two SKILL rows marked primary in one block throws.
  - An exercise type key with no rules file yields a warning `no tag source: SWITCHING`, not a throw.
  - The SQL contains no `exercise_templates` statement.
  - Output is deterministic: two runs are byte-equal.
- [ ] **Step 5:** Run the generator test. Expect FAIL.
- [ ] **Step 6:** Implement `buildSeedSql` and the CLI. The CLI reads the repo files, writes `database/seeds/0042_catalog_tags.sql` with a "GENERATED — do not edit" header, and prints the warnings. `--check` exits 1 with a diff hint when the file differs. Add an npm script `"tags:generate": "tsx scripts/generate-tag-seed.ts"`.
- [ ] **Step 7:** Run `cd app && npx vitest run tests/scripts/ && npm run tags:generate`. Expect PASS and the seed written. The warnings list only SWITCHING and DOUBLE_PATTERN plus any Task 1 gaps.
- [ ] **Step 8:** Commit `feat(tags): generate catalog tag seed from rules docs` (the seed is committed even though the tables arrive in Task 4, because seeds only run after migrations).

### Task 3: Drift gate

**Files:**

- Create: `scripts/check-tag-seeds.sh`
- Modify: `.github/workflows/quality.yml:54` (run it beside `check-game-rules.sh`)
- Test: `scripts/test-check-tag-seeds.sh`

- [ ] **Step 1:** Write the test script. Copy the seed to a temp file, append a byte, point `TAG_SEED_FILE` at it, and expect exit 1 with `catalog tag seed is stale — run npm run tags:generate`. The untouched seed exits 0.
- [ ] **Step 2:** Run it. Expect FAIL (no gate).
- [ ] **Step 3:** Implement the gate. It runs `bash scripts/check-game-rules.sh` first (the generator trusts only files the rules gate passed), then `cd app && npx tsx scripts/generate-tag-seed.ts --check` (honouring `TAG_SEED_FILE`), and prints warnings without failing on them. In `quality.yml` it runs after `check-game-rules.sh` on the same line.
- [ ] **Step 4:** Run `bash scripts/test-check-tag-seeds.sh && bash scripts/check-tag-seeds.sh`. Expect PASS.
- [ ] **Step 5:** Commit `ci(tags): gate seed drift against rules docs`.

### Task 4: Migration 0047 and DB spec

**Files:**

- Create: `database/migrations/0047_catalog_tags.sql`, `database/seeds/0043_exercise_template_difficulty.sql`, `app/tests/integration/template-difficulty-parity.test.ts`
- Modify: `docs/architecture/05-Database/06-Spec/01-Reference-Layer.md` (new tables), `02-Template-Layer.md` (new column), `05-Read-Model-Layer.md` and `05-Views/00-Overview.md` (new view, changed view), `03-Migrations.md` (row for 0047), `database/README.md` (seed rows, if seeds are registered there)
- Regenerated: `app/src/db/schema.ts` via `npm run db:introspect`

**Interfaces:**

- Produces tables:
  - `tag_axes(id SMALLINT PK, implementation_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at, updated_at)`
  - `tag_contexts(id SMALLINT PK, implementation_key TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at, updated_at)` — `STANDALONE`, `ROUTINE_STEP`
  - `tags(id SMALLINT PK, tag_axis_id SMALLINT NOT NULL FK, implementation_key TEXT NOT NULL, name TEXT NOT NULL, sort_order SMALLINT NOT NULL, UNIQUE(tag_axis_id, implementation_key), created_at, updated_at)`
  - `game_type_tags(game_type_id UUID FK, tag_context_id SMALLINT FK, tag_id SMALLINT FK, is_primary BOOLEAN NOT NULL DEFAULT FALSE, created_at, PK(game_type_id, tag_context_id, tag_id))`, plus partial unique index `uq_game_type_tags_primary (game_type_id, tag_context_id) WHERE is_primary`
  - `exercise_type_tags(exercise_type_id UUID FK, tag_id SMALLINT FK, is_primary BOOLEAN NOT NULL DEFAULT FALSE, created_at, PK(exercise_type_id, tag_id))`, plus partial unique index `uq_exercise_type_tags_primary (exercise_type_id) WHERE is_primary`
  - `exercise_templates.difficulty_tag_id SMALLINT NULL`, `fk_exercise_templates_difficulty_tag` → `tags(id)`
  - Constraint names follow D310 (`fk_`/`uq_`/`chk_`). ON DELETE: `CASCADE` from the type (mirrors `game_type_features`), `RESTRICT` from `tags`.
- Produces views:
  - `v_catalog_tags(entity_kind TEXT 'GAME'|'EXERCISE', type_key TEXT, context_key TEXT, axis_key TEXT, tag_key TEXT, tag_name TEXT, is_primary BOOLEAN, sort_order SMALLINT)`. Exercise rows have `context_key = 'ROUTINE_STEP'`. Keys only, never lookup ids (agent guide rule 5).
  - `v_exercise_template_catalog`: `CREATE OR REPLACE` that appends, in this order, `exercise_type_name TEXT`, `game_type_name TEXT NULL`, `difficulty_level SMALLINT NULL`. `difficulty_level` = the 1–4 rank of `difficulty_tag_id`, else the owning type's single DIFFICULTY tag in context `ROUTINE_STEP`, else NULL. Rank = `row_number()` within the DIFFICULTY axis by `sort_order`. Existing columns are unchanged in name, order and type.
- Seed `0043`: one `UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = '<KEY>') WHERE id = '<template uuid>'` per system template of a type whose `### Routine step` block labels several difficulties. Values come from the labels (`INTERMEDIATE (1 dart)` → the `1 dart` template). This is hand-authored, read alongside the template's own seed, and the parity test is the proof.
- Parity test (integration config, needs `DATABASE_URL`): for each exercise type and routine-step game, the set of DIFFICULTY keys in the docs' `ROUTINE_STEP` block equals the set of `difficulty_level`s across its system templates in `v_exercise_template_catalog` (mapped back to keys). Set equality per type, no label-to-name matching.

- [ ] **Step 1:** Write the migration (with `migrate:down` dropping in reverse, and restoring the old view definition copied from `0040`).
- [ ] **Step 2:** Write seed `0043`.
- [ ] **Step 3:** Write the parity test. Run `cd app && npm run test:integration -- template-difficulty-parity`. Expect FAIL (tables missing).
- [ ] **Step 4:** Run `cd app && npm run db:status && npm run db:migrate && npm run db:seed && npm run db:drift && npm run db:introspect`. Expect 0047 applied, seeds 0042 and 0043 applied twice with no error, and no drift.
- [ ] **Step 5:** Run the parity test again. Expect PASS. Then flip one `0043` value, re-seed, and confirm it fails (Review Focus 6); restore it.
- [ ] **Step 6:** Smoke-check with `psql` or `npm run db:verify`. `SELECT count(*) FROM v_catalog_tags WHERE type_key='CRICKET'` is greater than 0. `SELECT difficulty_level FROM v_exercise_template_catalog` is non-null for every templated type except SWITCHING and DOUBLE_PATTERN.
- [ ] **Step 7:** Update the DB docs listed above with targeted edits.
- [ ] **Step 8:** Commit `feat(db): catalog tag tables, template difficulty and views (0047)`.

> If `DATABASE_URL` is absent, stop and report. Do not claim the migration was validated.

### Task 5: Read path (repository, service, API, client)

**Files:**

- Create: `app/src/repositories/catalog.repository.ts`, `app/src/services/catalog.service.ts`, `app/src/pages/api/catalog-tags/index.ts`, `app/src/pages/api/catalog-tags/types.ts`, `app/src/lib/client/api/catalog.ts`, `app/src/lib/catalog/tags.ts`
- Modify: `app/src/repositories/routine.repository.ts:91-118` (select `exerciseTypeName`, `gameTypeName`, `difficultyLevel`), `app/src/pages/api/exercise-templates/types.ts` (add `exerciseTypeName: z.string()`, `gameTypeName: z.string().nullable()`, `difficultyLevel: z.number().int().min(1).max(4).nullable()`), `docs/architecture/06-API/04-Endpoint-Contracts.md`
- Test: `app/tests/services/catalog.service.test.ts`, `app/tests/lib/catalog/tags.test.ts`, and extend the existing routine service/repository tests for `difficultyLevel`

**Interfaces:**

- Produces:

  ```ts
  // app/src/lib/catalog/tags.ts
  type CatalogTag = { axis: AxisKey; key: string; name: string; primary: boolean };
  type AxisKey = "SKILL"|"SESSION_ROLE"|"FORMAT"|"DIFFICULTY"|"MECHANIC"|"PRESSURE"|"FAMILY";
  type CatalogTagSet = { tags: CatalogTag[]; difficultyLevel: 1|2|3|4|null };
  type CatalogTagsResponse = { games: Record<string, { standalone: CatalogTagSet; routineStep: CatalogTagSet }>; exercises: Record<string, CatalogTagSet> };
  cardTags(set: CatalogTagSet, kind: "game"|"exercise"): CatalogTag[]
  ```

  - `cardTags` order. Game: SKILL primary, every FORMAT, PRESSURE except NONE, FAMILY. Exercise: SKILL primary, SKILL secondaries, PRESSURE except NONE, every SESSION_ROLE. Within an axis, order follows `sort_order`.
  - `GET /api/catalog-tags` returns `ok(CatalogTagsResponse)` in the standard envelope.
  - `fetchCatalogTags(): Promise<CatalogTagsResponse>` is in `@client/api/catalog`.

- [ ] **Step 1:** Write the `cardTags` tests:
  - A game with PRESSURE NONE has no pressure pill.
  - Primary skill comes first even when listed later.
  - A game hides secondary skills.
  - An exercise shows SESSION_ROLE last.
  - An empty set returns `[]`.
- [ ] **Step 2:** Write the service test (mock repository, per the existing service test pattern). Rows grouped into `games.CRICKET.standalone` and `exercises.DOUBLES_LOCK`. `difficultyLevel` is derived from the DIFFICULTY tag's rank.
- [ ] **Step 3:** Run them. Expect FAIL.
- [ ] **Step 4:** Implement the repository (select from `vCatalogTags`, ordered by `type_key, sort_order`), the service, the route (mirror `api/exercise-templates/index.ts`), the client function (mirror `@client/api/routines.ts`), and `cardTags`.
- [ ] **Step 5:** Add `exerciseTypeName`, `gameTypeName` and `difficultyLevel` through the template catalog path and its tests.
- [ ] **Step 6:** Run `cd app && npm test`. Expect PASS.
- [ ] **Step 7:** Update the endpoint contracts doc. Commit `feat(api): catalog tags endpoint and template difficulty`.

### Task 6: UI primitives and throw factory

**Files:**

- Modify: `app/src/styles/global.css`. Add tokens `--tag-skill-h: 285; --tag-format-h: 310; --tag-pressure-h: 260; --tag-family-h: 237;`, `--meter-1..4` colours and `--meter-off`. Add classes `tag`, `tag-skill`, `tag-skill-primary`, `tag-format`, `tag-pressure`, `tag-family`, `tag-role`, `tag-mechanic`, `tag-over-art` (the `bg oklch(0% 0 0/.5)` + `blur(8px)` modifier), `meter`, `meter-bar`, `catalog-card`, `catalog-well`, `card-dart`, `card-dart-hover`, `card-dart-wind`, `card-dart-throw`, `card-dart-reset`. `card-dart-hover` is applied only inside `@media (hover: hover)`. A `prefers-reduced-motion` block disables every `card-dart` transition.
- Create: `app/src/components/ui/Tag.astro`, `DifficultyMeter.astro`, `DifficultyLegend.astro`, `CatalogCard.astro`, `app/src/icons/dart-accent.svg`, `app/src/lib/ui/card-throw.data.ts`, `app/src/lib/ui/motion.ts`
- Modify: `app/src/lib/ui/score-tween.data.ts:22`, `app/src/lib/ui/seat-morph.data.ts:64`, `app/src/lib/ui/chart-theme.ts:78` — replace each inline `matchMedia` with `prefersReducedMotion()`. Behaviour unchanged; their existing tests must stay green without edits.
- Test: `app/tests/lib/ui/card-throw.data.test.ts`, `app/tests/lib/ui/motion.test.ts`, `app/tests/components/ui/catalog-primitives.test.ts` (static-source, per `board-input-panel-containing-block.test.ts`)

**Interfaces:**

- `Tag.astro` props: `{ axis?: AxisKey; primary?: boolean; overArt?: boolean; nameExpr?: string; axisExpr?: string; primaryExpr?: string }`. It renders static text from the slot, or `x-text`/`:class` from the expressions.
- `motion.ts`: `export function prefersReducedMotion(): boolean` — `globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false`.
- `DifficultyMeter.astro` props: `{ level?: 1|2|3|4; levelExpr?: string }`. Root `<span role="img" aria-label="Difficulty: <Name>" title="Difficulty: <Name>">` where Name is Beginner/Intermediate/Advanced/Expert (bound via `:aria-label`/`:title` when `levelExpr` is used). Four `meter-bar` spans with `aria-hidden="true"`. A lit bar gets `style="background: var(--meter-N)"`. It renders nothing when the level is null.
- `DifficultyLegend.astro`: no props. Four meters with the labels BEGINNER, INTERMEDIATE, ADVANCED, EXPERT.
- `CatalogCard.astro` props: `{ variant: "game"|"exercise"; href?: string }`. Slots: `title`, `meter`, `caption`, `tags`, default (body). The `game` variant renders `<a href>` with `x-data="cardThrow()"`, the dart `<img>` and event bindings. The `exercise` variant renders a `<div>`.
- `cardThrow()` factory:

  ```ts
  export function cardThrow(deps?: {
    navigate?: (href: string) => void;
    reducedMotion?: () => boolean;
    schedule?: (fn: () => void, ms: number) => void;
  }): {
    phase: "rest" | "hover" | "wind" | "throw" | "reset";
    enter(): void;
    leave(): void;
    activate(event: Event, href: string): void;
    dartClass(): string;
  };
  ```

  - `activate` calls `preventDefault`, then sets `wind`, then at 170ms sets `throw`, then at 550ms calls `navigate(href)` and sets `reset`.
  - If the phase is already `wind` or `throw`, the call is a no-op.
  - With reduced motion it calls `navigate` at once.
  - `dartClass()` maps the phase to the CSS class.
  - It is registered wherever the other `*.data.ts` factories are registered with Alpine.

- [ ] **Step 1:** Write the `cardThrow` tests with fake timers:
  - `activate → wind; at 170 → throw; at 550 navigate called once with href`
  - `ignores second tap`: two activates give one navigate
  - `reduced motion navigates immediately`
  - `enter/leave toggles hover only when rest`
  - `motion.test.ts`: `prefersReducedMotion()` returns false with no `matchMedia`, and mirrors `matches` when present.
- [ ] **Step 2:** Write the static-source tests:
  - `Tag.astro` uses the `tag` class with no inline colour literals.
  - `DifficultyMeter.astro` emits exactly 4 `meter-bar`, and its root has `role="img"`, `aria-label` and `title`.
  - `global.css` contains the `prefers-reduced-motion` rule covering `.card-dart`, and `.card-dart-hover` sits inside `@media (hover: hover)`.
  - `CatalogCard.astro`'s game variant is an `<a`.
  - No file under `app/src/lib/ui/` other than `motion.ts` contains `prefers-reduced-motion`.
- [ ] **Step 3:** Run them. Expect FAIL.
- [ ] **Step 4:** Implement `motion.ts`, repoint the three callers, then the CSS, components and factory. Fetch `app/src/icons/nav/dart-accent.svg` from the design project (`DesignSync get_file`, project `cdea52ee-4746-4efb-b646-81448a40c033`) and save it as `app/src/icons/dart-accent.svg`, stripping the C2PA `<metadata>`.
- [ ] **Step 5:** Run `cd app && npm test && npm run check && bash ../scripts/check-style-tokens.sh && bash ../scripts/check-astro-conventions.sh`. Expect PASS.
- [ ] **Step 6:** Commit in two: `refactor(ui): shared prefersReducedMotion helper`, then `feat(ui): tag, difficulty meter and catalog card primitives`.

### Task 7: Games screen cards

**Files:**

- Modify: `app/src/lib/game/rulesets/types.ts:775` (add `gameTypeKey: string` to `GameCardDescriptor`), `app/src/lib/game/rulesets/games-visibility.ts` (fill `gameTypeKey` for all 12, using the keys from Task 1), `app/src/lib/game/games-index.data.ts`, `app/src/pages/games/index.astro`
- Test: `app/tests/lib/game/games-index.data.test.ts`

**Interfaces:**

- Consumes: `fetchCatalogTags`, `cardTags`, `CatalogCard`, `Tag`, `DifficultyMeter`, `DifficultyLegend`.
- Produces on `gamesIndex()`:
  - `catalogTags: CatalogTagsResponse | null`
  - `gameTags(gameTypeKey: string): CatalogTag[]`, using the `standalone` set
  - `gameLevel(gameTypeKey: string): 1|2|3|4|null`

- [ ] **Step 1:** Write the tests:
  - After `init`, `gameTags("CRICKET")` returns the `cardTags` order.
  - When `fetchCatalogTags` rejects, `gameTags` returns `[]`, `gameLevel` returns `null`, and `loading()` still settles to false (Review Focus 4).
  - Tags load in parallel with sessions and do not gate `loading()` longer than sessions plus settings.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement the data changes. In `index.astro`:
  - Swap the `glass` group container and `GameRow` for a `grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3` of `CatalogCard variant="game"`.
  - Keep the `section-eyebrow` headings, `groupVisible`/`isVisible` and the empty-state alert.
  - Put `DifficultyLegend` above the first group.
  - Drop the `isFirstVisible` divider logic only if nothing else uses it; otherwise leave it.
  - Keep `GameRow.astro` if anything else imports it. If not, delete it and its tests.
- [ ] **Step 4:** Run `cd app && npm test && npm run check`. Expect PASS.
- [ ] **Step 5:** Manual check via the `run` skill. On the Games page: hover slides the dart, a tap throws then navigates, and with OS reduced motion on the tap navigates at once.
- [ ] **Step 6:** Commit `feat(games): tagged catalog cards with dart throw`.

### Task 8: Exercise picker cards

**Files:**

- Create: `app/src/lib/training/routines/catalog-groups.ts`
- Modify: `app/src/lib/training/routines/routine-builder.data.ts:89,111` (fetch tags, expose `groups`), `app/src/components/layout/training/routines/ExercisePicker.astro`
- Test: `app/tests/lib/training/routines/catalog-groups.test.ts`, the existing routine-builder data test

**Interfaces:**

- Produces:
  ```ts
  type CatalogGroup = { key: string; name: string; blurb: string|null; tags: CatalogTag[]; entries: (ExerciseTemplateCatalogEntryData & { level: 1|2|3|4|null; label: string })[] };
  groupCatalog(entries: ExerciseTemplateCatalogEntryData[], tags: CatalogTagsResponse | null): CatalogGroup[]
  ```

  - The group key is `exerciseTypeKey`, or `gameTypeKey` when `exerciseTypeKey === "GAME"`.
  - `name` is `entry.gameTypeName ?? entry.exerciseTypeName`. `blurb` is the first entry's `description`.
  - Tags come from `exercises[key]`, or `games[key].routineStep`, run through `cardTags(..., "exercise")`.
  - `label` is `entry.name` as-is (the template name). No splitting.
  - `level` = `entry.difficultyLevel`.
  - Group order is first-seen in the catalog (already sorted by name).
- `routineBuilder()` gains `groups(): CatalogGroup[]`. `addStep(entry)` is unchanged.

- [ ] **Step 1:** Write the tests:
  - Two templates sharing `gameTypeKey: "AROUND_THE_CLOCK"` collapse into one group named from `gameTypeName`, with two entries whose labels are the template names unchanged.
  - A GAME entry groups by `gameTypeKey`.
  - The `untagged` case (Review Focus 5): a `SWITCHING` entry with no tag set gives `tags: []` and `level: null`.
  - `tags === null` (fetch failed) still groups.
- [ ] **Step 2:** Run them. Expect FAIL.
- [ ] **Step 3:** Implement `groupCatalog` and the builder wiring (tag fetch alongside `listExerciseTemplates`; a failure gives `null`).
- [ ] **Step 4:** Rewrite `ExercisePicker.astro`:
  - `x-for="group in groups()"`, rendering `CatalogCard variant="exercise"`, with the name, blurb and tags (`Tag` via expressions).
  - A `catalog-well` holding one row per entry: `DifficultyMeter levelExpr`, label, the level name, and a 36px `glass-button` `+` with `:aria-label="\`Add ${entry.label}\`"`, `@click="addStep(entry)"`and`:disabled="steps.length >= maxSteps"`.
  - `DifficultyLegend` above the list.
  - Keep the header count, which now counts groups (`types`).
  - Update the file's doc comment.
- [ ] **Step 5:** Run `cd app && npm test && npm run check`. Expect PASS. Manual check in the routine builder: + adds the step, and nothing else happens.
- [ ] **Step 6:** Commit `feat(routines): tagged exercise cards in picker`.

### Task 9: Decision, context upkeep, gates, PR

**Files:**

- Modify: `decisions/context-system.md` (new D-id via `scripts/next-decision-id.sh`: DB tags, generator bridge, drift gate, per-template difficulty in seed + parity test, `Supersedes: D461` in part; its Consequences name the next step — a `v_game_catalog` view that replaces `GAME_CARDS` except `href`, so that `is_published = false` rows can drive coming-soon cards and filters read the same source as the card list), `docs/game-rules/TAGS.md` (one line: the DB is now generated from this file; see the decision), `docs/architecture/00-Context-Map.md` / `00-File-Inventory.md` (new files), the CLAUDE.md files touched by the context-maintenance skill

- [ ] **Step 1:** File the discovered-work issue "Author rules files for SWITCHING and DOUBLE_PATTERN exercises" (plus any Task 1 gaps) per `capturing-discovered-work`.
- [ ] **Step 2:** Write the decision and doc edits.
- [ ] **Step 3:** Run the `context-maintenance` skill, then `run-all-gates`, then `validate-app`. Expect every listed script to PASS, reported per script.
- [ ] **Step 4:** Commit `docs(decisions): DB-backed catalog tags`.
- [ ] **Step 5:** Run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).
