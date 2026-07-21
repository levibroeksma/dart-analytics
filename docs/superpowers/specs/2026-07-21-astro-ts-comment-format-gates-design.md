# Astro / TS Comment & Format Gates — Design

> **Date:** 2026-07-21  
> **Status:** approved (brainstorming consensus)  
> **Scope:** Agent-guide conventions + mechanical enforcement for (1) Astro template comments as `{/* */}`, (2) frontmatter `// Title` headers with a mandatory blank line before each, (3) no inline comments in `app/src/**/*.ts` (JSDoc above declarations only), (4) `x-show` must pair with `x-cloak` (already documented — add CI), (5) Prettier with `singleAttributePerLine` + format-on-save + CI `--check`, (6) one-shot cleanup of current `app/src` violations so gates are green from day one.  
> **Out of scope:** ESLint / new lint stack; CI enforcement of TS comment style or frontmatter blank-before-header; folding the new shell gate into `validate:app`; root `CLAUDE.md` invariant changes; gameplay/feature work.

---

## Context

Several authoring preferences are either missing from repo agent guides, documented but unenforced, or half-applied in markup:

| Preference | Today |
| ---------- | ----- |
| Astro template comments `{/* */}` | Not in guides; some files still use `<!-- -->` |
| Blank line before frontmatter `// Title` | Not required; `05-Astro-Components.md` shows headers without the blank-line rule |
| No inline comments in `.ts` / JSDoc-above | Cursor user rule only — not in `app/CLAUDE.md` |
| `x-show` + `x-cloak` | Already in `03-Alpine-Patterns`, `10-Frontend-Agent-Guide`, `07-Style-Guide`; some components still violate; **no** PR check |
| One attribute per line when ≥2 attrs | Informal; no Prettier project config |
| Collapse double / extra spaces on save | No Prettier `format` / `format:check` scripts |

Approach chosen: **docs + shell convention gate + Prettier** (matches existing `scripts/check-*.sh` + `.github/workflows/checks.yml` pattern). Skip installing duplicate rules that are already canonical for `x-cloak` pairing — only add the missing CI gate and fix violators.

---

## Design

### 1. Conventions

**`.astro` template (markup below frontmatter `---`)**

- Comments only as `{/* ... */}` — never `<!-- -->`.
- Every element with `x-show` also carries `x-cloak` (unchanged hard rule).

**`.astro` frontmatter**

- Keep section headers: `// Props`, `// Layouts`, `// Components`, `// Icons`, `// Lib`, `// Data`, `// Styles`.
- Mandatory blank line immediately before each `// Title` section header.
- Exception: the first section after `---` may omit the leading blank if it is the first non-empty frontmatter line.

**`app/src/**/*.ts` only** (exclude `app/tests/`, `app/scripts/`)

- No inline comments inside function/method bodies (`//` or block `/* */`).
- Prefer names that make intent obvious.
- Extra detail only via JSDoc on the declaration above the body.
- File-level / export JSDoc allowed; do not invent inline narration.

**Formatting**

- Two or more attributes → one attribute per line (`singleAttributePerLine: true`).
- Prettier normalizes structural whitespace in source (indentation, blank runs between tokens/tags) on format / save.
- Out of scope for v1: collapsing doubled spaces *inside* attribute string values (e.g. `class="foo  bar"`) — that needs `prettier-plugin-tailwindcss` or a custom rule; not part of this change.

### 2. Documentation surfaces

| Rule | Canonical home | Cascade |
| ---- | -------------- | ------- |
| Template `{/* */}`, blank-before-`// Title` | `docs/architecture/07-Frontend/05-Astro-Components.md` | Checklist + short bullets in `10-Frontend-Agent-Guide.md` §Components |
| `x-show` + `x-cloak` | Already in `03-Alpine-Patterns.md`, `10`, `07-Style-Guide.md` | Align checklist/CI wording only — no rewrite of the rule |
| TS no-inline / JSDoc-above | New short section in `app/CLAUDE.md` | One-line pointer in `10-Frontend-Agent-Guide.md`; keep `app/AGENT.md` byte-identical |
| Prettier / format commands | `app/CLAUDE.md` (tooling) + layout note in `05-Astro-Components.md` | `DECISIONS.md` one-liner; Context Maintenance dates / map as required |

Root `CLAUDE.md`: no new hard invariant (frontend/app-scoped).

### 3. Tooling & CI

**Prettier (`app/`)**

- Add exact-version devDependencies: `prettier`, `prettier-plugin-astro`.
- Config: `app/.prettierrc.mjs` — plugins, `singleAttributePerLine: true`, Astro parser override for `*.astro`.
- Ignore: `app/.prettierignore` (build output, lockfile, generated artifacts, etc.).
- Scripts: `format` → `prettier --write .`; `format:check` → `prettier --check .`.
- Editor: committed `app/.vscode/settings.json` — format on save; Prettier default formatter for Astro / TS / JS / JSON / CSS.
- CI: `checks.yml` `app` job step runs `npm run format:check`.

**Convention gate (repo root)**

- New `scripts/check-astro-conventions.sh` over `app/src/**/*.astro`:
  1. Every `x-show` on an opening tag → same tag also has `x-cloak`.
  2. No `<!--` in the **template** region (after the frontmatter closing `---`).
- Wire into `checks.yml` `structure` job (alongside context-map / file-locations / agent-mirrors).
- **Not** added to `npm run validate:app` (structure gates stay PR/structure-job scoped, same as peers).

**Docs-only / agent-enforced (no CI)**

- TS no-inline comments.
- Frontmatter blank line before `// Title`.

### 4. Cleanup & verification

**One-shot in the same change as the gates**

- Add missing `x-cloak` on every `x-show` violator.
- Replace template `<!-- -->` with `{/* */}` (or remove if obsolete).
- Insert blank lines before frontmatter `// Title` headers where missing.
- Remove inline body comments in `app/src/**/*.ts`; promote to JSDoc only when the detail is still needed.
- Run `npm run format` once; commit the formatted tree so `format:check` passes.

**Verification**

- `bash scripts/check-astro-conventions.sh` exits 0.
- `cd app && npm run format:check` exits 0.
- Existing structure scripts still pass.
- No new unit tests for the shell gate (same pattern as `check-file-locations.sh`).

**CI failure UX**

- Convention script: print file (and line/snippet when practical) per violation; non-zero exit.
- Prettier: default `--check` diff output.

### 5. Boundaries

- Does not change gameplay or API behavior beyond FOUC fixes from adding `x-cloak`.
- Shell gate is approximate (tag-oriented scan, not a full Astro AST) — good enough for the two mechanical rules; false negatives on exotic multiline constructs should be avoided by keeping the scanner conservative and covering known patterns.
- Prettier may reflow more than attributes alone; accept that as the cost of a single formatter.

---

## Decisions to record

- One `DECISIONS.md` entry: Prettier as the app formatter (`singleAttributePerLine`); Astro template comments `{/* */}` only; CI gate for `x-show`/`x-cloak` + ban on template `<!-- -->`.

---

## Success criteria

- Guides state the conventions above without contradicting existing `x-cloak` docs.
- PR `structure` job fails on missing `x-cloak` or template HTML comments.
- PR `app` job fails on Prettier drift.
- Fresh clone: format-on-save works when using the committed VS Code settings.
- Current `app/src` tree is clean under both gates after the one-shot cleanup.
