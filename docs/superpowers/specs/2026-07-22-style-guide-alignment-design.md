# Style Guide Alignment — Design

> **Date:** 2026-07-22
> **Status:** approved (brainstorming consensus)
> **Scope:** Rewrite the frontend style contract to match the finalized Score Training visual system; cascade into agent guides and `app/CLAUDE.md`/`AGENT.md`; mechanically purge legacy token/class usage; ship as PR1 after rebase onto `origin/main`, with remaining UI polish as stacked PR2.
> **Out of scope:** Portable UI kit members not already in use; light mode / theme toggle; regenerating architecture docs; git worktrees (isolation is GitHub branches only).

---

## Context

The Score Training UI and `app/src/styles/global.css` have moved to a new visual system (sky accent, glass surfaces, `surface`/`foreground`/`muted` vocabulary, Michroma/Montserrat/JetBrains fonts, primitives such as `.gradient-card`, `.link-card`, `.card-wrapper`, `.nav-pill`, `.tab`, `.alert`, `.btn-error`).

Canonical docs still describe the prior contract:

| Stale doc claim | Current code |
| --------------- | ------------ |
| `bg-bg` / `text-fg` / `fg-*` | `bg-surface` / `text-foreground` / `text-muted` / `text-muted-foreground` |
| Teal accent scale | Sky accent (`--accent` / `@theme` mappings) |
| `.surface` / `.surface-elevated` / `.badge*` / `.nav-item*` | Glass utilities + raised/overlay tokens + layout-specific classes |
| `10-Frontend-Agent-Guide.md` §12 mirrors the old list | Agents will invent against dead names |

`Button.astro` still uses `font-medium`, which the style guide forbids — that ban is retained; components/CSS must change to comply.

Branch `feat/score-training-play-ui` has diverged from `origin/main` (PR #31 already merged). Work proceeds on a rebased feature line in the main working copy — no git worktrees.

---

## Decisions locked in brainstorming

| Topic | Choice |
| ----- | ------ |
| Doc ownership | Style Guide is SoT; agent guide gets condensed cascade; short non-negotiable checklist in `app/CLAUDE.md` + `AGENT.md` |
| Authority for rewrite | Finalized Score Training UI is design intent; CSS/components fixed in the same PR until they match |
| Delivery | Two PRs: (1) style contract + alignment, (2) remaining UI polish |
| Order | Rebase onto `origin/main` once; land PR1 first; stack PR2 on PR1 tip |
| Weight rule | Keep **never `font-medium`**; fix all hits |
| Legacy styling | Purge any old names (`fg` → `foreground`, `bg-bg` → `bg-surface`, etc.) wherever encountered |
| Approach | Full rewrite + mechanical audit (Approach 1) |

---

## Design

### 1. Scope & delivery

**PR1 — Style contract alignment** (after rebase onto `origin/main`)

- Rewrite `docs/architecture/07-Frontend/07-Style-Guide.md`
- Update `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` § Styling
- Add **Style non-negotiables** checklist to `app/CLAUDE.md` and `app/AGENT.md` (byte-identical mirrors)
- Context Maintenance: Context Map inventory date (and token budget bump only if needed), `DECISIONS.md` one-liner, run `check-context-map.sh` / `check-file-locations.sh` / `check-agent-mirrors.sh`, refresh graph
- Mechanical audit + fix of legacy tokens/classes/`font-medium` across CSS and `.astro` (and any stale handbook mentions)
- Branch checkout only — never `.worktrees/`

**PR2 — UI polish** (branch from PR1 tip)

- Remaining Score Training / shared-component polish not required for doc↔code agreement
- Does not re-litigate the visual contract
- Retarget to `main` after PR1 merges if needed

**Out of scope for both PRs:** unused portable kit members; regenerating docs; theme toggle / light mode.

### 2. Style Guide content (visual contract)

`07-Style-Guide.md` remains the single SoT for *what exists and when to use it*. `05-Astro-Components.md` continues to own *how* classes are composed (`cn()`, frontmatter order). Neither repeats the other.

**Rewrite sections:**

| Section | Content |
| ------- | ------- |
| Theme | Dark-only; mobile shell; ambient body gradients; tap / safe-area rules |
| Tokens | New names only: `surface` / `surface-raised` / `surface-overlay` / `glass*` / `foreground` / `muted` / `muted-foreground` / `border*` / sky `accent*` / `error*` / `success*` / radius scale / fonts (`sans` Montserrat, `display` Michroma, `mono` JetBrains Mono) |
| Primitives | Live contracts: `@utility glass` / `glass-strong`; `.btn` + `primary` / `secondary` / `ghost` / `error`; `.input` (+ error); `.control`; `.tab`; `.alert` (+ variants); `.nav-pill`; `.gradient-card`; `.link-card`; `.card-wrapper`; shell patterns as used by layouts |
| Typography | Display headings → `font-display`; body → `font-sans`; scores → `font-mono tabular-nums`; **never `font-medium`**; existing case rules retained |
| Spacing / buttons / surfaces / motion / a11y / anti-patterns | Updated to current usage; anti-patterns explicitly list legacy names (`bg-bg`, `text-fg`, old `.surface` / `.nav-item` / `.badge`, teal/zinc palette utils) |

**Authority when conflicts during PR1:** design intent (finalized Score Training UI) wins — update CSS/components until they match the rewritten guide. **After PR1:** if guide and CSS disagree, `global.css` is the runtime source of truth (same rule as today, restated in the guide header).

**Retired from the guide (do not reintroduce as current API):** `bg-bg*` / `text-fg*` / `.surface` / `.surface-elevated` / `.badge*` / `.nav-item*` as previously documented. Document replacements (glass / raised / overlay / new nav primitives) or list under anti-patterns.

Dialog components remain component contracts (`Modal.astro`, `ConfirmDialog.astro`), not CSS class primitives — keep that split.

### 3. Agent cascade

**`10-Frontend-Agent-Guide.md` §12 Styling**

Replace the old token/primitive list with a condensed new-vocabulary summary and a pointer to `07-Style-Guide.md`. Checklist item for styling stays; wording updated to the new names and the `font-medium` ban.

**`app/CLAUDE.md` / `app/AGENT.md`**

Add a short **Style non-negotiables** block (keep it brief so agents see it without opening the handbook):

- Semantic tokens only — new names (`surface`, `foreground`, `muted*`, `accent*`, …); never raw palette utilities
- Reuse primitives from `global.css`; do not reinvent per screen
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md`

Mirrors must remain byte-identical; `scripts/check-agent-mirrors.sh` must pass.

**Context Map**

- Refresh the `07-Style-Guide.md` inventory row date (and description if the one-liner is stale)
- Context packs already load the style guide for frontend UI work — no pack restructuring required unless token budget needs a light bump after the rewrite

**`DECISIONS.md`**

One line: style guide rewritten to sky/glass/surface vocabulary; legacy `fg` / `bg-bg` / old surface-badge-nav class contract retired; `font-medium` ban retained.

### 4. Mechanical audit (PR1)

1. Grep for legacy and banned patterns across `app/` and style-related docs:
   - `bg-bg`, `text-fg`, `fg-muted`, `fg-subtle`, `fg-faint`, `bg-bg-subtle`, `bg-bg-muted`, `bg-bg-emphasis`
   - `font-medium`
   - raw palette: `bg-teal`, `text-teal`, `text-zinc`, `bg-zinc` (and similar)
   - obsolete primitive class names: `.surface-elevated`, class `surface` where it means the old card contract, `.nav-item`, `.badge`
2. Fix every hit in `global.css`, `.astro` markup/frontmatter, and any stale handbook text
3. Align `Button.astro` (and peers) weights/variants with the guide (`font-semibold` for emphasis contexts)
4. Validate before claiming PR1 done: context checkers, agent mirrors, `npm run validate:app` (or the repo’s current app validation path), graph refresh when hooks are absent

No new automated CSS unit tests — regressions caught by audit grep + visual smoke of Score Training setup/play.

### 5. Branch / rebase workflow

1. `git fetch origin`
2. Rebase the feature line onto `origin/main` in the main working copy (resolve conflicts; no worktrees)
3. Implement PR1 on that tip (dedicated branch name allowed if cleaner, e.g. `docs/style-guide-alignment`, still rooted on the rebased line)
4. Open **PR1** targeting `main`
5. Branch **PR2** from the PR1 tip for remaining UI polish; retarget to `main` after PR1 merges if the stack requires it

---

## Success criteria

- [ ] `07-Style-Guide.md` describes only the new vocabulary and live primitives
- [ ] Agent guide §12 and `app/CLAUDE.md`/`AGENT.md` checklist agree with the guide
- [ ] Grep finds no legacy token names / `font-medium` / obsolete primitive classes in active app UI code
- [ ] Context Maintenance checkers + agent mirrors pass; graph refreshed or reported
- [ ] PR1 opened from a branch rebased onto current `origin/main`
- [ ] PR2 scoped to polish only, stacked after PR1

---

## Related

- Prior style intro: `docs/superpowers/specs/2026-07-16-style-guide-hardening-design.md` (historical — superseded by this alignment for token/primitive names)
- Canonical guide: `docs/architecture/07-Frontend/07-Style-Guide.md`
- Runtime CSS: `app/src/styles/global.css`
