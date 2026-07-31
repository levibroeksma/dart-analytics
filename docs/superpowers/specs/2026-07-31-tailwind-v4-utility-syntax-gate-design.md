# Design — Tailwind v4 Utility Syntax Gate

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-31.
> Scope: document and mechanically enforce Tailwind v4 class syntax for important modifiers and arbitrary negative values in `app/src` styling.
> Relates to: D161 (`scripts/check-style-tokens.sh`); `docs/architecture/07-Frontend/07-Style-Guide.md`.

---

## 1. Background & Motivation

Agents repeatedly emit Tailwind v3-era utility forms that this repo rejects in favor of Tailwind v4 syntax:

| Deprecated (ban) | Required |
| ---------------- | -------- |
| `!max-w-none` | `max-w-none!` |
| `!size-[130vmin]` | `size-[130vmin]!` |
| `-left-[45%]` | `left-[-45%]` |
| `-bottom-[45%]` | `bottom-[-45%]` |

Prose-only guidance will keep failing under attention load. The existing style gate (`scripts/check-style-tokens.sh`, pre-commit + CI via D161) already owns style bans — extend it rather than add a parallel script.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Negative-value scope | **A** — ban only leading-dash **arbitrary** forms (`-prop-[…]`); keep scale negatives (`-mt-4`, `-rotate-45`) |
| Important-modifier form | Suffix only: `utility!` — ban prefix `!utility` |
| Enforcement vehicle | Extend `scripts/check-style-tokens.sh` (not a new script) |
| Scan surface | `app/src/**/*.{astro,css}` — same as existing style-token checks |
| False-positive guard | Prefix-`!` must not flag Alpine/JS boolean negation (`!loading`, `!isText`), including inside `:class={`…`}` |
| `@apply` + important | **Do not** scan `@apply` for prefix-`!` (collides with CSS `!important`); no current `@apply !utility` usage |
| Branch | Dedicated task branch — do not mix with unrelated UI work on `enhace/ui-style-improvements` |

---

## 3. Scope

**In:**

- Two ban **families** in `scripts/check-style-tokens.sh` (implemented as four grep patterns: three for prefix-important, one for leading-dash arbitrary)
- Docs: Style Guide anti-patterns + short Tailwind v4 syntax note; agent-guide + `app/CLAUDE.md` / `AGENT.md` pointers
- Context-map inventory line update; `DECISIONS.md` entry (D174); context-maintenance verify (`check-context-map.sh`, `check-context-budget.sh`, agent mirrors)
- Commit this design + the implementation plan with the docs task
- Wire remains husky pre-commit + `.github/workflows/quality.yml` (already call this script)

**Out:**

- Banning scale negatives (`-mt-4`, `-rotate-45`, …)
- `prettier-plugin-tailwindcss` or auto-fix
- Rewriting historical specs/plans that show old examples
- Changing runtime CSS `!important` declarations in `global.css` (not Tailwind utilities)
- Scanning `@apply` for prefix-important (see §4.1)
- Catching prefix-important only in a JS string later passed to `class={x}` (accepted blind spot)

---

## 4. Gate rules

### 4.1 Prefix important (ban)

Detect Tailwind important used as a **prefix** on a utility class token.

- **Ban shape:** a class token starting with `!` followed by a utility name (`![a-z]`…), e.g. `!flex`, `!max-w-none`, `!size-[130vmin]`, `hover:!bg-surface`
- **Allow:** suffix important (`flex-row!`, `max-w-none!`)
- **Must not match:** Alpine/JS `!ident` (`x-show="!loading"`, `!isText && "…"`, `:class={`!${value} && '…'`}`, `:class={`!loading && '…'`}`)

**Implementation (fixed) — three patterns; any hit fails:**

1. **Static `class=` / `class={` only** — not `:class` (the `[^:]` guard prevents `:class` from matching):
   - `(^|[^:])class="[^"]*![a-z]`
   - `(^|[^:])class='[^']*![a-z]`
   - `(^|[^:])class=\{`[^`]*![a-z]`
2. **Quoted or backticked compound utility** (covers `cn("!max-w-none")` on a later line, and `:class` with compound `!max-w-none`):
   - `["'`]![a-z][a-z0-9]*(-[a-z0-9./\[\]%-]+|\[[^\]]+\])`
   - Requires a `-…` or `[…]` segment after the first word — matches `!max-w-none`, `!size-[130vmin]`; does **not** match `"!loading"` / `` `!loading` `` / `!isText`
3. **Bare prefix important inside `cn(` same line** (covers `cn("!flex", …)`):
   - Line contains `cn(` and `["'`]![a-z]+["'`]`

**Accepted gaps (document in script header):**

- Prefix-important only in a variable string (`const x = "!flex"`) then `class={x}` — not scanned
- Bare `:class={`!flex`}` (no `-` / `[` in the utility) — not scanned; compound `:class={`!max-w-none`}` is caught by pattern 2
- `@apply !utility` — not scanned (avoids `!important` collision)

| Must fail | Must pass |
| --------- | --------- |
| `class="… !max-w-none …"` | `x-show="!loading"` |
| `cn("!flex", …)` | `!isText && "btn …"` |
| `cn(\n  "!size-[130vmin]"\n)` via pattern 2 | `flex-row!` / `max-w-none!` |
| | `:class={`!${value} && '…'`}` (ScoreInput) |
| | `:class={`!loading && '…'`}` |
| | CSS `display: none !important` |
| | `@apply …` lines with no Tailwind prefix-`!` |

Document the patterns + gaps in the script header. Verify red/green during implementation against the table; no permanent fixture file.

### 4.2 Leading-dash arbitrary (ban)

- **Ban:** `\b-[a-z][a-z0-9]*-\[[^\]]+\]` (e.g. `-left-[45%]`, `-bottom-[25%]`)
- Multi-segment forms like `-inset-x-[10%]` are caught via the trailing `-x-[10%]` substring — note that in the script comment
- **Allow:** `-mt-4`, `-rotate-45`, `-translate-x-1/2` (no `[…]` arbitrary segment in the leading-dash form)
- **Allow:** `left-[-45%]`, `bottom-[-25%]` (negative inside the arbitrary value)

Fail messages must name the required rewrite.

---

## 5. Documentation

| File | Change |
| ---- | ------ |
| `docs/architecture/07-Frontend/07-Style-Guide.md` | Version **0.2.1**, `updated: 2026-07-31`; new “Tailwind v4 class syntax” section **immediately before `# Anti-patterns`**; both bans in Anti-patterns table |
| `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` | Version **0.1.6**, `updated: 2026-07-31`; append one sentence to §12 Styling; extend checklist bullet |
| `app/CLAUDE.md` + `app/AGENT.md` | Identical whole-file mirrors: Style non-negotiables + gate pointer |
| `docs/architecture/00-Context-Map.md` | Update `check-style-tokens.sh` inventory description + header date/version as required by that file’s convention |
| `DECISIONS.md` | D174 row |
| This design + plan | Commit with the docs/gate landing |

Canonical visual contract remains `07-Style-Guide.md`; agent mirrors stay one-line pointers.

---

## 6. Verification

1. Temporary fixtures — script exits non-zero for each ban family; must-pass fixtures exit 0.
2. Confirm current `app/src` is clean. Known allowed: `BaseLayout` `left-[-…]` / `bottom-[-…]`; `GameCard` `flex-row!` and `-rotate-45`; `ScoreInput` `:class={`!${value}…`}`.
3. Pre-commit path unchanged: husky already runs `check-style-tokens.sh`.
4. After landing: `check-style-tokens.sh`, `check-agent-mirrors.sh`, `check-doc-links.sh`, `check-context-map.sh`, `check-context-budget.sh` (context-maintenance).

---

## 7. Open / deferred

- Scale-negative ban (option B) — deferred.
- Auto-rewrite via prettier — out of scope.
- `@apply` prefix-important scan — deferred until needed without `!important` collision.
- Bare `:class={`!flex`}` — accepted gap.
