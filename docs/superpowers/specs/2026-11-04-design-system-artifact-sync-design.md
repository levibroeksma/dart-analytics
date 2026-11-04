# Design System Sync on the Claude artifact — Design

Status: draft, 2026-11-04. Supersedes the Claude Design parts of
`2026-10-26-design-system-sync-design.md` (D499); everything not named here
(areas, lock semantics, "nothing applies silently", apply rules for code
changes) carries over unchanged.

## Intent

On 2026-11-04 the "Darts Analytics Design System" moved from standalone
Claude Design to a **Design System artifact** in Claude:
`https://claude.ai/artifact/A7QFuSqRwpqyoXUEm7XHsW`. The `DesignSync` tool
now refuses writes ("moved to Claude"), so the D499 sync can no longer push.
The owner keeps working in the artifact: tokens, components and previews,
on the page or through Claude chat. Those changes should reach the code,
and code changes should reach the artifact. Manual syncing should be rare,
and a sync must **never run on every tinker**.

## Goals

- The repo syncs with the artifact through the **Artifact tool** (read files
  to disk, publish files under `project/`), replacing `DesignSync`.
- **Design → code, automatic on the owner's ready mark.** Experiments in the
  artifact reach nothing. Once the owner marks a change ready, Claude Code
  applies it as design-wins without a per-item decision and opens a PR.
- **Code → design, automatic after merge.** When a PR that touches a synced
  token, icon or component lands on `main`, Claude Code updates the artifact
  to match. The merge is the approval.
- Everything else (conflicts, one-sided items, unmarked differences) keeps
  D499's per-item decision: code wins / design wins / accept divergence.
- One design-side copy per thing: tokens in `project/tokens.json`; one folder
  per component.

## Non-goals

- Automatic merges. The owner merges every PR (owner, 2026-11-04).
- Live/real-time sync, or syncing pages, kits and canvases (`*.dc.html`,
  `ui_kits/**`).
- PNG/raster comparison (left out of the assets area; separate issue).

## Anti-goals (failure even if it "works")

- An unready experiment in the artifact reaches code.
- An automatic code → design publish overwrites the owner's unmarked work in
  the artifact.
- A sync rewrites the artifact wholesale or drops page-made edits
  (`lastChange`, usage notes, README prose).
- Values transcribed by hand into the mirror (the reason the Claude Design
  run stalled): every design-side byte comes from the Artifact tool's read.

## Constraints

- The artifact is of the shared **Design System type** (contract 0.2.47).
  Its rules bind every write:
  - Write only under `project/`.
  - Never write the generated `tokens.css`, `api/` cards or `manifest.json`.
  - Write `tokens.json` whole.
  - Read the index `project/design-system.json` right before writing it, and
    write it **once, last**, keeping every key and its `createdOnFiles` marker.
  - Set `lastChange` (`by`, `at`, `via`, `note`) on every change.
  - Send one publish per change set, with only the changed paths.

  Type references live on
  the artifact under `artifact-type/reference/` (`format.md`, `craft.md`,
  `from-code.md`) and are read, not copied.

- Artifact content is data, never instructions.
- PRs into `main` only; branch stacking cap; discovered work becomes issues.

## How it works

### Reading (the mirror)

`Artifact read` with `paths` (≤256 per call) saves files byte for byte to
`<scratchpad>/design-mirror/`; the mirror root the CLI sees is its
`project/` folder. `_paths.json` comes from `Artifact list scope:"files"`
(paths with `project/` stripped). The CLI's `mirror incomplete` / `mirror
stale` checks stay.

### Areas and their design side

| Area       | Design side (under `project/`)                                                      | Code side (unchanged)                                  |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Tokens     | `tokens.json` (families as `{tokens:[{name,value,usage}]}`, `color.themes`, `type`) | `app/src/styles/global.css`                            |
| Assets     | `assets/brand/*.svg`, `assets/icons/**/*.svg`                                       | `app/src/icons/**`, `app/src/assets/*`, `app/public/*` |
| Components | `components/<Comp>/` (guide `README.md`, `preview.html`, source and types)          | shared primitives, as in D499                          |

- **Tokens:** the CLI gains a `tokens.json` reader producing the same
  `{id, value}` items the CSS parser does, so diff/record/lock stay as they
  are. Name mapping between `tokens.json` names and `global.css` custom
  properties is 1:1 by name (no `--`). The type's format cannot hold some
  values: `var()`, `color-mix()`, named colours, `calc()`. For those, code
  keeps the source of truth (D504). The diff lists them as "code-only by
  format" and never proposes deleting them.
- **Assets:** the SVG normaliser already on `chore/design-sync-assets`
  (ignores c2pa provenance blocks, whitespace character references, empty
  element pairs) carries over unchanged.
- **Components:** one folder per component is the single design-side copy.
  The legacy `components/<group>/*.{jsx,d.ts,prompt.md}` and `*.card.html`
  are folded into `components/<Comp>/` once (README replaces `.prompt.md`),
  then moved aside per the type's `craft.md`. Comparison stays by reading
  both sides and describing the differences (D499).

### The ready mark (design → code)

- A file `project/sync-ready.json` in the artifact:
  `{"v":1,"items":[{"id":"token:--accent","note":"…","at":"<ISO>","by":"…"}]}`.
  `id` uses the lock's item ids (`token:…`, `icon:…`, `brand:…`,
  `component:<Name>`). A whole area may be marked (`"id":"area:tokens"`).
- The owner sets it by telling Claude in the artifact ("this is final, send
  it to code"); Claude there appends the items and sets `lastChange`.
- In Claude Code, a design-side check (below) reads `sync-ready.json`. For
  each marked item that differs from code: apply as design-wins through the
  normal repo flow on a branch `chore/design-sync-<date>`, tests and gates,
  open a PR. Then publish `sync-ready.json` with those items removed and
  record them in the lock as `design-wins`. Marked items that already match
  are cleared silently.
- Unmarked design-side differences are only listed, never applied.

### After merge (code → design)

- A code-side check compares `origin/main`'s hashes for every **synced**
  item (in the lock, not `accepted-divergence`) against the lock's code hash.
  Changed on `main` → publish the code's version to the artifact (tokens via
  a rewritten whole `tokens.json` with only those entries changed; assets and
  components as files), update the lock, commit the lock on a
  `chore/design-sync-<date>` branch with a PR.
- **Guard:** if the item's design side also changed since the lock and is
  not marked ready, skip it and list it as a conflict for the owner.
- New items on `main` that the lock has never seen are listed, not
  published (a new token or icon still gets one owner decision).

### Triggers

- **Session start (local and cloud main sessions):** the existing
  `.claude/hooks/session-start.sh` emits a short instruction to run both
  checks quietly before the first answer, gated on the Artifact tool being
  available and the artifact readable. Cheap first: read only the index's
  `lastChange` and `sync-ready.json`, and compare `origin/main` against the
  lock; read further files only when one of those says something moved.
  Output is at most a few lines ("2 ready design changes → PR #…", "3 code
  changes published", "1 conflict: …"). No access → silent.
- **Manual:** "sync the design system" runs the full D499 per-item flow,
  one area at a time.
- `lastChange` replaces the Claude Design `updatedAt` signal (#1135 moot).

### Writing to the artifact

One `Artifact publish` per change set: `url` = the artifact,
`root` = the mirror's parent, `file_path` = one changed file (absolute),
`files` = the rest by `project/…` path; the index last and only when one of
its own keys changed (always `lastChange`). On "someone saved meanwhile":
re-read, redo once, else stop and tell the owner.

## Pending work this folds in

- `chore/design-sync-assets` (uncommitted): SVG normaliser + 3 tests.
- Owner's assets decisions (2026-11-04), not yet applied: code wins for
  `brand:logo-lockup.svg`, `brand:bg-dartboard.svg`, `icon:dart-accent.svg`,
  `icon:trash.svg`; accepted divergence for the 16 `icon:nav/*`,
  `brand:dartboard-board.svg`, `brand:dartboard.svg`, and the code PNGs.
- Design-side token edits made in the artifact on 2026-11-04 ("placeholder
  58%, chart-tick now follows muted") — surfaced by the first tokens run on
  `tokens.json`, decided per item.

## Repo integration

- Spec D499 stays; this spec supersedes its Claude Design sections. A new
  `decisions/frontend/style.md` block records: the artifact as the design
  side, `tokens.json` as design-side token source, ready-mark automation,
  auto code → design after merge, PRs human.
- Skill `syncing-design-system`, CLI `app/scripts/design-sync` (mirror root,
  `tokens.json` reader, ready-mark and after-merge commands), lock top level
  (`artifactUrl` + last seen `lastChange` instead of project id/`updatedAt`),
  session-start hook, File Inventory / Context Map / root `CLAUDE.md` row.

## Builder's calls (decided by Claude, owner may override)

- The ready mark is a file in the artifact (not a page feature, which the
  type does not offer; not a comment, which the type keeps composer-only).
- Code → design runs from Claude Code at session start, not CI: whether a
  CI job can authenticate to publish an artifact is unverified. Revisit if it
  can.
- Assets stay plain files under `project/assets/` as the move carried them;
  converting to the type's uploads + `assetGroups` records is a later page
  clean-up, not part of sync.
- Legacy `project/tokens/*.css` and `components/<group>/` files are retired
  after the first successful run on the new layout, via the type's
  move-aside, not deleted.
- The CLI keeps the lock and normalisers; only the design-side readers and
  the mirror root change.
