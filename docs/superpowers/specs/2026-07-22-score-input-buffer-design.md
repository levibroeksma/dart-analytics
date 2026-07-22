# ScoreInput Buffer + Activation Guard — Design

> **Date:** 2026-07-22
> **Status:** approved (brainstorming consensus)
> **Scope:** Extract reusable `ScoreInputBuffer` module (digit buffer + multi-click guard); refactor `ScoreInput.astro` to explicit prop wiring; migrate Score Training play onto the module.
> **Out of scope:** Portable UI kit promotion (`components/ui`); Clear keypad button; score-range validation in the module; shared `ActivationGuard` util extracted beyond the module; other game types beyond Score Training wiring in this change.

---

## Context

Rapid same-digit entry on the Score Training keypad (e.g. `22`, `55`) sometimes yields three digits (`222`, `555`). Submit then fails with `Enter a score between 0 and 180`.

**Root cause:** not `appendDigit` string logic. Two intended presses can produce **three** browser `click` events (multi-click / ghost activation). The keypad is a raw 1:1 `click` → digit map with no activation guard.

Ruled out: duplicate handlers in HTML, double `ScoreInput` / double `Alpine.start()`, concatenation producing three chars from two calls.

Today `visitInput` / `appendDigit` / `deleteLast` / `clearVisitInput` live in `score-training-play.data.ts`, and `ScoreInput.astro` hardcodes those names — not reusable by other game types.

Decisions locked in brainstorming:

| Topic | Choice |
| ----- | ------ |
| Reuse target | Reusable score keypad, wireable per game type |
| Keypad surface | Digits + delete + submit core; undo optional / game-specific |
| Binding | Explicit Alpine expression props (no fixed method names) |
| Behavior ownership | `ScoreInputBuffer` module instance per play factory |
| Activation guard | Ghost-window coalesce (~40ms) **and** ignore `event.detail > 2` (not `> 1`) |
| Limits | Module enforces `maxLength` only; game validates range on submit |
| `clear()` | Programmatic only — no Clear button; delete is the user path back to empty/`0` |

Authority: `07-Frontend/04-Modules-And-OOP.md`, `03-Alpine-Patterns.md`, `05-Astro-Components.md`, `app/CLAUDE.md` (TDD).

---

## Problem / UX contract

| Intent | Required result |
| ------ | --------------- |
| Two intentional presses of the same digit (e.g. `2` then `2`) | Buffer becomes `"22"` |
| Ghost / multi-click third activation on the same key | Third digit **not** appended |
| Mixed digits (e.g. `25`) | Unaffected |
| Guard rejects | Silent — no error toast |
| Max-length reject | Silent (same as today) |
| Out-of-range submit | Game factory error (unchanged for Score Training) |

**Why not `detail > 1`:** a fast intentional double-press often arrives as `detail: 1` then `detail: 2`. Ignoring `detail > 1` would block legitimate `22` / `33`.

---

## Scope

In scope:

- `app/src/modules/game/score-input.module.ts` — `ScoreInputBuffer` class
- Unit tests under `app/tests/modules/game/`
- Refactor `ScoreInput.astro` to prop-wired shell (value, digit handler, delete, submit, optional undo)
- Migrate `scoreTrainingPlay` + `ScoreTraining.astro` + types onto the module
- Retarget play-factory keypad tests; keep submit/undo/finish coverage

Out of scope:

- Moving `ScoreInput` into portable `components/ui/`
- Extracting a standalone `ActivationGuard` shared util (YAGNI until a second consumer)
- Clear / reset keypad button
- Encoding 0–180 (or other ceilings) inside the module
- Wiring additional game types in this change (API must enable them)

---

## Design

### Architecture

```
Game Alpine factory (e.g. scoreTrainingPlay)
  └─ this.scoreInput = new ScoreInputBuffer({ maxLength: 3 })
       owns: value, append/delete/clear/setValue, activation guard

ScoreInput.astro (dumb shell)
  props: value, digitHandler, onDelete, onSubmit, submitDisabled?, undo*?
  binds keypad → parent expressions; passes $event into digit/delete

Game rules (submitVisit, undoVisit, finish flows)
  read scoreInput.value / asNumber()
  validate range (0–180 for Score Training)
  scoreInput.clear() after successful commit / undo discard
  scoreInput.setValue(...) when restoring typed input (finish cancel)
```

| Piece | Path | Role |
| ----- | ---- | ---- |
| `ScoreInputBuffer` | `modules/game/score-input.module.ts` | Alpine-free buffer + guard |
| `ScoreInput.astro` | `components/layout/games/` | Game chrome keypad shell (not portable UI kit) |
| Play factory | `lib/game/score-training-play.data.ts` | Composes module; owns submit/undo/finish |

### `ScoreInputBuffer` API

| API | Behavior |
| --- | -------- |
| `constructor({ maxLength?: number })` | Default `maxLength: 3` |
| `value: string` | Current digits; `""` when empty (display shows `0` via template) |
| `appendDigit(digit: number, event?: { detail?: number })` | Guard → append; replace lone `"0"`; no-op if next length `> maxLength` |
| `deleteLast(event?: { detail?: number })` | Guard → drop last character |
| `clear()` | Reset to `""` — programmatic only; **no** activation guard |
| `setValue(next: string)` | Programmatic restore/replace (finish-cancel); no guard; caller ensures digits/length |
| `asNumber()` | `value === "" ? null : Number(value)` |

Private guard used by `appendDigit` / `deleteLast` only:

1. If `event?.detail != null && event.detail > 2` → reject  
2. If `now - lastAcceptedAt < GHOST_MS` → reject (`GHOST_MS` starts at **40**; tunable constant)  
3. Else accept and stamp `lastAcceptedAt = now`

Implementation note: confirm repro with call-count + `$event.detail` (+ timestamps) before locking `GHOST_MS`; adjust only if tests/manual repro show intentional doubles still clipped or ghosts still accepted.

### `ScoreInput.astro` props

| Prop | Role |
| ---- | ---- |
| `value` | Alpine expression for display string (e.g. `scoreInput.value`) |
| `digitHandler` | Method path; component emits `digitHandler(n, $event)` per key (e.g. `scoreInput.appendDigit`) |
| `onDelete` | Full expression including `$event` (e.g. `scoreInput.deleteLast($event)`) |
| `onSubmit` | Submit expression (e.g. `submitVisit()`) — replaces today’s `click` prop |
| `submitDisabled` | Optional disabled expression for submit button |
| `undoClick` / `undoDisabled` | Optional; when omitted, bottom-left cell stays a non-action layout placeholder (or empty) so the 0 / delete row geometry holds |

No Clear control. Delete is the only user path to empty the buffer. Undo is optional chrome, not part of the buffer module.

Display (unchanged semantics): `x-text` shows `value || '0'` with muted style when empty.

### Score Training migration

- Construct `this.scoreInput = new ScoreInputBuffer({ maxLength: 3 })` on the play factory object (field init is fine; no Alpine in the module).
- Remove `visitInput`, `appendDigit`, `deleteLast`, `clearVisitInput` from the play factory / types.
- `submitVisit` / `undoVisit` / finish / play-again paths use `scoreInput.value`, `scoreInput.clear()`, `scoreInput.setValue(...)` as appropriate.
- Parent still gates interactions when `showFinishConfirm \|\| finished` (disable bindings and/or early-return in submit/undo — buffer itself does not know finish state).
- `ScoreTraining.astro` wires explicit props instead of `<ScoreInput click="submitVisit()" />`.

### Error handling

| Case | Behavior |
| ---- | -------- |
| Guard reject | Silent no-op |
| Max-length reject | Silent no-op |
| Invalid / out-of-range submit | Existing factory error string; do not clear buffer |
| Network / session errors | Unchanged |

### Testing

TDD mandatory (`app/CLAUDE.md`):

1. Buffer: append, replace lone `0`, maxLength, delete, clear, setValue, asNumber  
2. Guard: `detail > 2` rejected; two accepts spaced `> GHOST_MS` → `"22"`; second within window dropped  
3. Play factory: retarget keypad tests to `scoreInput`; keep submit/undo/finish-cancel restore coverage  

No Vitest for `.astro` markup (D101).

### Docs / context (implementation phase)

- One-line `DECISIONS.md` entry for the module + guard contract  
- Handbook touch only if agents need a new standing rule (prefer minimal)  
- Context Maintenance checkers + graph refresh when implementation lands  

---

## Success criteria

- Rapid same-digit entry yields two digits, not three  
- Intentional `22` / `33` / `55` still work  
- Score Training play behavior otherwise unchanged  
- A future game type can `new ScoreInputBuffer({ maxLength })` and wire `ScoreInput.astro` props without copying append/guard logic  

---

## Open implementation notes (not open design)

- Exact Astro attribute form for `digitHandler` (`@click` vs `x-on:click` inside `{}`) follows existing Alpine/Astro lint escape rules  
- Whether bottom-left without undo is an empty `InputButton` (disabled) or a blank cell — pick the option that preserves grid geometry with minimal markup  
- Tune `GHOST_MS` only with failing/passing guard tests + manual repro evidence
