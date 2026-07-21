# Astro / TS Comment & Format Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Codify Astro/TS comment and markup conventions in agent guides, add CI gates for `x-show`/`x-cloak` + ban on template `<!-- -->`, and adopt Prettier (`singleAttributePerLine`) with format-on-save and CI `--check`, cleaning `app/src` so gates pass day one.

**Architecture:** Docs own the rules; `scripts/check-astro-conventions.sh` mechanically enforces the two Astro template rules on PRs (`structure` job); Prettier owns attribute layout and structural whitespace (`app` job `format:check`). TS no-inline-comments and frontmatter blank-before-`// Title` are docs/agent-only (no CI).

**Tech Stack:** Bash + Python 3 (convention scanner), Prettier 3 + `prettier-plugin-astro`, GitHub Actions (`checks.yml`), existing CLAUDE/AGENT mirrors

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-astro-ts-comment-format-gates-design.md`
- Do **not** add the Astro convention script to `npm run validate:app`
- Do **not** introduce ESLint
- Do **not** add `prettier-plugin-tailwindcss` (doubled spaces inside `class="..."` out of scope)
- TS comment rule scope: `app/src/**/*.ts` only — not `app/tests/`, not `app/scripts/`
- **Exempt from TS comment purge:** `// fallow-ignore-next-line ...` (tool directives must stay); `///` triple-slash refs; file-top section headers that mirror Astro vocabulary only when they are **outside** function/method bodies (prefer deleting them if redundant)
- `x-show`/`x-cloak` pairing already documented — update checklists only; do not rewrite `03-Alpine-Patterns.md` rule text
- `app/CLAUDE.md` and `app/AGENT.md` must stay byte-identical
- No git worktrees — `git checkout -b chore/astro-ts-format-gates` in the main working copy (from `main` if possible; do **not** commit unrelated WIP from `feat/score-training-play-ui`)
- Commit when a plan step says commit (this plan authorizes those commits)
- Decision id: **D123**

## File Structure

**Create:**

| File | Responsibility |
| ---- | -------------- |
| `scripts/check-astro-conventions.sh` | Fail on `x-show` without `x-cloak`; fail on `<!--` in `.astro` template region |
| `app/.prettierrc.mjs` | Prettier config + Astro plugin + `singleAttributePerLine` |
| `app/.prettierignore` | Exclude build/generated/lock artifacts |
| `app/.vscode/settings.json` | Format on save; Prettier default formatter |

**Modify:**

| File | Responsibility |
| ---- | -------------- |
| `app/package.json` | `prettier` + `prettier-plugin-astro` exact deps; `format` / `format:check` scripts |
| `app/package-lock.json` | Lockfile from install |
| `.github/workflows/checks.yml` | Structure step for convention script; app step for `format:check` |
| Known `.astro` violators | Add `x-cloak`; remove/replace `<!-- -->`; blank lines before `// Title` |
| `app/src/**/*.ts` with body comments | Promote needed notes to JSDoc; delete narration |
| `docs/architecture/07-Frontend/05-Astro-Components.md` | Template comments, blank-before-header, attribute layout |
| `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` | Condensed bullets + checklist |
| `app/CLAUDE.md` / `app/AGENT.md` | TS comments section + Prettier commands |
| `DECISIONS.md` | D123 |
| `docs/architecture/00-Context-Map.md` | Dates / inventory answers for touched frontend docs |

**Do not touch:**

| File | Why |
| ---- | --- |
| `validate:app` script | Spec: structure gates stay PR-scoped |
| Root `CLAUDE.md` invariants | App/frontend-scoped |
| `03-Alpine-Patterns.md` cloak rule body | Already correct |

---

### Task 1: Branch + Astro convention gate script

**Files:**

- Create: `scripts/check-astro-conventions.sh`
- Modify: `.github/workflows/checks.yml`

**Interfaces:**

- Consumes: all `app/src/**/*.astro`
- Produces: exit `0` when clean; exit `1` with `FAIL: ...` lines on stdout/stderr when violations exist

- [ ] **Step 1: Create dedicated branch**

```bash
git fetch origin main
git checkout main
git pull --ff-only origin main
git checkout -b chore/astro-ts-format-gates
```

If local WIP must stay on another branch, stash or leave it uncommitted there — do not bring unrelated files onto this branch.

- [ ] **Step 2: Write `scripts/check-astro-conventions.sh`**

Create the file with executable bit (`chmod +x`):

```bash
#!/usr/bin/env bash
# Astro template conventions (05-Astro-Components / 10-Frontend-Agent-Guide):
# 1) every opening tag with x-show also has x-cloak
# 2) no HTML comments <!-- --> in the template region (after frontmatter)
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - "$@" <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path("app/src")
fail = 0


def template_region(text: str) -> str:
    """Return markup after the closing --- of frontmatter, or full text if none."""
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    # skip the closing --- line
    after = text.find("\n", end + 1)
    return text if after == -1 else text[after + 1 :]


def opening_tags(template: str) -> list[tuple[int, str]]:
    """Return (line_in_template, full_tag) for each opening/self-closing tag."""
    tags: list[tuple[int, str]] = []
    i = 0
    while True:
        start = template.find("<", i)
        if start == -1:
            break
        # skip closing tags and comments / doctype
        if template.startswith("</", start) or template.startswith("<!--", start) or template.startswith("<!", start):
            i = start + 1
            continue
        # find end of tag, respecting quotes
        j = start + 1
        quote = None
        while j < len(template):
            ch = template[j]
            if quote:
                if ch == quote:
                    quote = None
            elif ch in "\"'":
                quote = ch
            elif ch == ">":
                break
            j += 1
        else:
            break
        tag = template[start : j + 1]
        line = template.count("\n", 0, start) + 1
        tags.append((line, tag))
        i = j + 1
    return tags


def check_file(path: Path) -> None:
    global fail
    text = path.read_text(encoding="utf-8")
    template = template_region(text)
    # HTML comments in template
    for m in re.finditer(r"<!--", template):
        line = template.count("\n", 0, m.start()) + 1
        # map to file line: frontmatter offset
        offset = text.find(template)
        file_line = text.count("\n", 0, offset + m.start()) + 1 if offset >= 0 else line
        print(f"FAIL: {path}:{file_line}: HTML comment <!-- --> forbidden in .astro template; use {{/* */}}", file=sys.stderr)
        fail = 1
    for line, tag in opening_tags(template):
        if re.search(r"\bx-show\b", tag) and not re.search(r"\bx-cloak\b", tag):
            offset = text.find(template)
            file_line = text.count("\n", 0, offset) + line if offset >= 0 else line
            print(f"FAIL: {path}:{file_line}: x-show without x-cloak on the same element", file=sys.stderr)
            fail = 1


def main() -> int:
    global fail
    files = sorted(ROOT.rglob("*.astro"))
    if not files:
        print("FAIL: no .astro files under app/src", file=sys.stderr)
        return 1
    for path in files:
        check_file(path)
    if fail:
        return 1
    print("OK: Astro x-show/x-cloak pairing and no template HTML comments.")
    return 0


sys.exit(main())
PY
```

- [ ] **Step 3: Run script — expect FAIL on current tree**

Run: `bash scripts/check-astro-conventions.sh`

Expected: FAIL including at least:

- `app/src/pages/login/index.astro` — `x-show="error"` without `x-cloak`
- `app/src/components/layout/games/SetupSessionForm.astro` — error `<p>` missing `x-cloak`
- `app/src/components/layout/games/ContinueSessionModal.astro` — error `<p>` missing `x-cloak`
- `app/src/components/ui/CardWrapper.astro` — trailing `<!-- ... -->` dead block

- [ ] **Step 4: Wire into `.github/workflows/checks.yml`**

In the `structure` job, after the AGENT.md mirror step, add:

```yaml
      - name: Astro conventions gate
        run: bash scripts/check-astro-conventions.sh
```

- [ ] **Step 5: Commit**

```bash
git add scripts/check-astro-conventions.sh .github/workflows/checks.yml
git commit -m "$(cat <<'EOF'
ci: add Astro x-show/x-cloak and HTML-comment gate

EOF
)"
```

---

### Task 2: Fix Astro violators (cloak + HTML comments + frontmatter blanks)

**Files:**

- Modify: `app/src/pages/login/index.astro`
- Modify: `app/src/components/layout/games/SetupSessionForm.astro`
- Modify: `app/src/components/layout/games/ContinueSessionModal.astro`
- Modify: `app/src/components/ui/CardWrapper.astro`
- Modify: any other `.astro` the script still reports (re-run after each batch)
- Modify: `.astro` files missing blank line before `// Props` / `// Layouts` / etc. (agent rule; not CI)

**Interfaces:**

- Consumes: Task 1 script
- Produces: `bash scripts/check-astro-conventions.sh` → exit 0

- [ ] **Step 1: Fix login error paragraph**

In `app/src/pages/login/index.astro`, change the error `<p>` to include `x-cloak`:

```astro
          <p
            x-show="error"
            x-text="error"
            x-cloak
            class="text-sm text-destructive"
            role="alert"
          ></p>
```

- [ ] **Step 2: Fix setup / continue error lines**

`SetupSessionForm.astro`:

```astro
  <p class="mt-2 text-sm text-red-500" x-show="error" x-text="error" x-cloak></p>
```

`ContinueSessionModal.astro`:

```astro
    <p class="text-sm text-error mt-3" x-show="error" x-text="error" x-cloak></p>
```

- [ ] **Step 3: Remove CardWrapper HTML comment block**

Delete the trailing dead block in `CardWrapper.astro` (lines with `<!-- ---` through `-->`). Leave only the live component markup.

- [ ] **Step 4: Re-run gate until clean**

Run: `bash scripts/check-astro-conventions.sh`

Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.`

If more FAIL lines appear, fix those files the same way (add `x-cloak` on the same opening tag; replace any template `<!-- -->` with `{/* */}` or delete).

- [ ] **Step 5: Frontmatter blank-before-`// Title` sweep**

For every `app/src/**/*.astro` frontmatter section header matching `^// (Props|Layouts|Components|Icons|Lib|Data|Styles)\b`:

- Ensure the line immediately above is blank, **unless** that header is the first non-empty line after `---`.

Example shape:

```astro
---
interface Props {
  class?: string;
}

// Props
const { class: classNameProp }: Props = Astro.props;

// Components
import Button from "@components/forms/Button.astro";

// Styles
const className = cn("...", classNameProp);
---
```

- [ ] **Step 6: Commit**

```bash
git add app/src
git commit -m "$(cat <<'EOF'
fix(ui): pair x-cloak with x-show; drop Astro HTML comments

EOF
)"
```

---

### Task 3: Prettier install, config, format-on-save, CI check

**Files:**

- Create: `app/.prettierrc.mjs`
- Create: `app/.prettierignore`
- Create: `app/.vscode/settings.json`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Modify: `.github/workflows/checks.yml`
- Modify: formatted sources under `app/` (from `--write`)

**Interfaces:**

- Consumes: none from Task 1 beyond a clean tree preference
- Produces: `npm run format:check` exit 0; CI step present

- [ ] **Step 1: Install exact Prettier deps**

Run from `app/`:

```bash
cd app
npm install --save-dev --save-exact prettier prettier-plugin-astro
```

- [ ] **Step 2: Add scripts to `app/package.json`**

Under `"scripts"`:

```json
    "format": "prettier --write .",
    "format:check": "prettier --check ."
```

- [ ] **Step 3: Write `app/.prettierrc.mjs`**

```js
/** @type {import("prettier").Config} */
export default {
  plugins: ["prettier-plugin-astro"],
  singleAttributePerLine: true,
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};
```

- [ ] **Step 4: Write `app/.prettierignore`**

```
dist
.wrangler
.astro
node_modules
package-lock.json
coverage
drizzle
```

Adjust if the tree uses additional generated folders; do not ignore `src/`.

- [ ] **Step 5: Write `app/.vscode/settings.json`**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[astro]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[css]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

- [ ] **Step 6: Format the tree**

Run: `cd app && npm run format`

Expected: Prettier rewrites `.astro`/`.ts`/etc. under `app/` with multi-attribute tags one-per-line.

- [ ] **Step 7: Re-verify Astro gate still passes**

Run: `bash scripts/check-astro-conventions.sh`

Expected: OK (formatter must not strip `x-cloak` or introduce `<!--`).

- [ ] **Step 8: Verify format check**

Run: `cd app && npm run format:check`

Expected: exit 0 / “All matched files use Prettier code style!”

- [ ] **Step 9: Wire CI `format:check`**

In `.github/workflows/checks.yml` `app` job, after Install, add:

```yaml
      - name: Format gate
        run: npm run format:check
```

Keep existing type/fallow/neon steps after it (or immediately after Install — either order is fine as long as Install comes first).

- [ ] **Step 10: Commit**

```bash
git add app/package.json app/package-lock.json app/.prettierrc.mjs app/.prettierignore app/.vscode/settings.json .github/workflows/checks.yml
git add -u app/src app/tests
git commit -m "$(cat <<'EOF'
chore(app): add Prettier with singleAttributePerLine and CI check

EOF
)"
```

If other formatted paths appear under `app/`, include them in the same commit.

---

### Task 4: Strip inline body comments in `app/src/**/*.ts`

**Files:**

- Modify: every `app/src/**/*.ts` that has `//` or `/* */` **inside** function/method bodies (inventory at plan time included at least: `middleware.ts`, `session-recovery.ts`, `score-training-play.data.ts`, `score-training-setup.data.ts`, `verify-jwt.ts`, `player.repository.ts`, `provision.ts`, `db/client.ts`, `register-stores.ts`, `app.factory.ts`, `segment-timer.module.ts`, `session.service.ts`, `lib/client/api/types.ts`)

**Interfaces:**

- Consumes: Global Constraints exemptions
- Produces: no narrating inline comments inside bodies; needed facts live in JSDoc on the enclosing function/export

- [ ] **Step 1: Inventory remaining body comments**

Run:

```bash
rg -n '//|/\*' app/src --glob '*.ts'
```

For each hit, classify:

| Keep | Action |
| ---- | ------ |
| `// fallow-ignore-next-line ...` | Keep as-is |
| `/// <reference ...>` | Keep |
| Outside any function (file section headers) | Prefer delete; optional keep only if they match a deliberate section map |
| Inside function/method body | Delete, or move substance into JSDoc above the function |

- [ ] **Step 2: Apply promotions (examples)**

`session-recovery.ts` — replace case narration with JSDoc on the exported function describing the four outcomes; delete in-body `// Case N` lines.

`score-training-play.data.ts` / `score-training-setup.data.ts` — delete block narrations; if a branch is non-obvious, add one JSDoc sentence on the method.

`verify-jwt.ts` — remove end-of-line comments; put claim requirements in the function JSDoc.

`db/client.ts` — keep a short JSDoc (or existing pointer) above the client factory pointing at `11-Neon-Integration.md`; remove duplicate inline lines if redundant with that JSDoc.

Do **not** remove `fallow-ignore-next-line` comments.

- [ ] **Step 3: Re-format after comment edits**

Run: `cd app && npm run format && npm run format:check`

Expected: exit 0

- [ ] **Step 4: Smoke tests**

Run: `cd app && npm test`

Expected: all tests pass (comment-only edits should not change behavior).

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "$(cat <<'EOF'
refactor(app): move src TS notes to JSDoc; drop inline body comments

EOF
)"
```

---

### Task 5: Docs, decisions, context maintenance

**Files:**

- Modify: `docs/architecture/07-Frontend/05-Astro-Components.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`
- Modify: `app/CLAUDE.md`
- Modify: `app/AGENT.md` (identical to `app/CLAUDE.md`)
- Modify: `DECISIONS.md`
- Modify: `docs/architecture/00-Context-Map.md` (inventory answers + version/date as required)

**Interfaces:**

- Consumes: conventions from the approved spec
- Produces: checkers green; D123 recorded

- [ ] **Step 1: Update `05-Astro-Components.md`**

Bump `updated:` / version note. Add/adjust:

1. Under Frontmatter Structure — mandatory blank line before each `// Title`; first section after `---` may omit it.
2. New **Comments** subsection:

```markdown
# Comments

- **Template (markup):** comments only as `{/* ... */}` — never `<!-- -->`.
- **Frontmatter:** TypeScript `//` / JSDoc only; section headers use the vocabulary above.
```

3. Under Class Composition / markup examples — note multi-attribute tags use one attribute per line (enforced by Prettier `singleAttributePerLine`).
4. Update the sample frontmatter to show the blank line before `// Props`.
5. Anti-patterns table: add rows for `<!-- -->` in template and `x-show` without `x-cloak` (pointer to Alpine docs is fine).

- [ ] **Step 2: Update `10-Frontend-Agent-Guide.md`**

In §10 Components, append bullets:

```markdown
- **Template comments:** `{/* ... */}` only — never `<!-- -->`
- **Frontmatter `// Title`:** blank line before each section header (`05-Astro-Components.md`)
- **Formatting:** Prettier (`singleAttributePerLine`); `npm run format` / `format:check`
```

Add under Types or a new one-liner:

```markdown
- **`app/src/**/*.ts` comments:** no inline comments inside function bodies — JSDoc above the declaration (`app/CLAUDE.md`)
```

Checklist already has `x-show`/`x-cloak`; add:

```markdown
- [ ] Template comments are `{/* */}` only (no `<!-- -->`)
- [ ] `npm run format:check` clean when touching `app/` markup/TS
```

Bump version/`updated:` date to `2026-07-21`.

- [ ] **Step 3: Update `app/CLAUDE.md` and mirror to `app/AGENT.md`**

Add sections (exact placement: after Non-Negotiable Rules or under Frontend Rules):

```markdown
## TypeScript comments (`app/src/**/*.ts`)

- Never put `//` or `/* */` comments inside function/method bodies.
- Prefer names that read naturally; put necessary detail in JSDoc above the declaration.
- Exempt: `// fallow-ignore-next-line ...` tool directives; `///` triple-slash references.
- Out of scope: `app/tests/`, `app/scripts/`.

## Formatting

- Prettier + `prettier-plugin-astro` (`singleAttributePerLine: true`).
- `npm run format` (write) · `npm run format:check` (CI).
- Format on save via `app/.vscode/settings.json`.
```

Copy the entire file to `app/AGENT.md` so they remain byte-identical (`cp app/CLAUDE.md app/AGENT.md`).

- [ ] **Step 4: Record D123 in `DECISIONS.md`**

Append to the appropriate session table (frontend/process):

```markdown
| D123 | 2026-07-21 | Prettier is the `app/` formatter (`singleAttributePerLine`); `.astro` template comments are `{/* */}` only; CI enforces `x-show`↔`x-cloak` and bans template `<!-- -->` via `scripts/check-astro-conventions.sh`; TS inline body comments banned under `app/src/**/*.ts` (JSDoc-above; agent-enforced) | FOUC-safe Alpine markup, consistent authoring, mechanical drift prevention |
```

Set `updated: 2026-07-21` in the DECISIONS HTML header if not already.

- [ ] **Step 5: Context map touch-up**

In `00-Context-Map.md`, update the inventory “Answers” lines for `05-Astro-Components.md` and `10-Frontend-Agent-Guide.md` to mention comment/format conventions, and bump the map version/`updated` date per Context Maintenance.

- [ ] **Step 6: Run context checkers**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-conventions.sh
cd app && npm run format:check
```

Expected: all OK / exit 0.

- [ ] **Step 7: Refresh graph if docs/scripts changed paths materially**

```bash
bash scripts/refresh-graph.sh
```

Stage `graphify-out/graph.json` if it changed.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture/07-Frontend/05-Astro-Components.md \
  docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md \
  docs/architecture/00-Context-Map.md \
  app/CLAUDE.md app/AGENT.md DECISIONS.md graphify-out/graph.json
git commit -m "$(cat <<'EOF'
docs: codify Astro/TS comment rules and Prettier (D123)

EOF
)"
```

---

### Task 6: Final verification

**Files:** none new — verification only

- [ ] **Step 1: Run the full local gate set**

```bash
bash scripts/check-context-map.sh
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-conventions.sh
cd app && npm run format:check && npm test && npx astro check
```

Expected: all exit 0 / tests pass / astro check clean.

- [ ] **Step 2: Confirm CI wiring**

Open `.github/workflows/checks.yml` and verify:

- `structure` includes `Astro conventions gate`
- `app` includes `Format gate` → `npm run format:check`

- [ ] **Step 3: Completion report**

Report: branch name, D123, PR link if opened (or that none exists yet), graph refresh status.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| ---------------- | ---- |
| Template `{/* */}` only | Tasks 2, 5 |
| Blank before frontmatter `// Title` | Tasks 2, 5 |
| TS no inline / JSDoc (`app/src`) | Tasks 4, 5 |
| `x-show` + `x-cloak` CI | Tasks 1–2 |
| Ban template `<!-- -->` CI | Tasks 1–2 |
| Prettier + `singleAttributePerLine` + format-on-save + CI | Task 3 |
| One-shot cleanup | Tasks 2–4 |
| Docs surfaces + D123 + context maintenance | Task 5 |
| Not in `validate:app` | Global Constraints + Task 1 |
| No Tailwind prettier plugin | Global Constraints |

No placeholders remaining after self-review.
