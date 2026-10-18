# Catalog cards and tags — design

Date: 2026-10-18 · Branch: `feat/tag-cards`
Source design: claude.ai/design project `cdea52ee-…`, files `Cards.dc.html` (§01 Game cards, §02 Exercise cards) and `Tags, Labels and Filters.dc.html` (§01 Vocabulary, §02 In use).

## Intent

Games and exercises get one reusable card that shows their tags at a glance: name, difficulty meter, caption, and tag pills. Today tags live only in `docs/game-rules/**` `## Tags` tables, and nothing reads them (D461). This work makes tags real data the app reads, so that later filters, search and derived routine profiles build on the same source. The cards are the first consumer.

## Goals

1. Tags stored in the DB as lookup + link tables, generated from the rules docs, read through a `v_*` view and one API endpoint.
2. Reusable UI pieces: `Tag` pill (one variant per axis), `DifficultyMeter`, difficulty legend, and a `CatalogCard` shell.
3. Games screen: each game becomes a `CatalogCard` with the dart hover/throw animation, inside the existing MATCH PLAY / TRAINING / CLASSICS headings.
4. Routine builder "Add an exercise" list: one exercise card per exercise, holding one row per config (template) with its own difficulty and + button.

## Non-goals

- Filters, filter sheet, search (the design's §03 Filter). Deferred.
- Coming-soon cards, and DB rows for games/exercises that are not playable. Only what is playable now.
- The in-progress card (`Cards.dc.html` §03). It already exists as `ResumeSessionDeck`.
- The rules-sheet "detail · all axes" view.
- Tags on routines and trivia. Template-level tag overrides.
- Any change to what tapping + does beyond adding the step.

## Anti-goals

- Tags drifting between the docs and the DB. One source, mechanically checked.
- A generic EAV or polymorphic tag table (forbidden by CLAUDE.md).
- Tag strings hard-coded in TS components. The UI renders what the view returns.
- Animation that blocks or ignores `prefers-reduced-motion`.

## Decided by the user

- The DB is the runtime home for tags (the scalable option was asked for and accepted).
- Scope: only playable games and available exercises.
- The Games screen keeps the MATCH PLAY / TRAINING / CLASSICS headings, with cards inside each.
- Tapping + on an exercise config only adds the step. No extra feedback.
- Picker entries with no tag source fall back to the Standalone tags minus Family. Types with no rules file show no tags and get an issue filed.

## Architecture

### Source of truth

The `## Tags` tables in `docs/game-rules/rulesets/*.md` and `docs/game-rules/training/exercises/*.md` stay the only place tags are authored. The vocabulary stays in `docs/game-rules/TAGS.md`. *(Agent's call.)*

### Schema (new migration `0047`)

`game_types` and `exercise_types` are UUID domain entities. Tag vocabulary is a seeded lookup.

- `tag_axes (id SMALLINT PK, implementation_key TEXT UNIQUE, name, cardinality)`: SKILL, SESSION_ROLE, FORMAT, DIFFICULTY, MECHANIC, PRESSURE, FAMILY.
- `tags (id SMALLINT PK, tag_axis_id SMALLINT FK, implementation_key TEXT, name, sort_order SMALLINT, UNIQUE (tag_axis_id, implementation_key))`. One row per value in TAGS.md. `sort_order` follows TAGS.md row order, and difficulty order drives the meter level (1–4).
- `game_type_tags (game_type_id UUID FK, tag_id SMALLINT FK, is_primary BOOLEAN, PK (game_type_id, tag_id))`.
- `exercise_type_tags (exercise_type_id UUID FK, tag_id SMALLINT FK, is_primary BOOLEAN, PK (exercise_type_id, tag_id))`.
- Partial unique index on each link table: at most one `is_primary` row per type.

*(Agent's call: two typed link tables rather than columns per axis, or one table per axis per entity. Difficulty and Family stay in the link table rather than as columns, so one read path serves every axis. "Exactly one" for Difficulty and Family is enforced by the generator and gate, not the DB.)* The builder may instead promote Difficulty and Family to FK columns if that reads cleaner in the view. Either is acceptable.

### Per-config difficulty

Exercise cards show a difficulty per config row. Configs are `exercise_templates` rows. Add `exercise_templates.difficulty_tag_id SMALLINT NULL` (FK to `tags`, DIFFICULTY axis). When it is null, the view falls back to the type's Difficulty. The values come from the `### Routine step` Difficulty labels in TAGS.md form (`INTERMEDIATE (1 dart)`). *(Agent's call.)*

### Games used as routine steps

Rulesets whose `Entry points:` include `routine step` have a `### Routine step` tag block. The exercise picker lists games as well as exercise types. Its cards use the Routine-step block, and the Games screen uses `### Standalone`. The builder decides how a routine-step game's tags are stored. One option is a `context` column (`STANDALONE` | `ROUTINE_STEP`) on `game_type_tags`, added to the PK.

### Missing tag sources (user decision)

Some picker entries have no tag source:

- **A routine-step game whose ruleset has no `### Routine step` block** (e.g. `Singles Accuracy` from `singles-training.md`, likely `Finishing`): use that ruleset's Standalone block without its Family row.
- **An exercise type with no rules file at all** (`SWITCHING`, `DOUBLE_PATTERN`): the card renders with no tags and no meter. The generator and gate *warn* about these and do not fail. File one `discovered-work` issue to author their rules files.

### Matching template labels (agent's call)

A Routine-step Difficulty label such as `INTERMEDIATE (1 dart)` maps to the system template whose name ends with the bracketed text exactly (`Around the Clock — 1 dart`). The gate fails unless each label matches exactly one system template, and fails if a system template under a labelled block has no label. No change to the TAGS.md label format.

### Generator and drift gate

- `scripts/generate-tag-seeds.*` parses TAGS.md plus every rules file's `## Tags` table and writes the seed SQL for `tags`, `tag_axes`, the link tables and template difficulties.
- A gate (extend `scripts/check-game-rules.sh`, or a new `scripts/check-tag-seeds.sh` wired into `pr-gates.yml`) fails when the committed seed differs from a fresh generation.
- Only types with a `game_types` / `exercise_types` row get link rows. Rules files for unbuilt games are skipped, not errors.
- **Mapping rules file to type row.** Rules files have no implementation key today. The builder adds an explicit mapping. Two options: a header line such as `Implementation key: CRICKET` in each playable rules file, validated by `check-game-rules.sh`, or a small manifest. Inferring from the filename is not acceptable.

### Read path

- View `v_catalog_tags`: one row per (entity kind, entity id, axis key, tag key, tag name, is_primary, sort order, difficulty level). Templates get a companion `v_exercise_template_difficulty`, or the column is folded into the existing template read. The builder chooses.
- API: `GET /api/catalog-tags` returns tags grouped per game type and exercise type. The existing `GET /api/exercise-templates` gains each template's resolved difficulty. Endpoints read views only (CLAUDE.md: no raw tables).
- The Games page is prerendered. Tags are fetched at runtime by the `gamesIndex()` Alpine factory, alongside the active-sessions fetch, under the existing `loading()` skeleton. *(Agent's call. The alternative is a build-time fetch, but build has no DB guarantee.)*

### Decision record

D461 deferred DB tags. Add a new decision in `decisions/context-system.md` citing `Supersedes: D461` (in part), recording the tables, the generator as the bridge, and the drift gate.

## UI

### Tokens and pills (from the design, Vocabulary §01)

All pills: `padding 3px 9px; radius 9999px; font 600 11px Montserrat`. On game cards they also get `background oklch(0% 0 0 / .5)` and `backdrop-filter: blur(8px)`, because they sit over the dart.

| Axis | Treatment |
| --- | --- |
| Skill primary | fill `oklch(65% .14 285 / .2)`, border `oklch(72% .14 285 / .6)`, text `oklch(87% .1 285)` |
| Skill secondary | outline, same border, text `oklch(82% .12 285)` |
| Format | outline hue 310 |
| Pressure | outline hue 260. Hidden when NONE |
| Family | outline hue 237 |
| Session role | `600 10px JetBrains Mono`, `.08em` letter-spacing, text `oklch(88% 0 0)`, bg `oklch(100% 0 0 / .08)`, border `oklch(88% 0 0)` |
| Mechanic | grey outline (not shown on cards in this cut) |

**Difficulty meter:** four bars, `4px` wide, heights `5/8/11/14px`, `2px` gap. Lit bars take the level colour `oklch(74% .16 H)`, where H = 150, 95, 60 or 28 for levels 1–4. Off bars are `oklch(100% 0 0 / .15)`. No label on cards.

**Legend:** shown once per screen. Four meters, each with its level name in `600 11px JetBrains Mono`.

Colours go in as CSS custom properties in `global.css` (per-axis tokens), not inline styles. *(Agent's call, matching the repo's utility-class idiom.)*

### Components (`app/src/components/ui/`)

- `Tag.astro`: `axis` and `primary?` props. Alpine-expression variants for `x-for` lists.
- `DifficultyMeter.astro`: `level` (1–4), static or as an Alpine expression.
- `DifficultyLegend.astro`.
- `CatalogCard.astro`: slots for title, meter, caption, tags and body. Variants `game` (link, dart decoration) and `exercise` (static, config well).

Follow `app/src/components/CLAUDE.md`.

### Game card

- **Shell:** `radius 20px; padding 16px; gap 12px`. Background `radial-gradient(at 50% 0%, oklch(100% 0 0 / .05), oklch(100% 0 0 / .1) 85%), #000`, with a 1px border at `oklch(100% 0 0 / .08)`. `overflow: hidden`.
- **Content:** name (`400 15px Michroma`) with the meter on the right. Caption (`400 12px Montserrat`, grey 60%). Tag row at the bottom (`margin-top: auto`), in this order: Skill primary, each Format, Pressure (if not NONE), Family.
- **Layout:** in a grid `repeat(auto-fill, minmax(320px, 1fr))`, gap 12px, under each existing group heading. Legend above the first group. The capture-mode visibility (`visibleGames`) and `loading()` behaviour are unchanged.
- **Dart decoration:** a dart image, `96×96`, placed at `right -22px; bottom -26px`, rotated `-45deg`, opacity `.45`, behind the tags. The design uses `dart-accent.svg`, which is missing from the repo. Add it from the design project, or tint `@icons/dart.svg` with the accent colour.
- **Hover** (pointer devices only, `@media (hover: hover)`): the dart moves to `translate(-38px,-36px)`, opacity `.95`, above the tags, using `transform .35s cubic-bezier(.2,.9,.3,1.2), opacity .25s`.
- **Tap / Enter:**
  - **Wind:** `translate(-52px,-36px)` over `.16s ease-out`.
  - **Throw:** at 170ms, move to `translate(420px,-36px)` over `.38s cubic-bezier(.55,0,.85,.4)`.
  - **Navigate:** once the throw ends, about 550ms after the tap.
  - A second tap during the throw is ignored.
- **Reduced motion:** no dart movement, and the tap navigates at once.
- Implement as CSS classes plus a small Alpine factory in `app/src/lib/ui/` (for example `card-throw.data.ts`) that sequences the phases and owns the reduced-motion check. That logic is unit-tested.
- **Accessibility:** the card is a real link (`<a href>`), keyboard-activatable, with the throw also running on Enter. With JS off it is a plain link.

### Exercise card (replaces rows in `ExercisePicker.astro`)

- **Shell:** the same shell, with no dart and no hover motion.
- **Content:** name. Blurb (from the exercise type's description). Tags in this order: Skill primary, Skill secondaries, Pressure (if not NONE), Session role(s).
- **Config well:** `radius 14px; padding 0 6px 0 12px; bg oklch(0% 0 0 / .35); inset shadow 0 1px 2px oklch(0% 0 0 / .4)`. One row per template:
  - min-height 48px
  - a 1px divider at `oklch(100% 0 0 / .08)` between rows
  - the meter
  - the label (`600 13px Montserrat`, the template name)
  - the level name (`500 10px JetBrains Mono`)
  - a round 36px `glass-button` with a plus icon and `aria-label="Add {label}"`
- A + tap calls the picker's existing add action. Nothing else changes.
- **Grouping:** today the catalog is a flat template list. Group it by exercise type, or by game type for routine-step games, in the picker's data factory.
- **Grid:** `repeat(auto-fill, minmax(320px, 1fr))`, `align-items: start`. Inside the routine builder's narrow column this collapses to one column. Legend above the list.

## Constraints

- Hard invariants in `CLAUDE.md`: a new migration (never edit `0001`–`0046`), seeded SMALLINT lookups, reads via views, no raw tables in the API, minimal diffs.
- TDD per `app/CLAUDE.md`: data factories, generator and parser get unit tests, and components get the repo's static-source tests where it already does that.
- Context maintenance: context map registration, decision, File Inventory, CLAUDE.md files.
- Every applied migration needs human review before merge. The schema here is a proposal.

## Left to the builder

- Exact SQL names, the view shape, and whether Difficulty and Family become columns.
- The storage shape for routine-step game tags.
- The generator's language (shell + awk to match `check-game-rules.sh`, or a TS script under `scripts/`).
- The rules-file-to-type mapping mechanism (explicit only).
- How the throw factory and CSS split the work.
- Whether `GameRow.astro` is deleted or kept for other uses.

## Open items to verify while planning

- Which `exercise_types`, `game_types` and system templates exist in seeds today. That is the real "playable" set. The design lists 11 games, but `GAME_CARDS` has 12 (it includes Baseball Darts). Use `GAME_CARDS`.
- Whether every playable item's rules file already has a complete `## Tags` table.
