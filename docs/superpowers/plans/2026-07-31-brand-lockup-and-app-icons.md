# Brand Lockup SVG + App Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one outlined brand lockup SVG for home/login, and generate + wire dartboard-on-black favicon / PWA / iOS Home Screen icons from `bg-dartboard.svg`.

**Architecture:** `bg-dartboard.svg` stays the mark source. A checked-in Node script composes it onto a `#000` square and rasterizes public icons. A second script (or the same module family) builds `logo-lockup.svg` by embedding the mark plus Michroma wordmark paths (opentype). Call sites import the lockup; `BaseLayout` + `manifest.json` point at the new public icons.

**Tech Stack:** Astro SVG imports, TypeScript (`tsx`), `@resvg/resvg-js`, `to-ico`, `opentype.js`, Michroma OFL TTF.

**Spec:** `docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md`

## Global Constraints

- Icon composition: full board centered on `#000000` square with ~10–12% inset padding
- Source mark: `app/src/assets/bg-dartboard.svg` (do not redesign geometry in this plan)
- Generator is checked-in; outputs under `app/public/` are committed; re-run after mark changes
- Lockup wordmark: outlined paths only (no `<text>`); fill `oklch(68.5% 0.169 237.323)`
- Lockup replaces HTML lockups on home + login only
- No maskable-purpose asset, no OG images, no CI auto-gen hook
- Worktrees forbidden — work on `enhace/ui-style-improvements` (this is that branch’s brand UI work)
- Do not commit unless the user asks during execution (plan still lists commit steps for when requested)

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/scripts/generate-app-icons.ts` | Compose dark-square SVG from `bg-dartboard.svg`; write favicon.svg / PNGs / favicon.ico |
| `app/scripts/generate-logo-lockup.ts` | Build `logo-lockup.svg` (mark + outlined Michroma wordmark) |
| `app/scripts/assets/Michroma-Regular.ttf` | OFL font used only by lockup generator |
| `app/public/favicon.svg` | Tab / manifest SVG icon (board on black) |
| `app/public/favicon.ico` | Legacy tab icon |
| `app/public/apple-touch-icon.png` | 180×180 iOS Home Screen |
| `app/public/icon-192.png` | PWA 192 |
| `app/public/icon-512.png` | PWA 512 |
| `app/src/assets/logo-lockup.svg` | In-app brand lockup |
| `app/src/layouts/BaseLayout.astro` | Add `apple-touch-icon` link |
| `app/public/manifest.json` | Icon list + correct MIME types |
| `app/src/pages/index.astro` | Use `logo-lockup.svg` |
| `app/src/pages/login/index.astro` | Use `logo-lockup.svg` + accessible name |
| `app/package.json` | `icons:generate`, `logo:generate` scripts + devDeps |

---

### Task 1: App icon generator + public assets

**Files:**
- Create: `app/scripts/generate-app-icons.ts`
- Modify: `app/package.json` (devDependencies + `icons:generate`)
- Create/overwrite: `app/public/favicon.svg`, `app/public/favicon.ico`, `app/public/apple-touch-icon.png`, `app/public/icon-192.png`, `app/public/icon-512.png`

**Interfaces:**
- Consumes: `app/src/assets/bg-dartboard.svg` (SVG text; viewBox `-220,-220,440,440`)
- Produces: public icon files listed above; npm script `icons:generate` → `tsx scripts/generate-app-icons.ts`

- [ ] **Step 1: Install raster deps (from `app/`)**

```bash
cd app
npm install -D @resvg/resvg-js to-ico
```

Expected: packages in `devDependencies`; lockfile updated.

- [ ] **Step 2: Add `generate-app-icons.ts`**

Create `app/scripts/generate-app-icons.ts`:

```ts
/**
 * Build favicon + PWA / iOS icons from bg-dartboard.svg (dark square + centered board).
 * Spec: docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md
 *
 * Run: npm run icons:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import toIco from "to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const sourcePath = resolve(appRoot, "src/assets/bg-dartboard.svg");
const publicDir = resolve(appRoot, "public");

const BG = "#000000";
const INSET = 0.12; // 12% padding each side → content uses 76% of canvas

/**
 * Strip outer <svg> wrapper; return inner markup + numeric viewBox parts.
 */
function parseBoardSvg(svgText: string): {
  inner: string;
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const viewBoxMatch = svgText.match(/viewBox=["']([^"']+)["']/);
  if (!viewBoxMatch) {
    throw new Error("bg-dartboard.svg missing viewBox");
  }
  const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`invalid viewBox: ${viewBoxMatch[1]}`);
  }
  const [minX, minY, width, height] = parts;
  const inner = svgText
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
  return { inner, minX, minY, width, height };
}

/**
 * Build an opaque square SVG with the board centered and inset.
 */
function composeIconSvg(
  board: ReturnType<typeof parseBoardSvg>,
  size: number,
): string {
  const content = size * (1 - 2 * INSET);
  const scale = content / Math.max(board.width, board.height);
  const tx = size / 2;
  const ty = size / 2;
  // Board viewBox is centered on 0,0 already (−220..220).
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    ${board.inner}
  </g>
</svg>
`;
}

function renderPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  return Buffer.from(resvg.render().asPng());
}

async function main(): Promise<void> {
  const board = parseBoardSvg(readFileSync(sourcePath, "utf8"));

  const faviconSvg = composeIconSvg(board, 512);
  writeFileSync(resolve(publicDir, "favicon.svg"), faviconSvg);

  writeFileSync(
    resolve(publicDir, "apple-touch-icon.png"),
    renderPng(composeIconSvg(board, 180), 180),
  );
  writeFileSync(
    resolve(publicDir, "icon-192.png"),
    renderPng(composeIconSvg(board, 192), 192),
  );
  writeFileSync(
    resolve(publicDir, "icon-512.png"),
    renderPng(composeIconSvg(board, 512), 512),
  );

  const ico = await toIco([
    renderPng(composeIconSvg(board, 16), 16),
    renderPng(composeIconSvg(board, 32), 32),
  ]);
  writeFileSync(resolve(publicDir, "favicon.ico"), ico);

  console.log("Wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

If `to-ico` default import fails under NodeNext, switch to `import toIco from "to-ico"` vs `const toIco = (await import("to-ico")).default` — pick whichever typechecks.

- [ ] **Step 3: Wire npm script**

In `app/package.json` scripts:

```json
"icons:generate": "tsx scripts/generate-app-icons.ts"
```

- [ ] **Step 4: Run generator**

```bash
cd app && npm run icons:generate
```

Expected: stdout lists five files; `ls -la public/favicon.svg public/favicon.ico public/apple-touch-icon.png public/icon-192.png public/icon-512.png` all exist and are non-trivial size (PNG 192/512 ≫ 1KB; favicon.svg contains `#000000` and board paths).

- [ ] **Step 5: Smoke-check SVG composition**

```bash
rg -n '#000000|viewBox="0 0 512 512"' app/public/favicon.svg | head
file app/public/icon-512.png app/public/apple-touch-icon.png
```

Expected: black rect present; `file` reports PNG image data at 512×512 and 180×180.

- [ ] **Step 6: Commit** (only if user requested commits)

```bash
git add app/scripts/generate-app-icons.ts app/package.json app/package-lock.json \
  app/public/favicon.svg app/public/favicon.ico \
  app/public/apple-touch-icon.png app/public/icon-192.png app/public/icon-512.png
git commit -m "$(cat <<'EOF'
feat(app): generate dartboard favicon and PWA icons

EOF
)"
```

---

### Task 2: Wire BaseLayout + manifest

**Files:**
- Modify: `app/src/layouts/BaseLayout.astro`
- Modify: `app/public/manifest.json`

**Interfaces:**
- Consumes: public icons from Task 1
- Produces: browser tab + iOS + installable PWA icon wiring per spec §5

- [ ] **Step 1: Add apple-touch-icon to BaseLayout**

In `app/src/layouts/BaseLayout.astro`, after the existing `rel="icon"` links and before `rel="manifest"`, insert:

```astro
    <link
      rel="apple-touch-icon"
      href="/apple-touch-icon.png"
    />
```

Keep existing:

```astro
    <link
      rel="icon"
      type="image/svg+xml"
      href="/favicon.svg"
    />
    <link
      rel="icon"
      href="/favicon.ico"
    />
```

- [ ] **Step 2: Replace manifest icons**

Replace `app/public/manifest.json` entire file with:

```json
{
  "name": "Dart Analytics",
  "short_name": "Dart Analytics",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/favicon.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

- [ ] **Step 3: Verify head + manifest**

```bash
rg -n 'apple-touch-icon|favicon|manifest' app/src/layouts/BaseLayout.astro
python3 -m json.tool app/public/manifest.json > /dev/null && echo OK
```

Expected: apple-touch link present; JSON valid; no `favicon.ico` typed as `image/png`.

- [ ] **Step 4: Manual browser check**

With `npm run dev`: hard-refresh home — tab icon is dartboard-on-black (not Astro rocket). Inspect `<head>` for apple-touch-icon.

- [ ] **Step 5: Commit** (only if user requested)

```bash
git add app/src/layouts/BaseLayout.astro app/public/manifest.json
git commit -m "$(cat <<'EOF'
feat(app): wire apple-touch-icon and PWA manifest icons

EOF
)"
```

---

### Task 3: Logo lockup SVG generator + asset

**Files:**
- Create: `app/scripts/generate-logo-lockup.ts`
- Create: `app/scripts/assets/Michroma-Regular.ttf` (OFL)
- Create: `app/src/assets/logo-lockup.svg`
- Modify: `app/package.json` (`logo:generate` + `opentype.js` devDep)

**Interfaces:**
- Consumes: `bg-dartboard.svg`, Michroma TTF
- Produces: `app/src/assets/logo-lockup.svg` with `g#mark` + `g#wordmark` (paths only for text); npm `logo:generate`

- [ ] **Step 1: Install opentype + fetch font**

```bash
cd app
npm install -D opentype.js
mkdir -p scripts/assets
curl -fsSL -o scripts/assets/Michroma-Regular.ttf \
  "https://github.com/google/fonts/raw/main/ofl/michroma/Michroma-Regular.ttf"
file scripts/assets/Michroma-Regular.ttf
```

Expected: TrueType font; file size > 10KB. If GitHub raw fails, download the same OFL file from fonts.google.com and place at that path.

- [ ] **Step 2: Add `generate-logo-lockup.ts`**

Create `app/scripts/generate-logo-lockup.ts`:

```ts
/**
 * Build logo-lockup.svg: bg-dartboard mark + outlined Michroma "Darts"/"Analytics".
 * Spec: docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md
 *
 * Run: npm run logo:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const boardPath = resolve(appRoot, "src/assets/bg-dartboard.svg");
const fontPath = resolve(__dirname, "assets/Michroma-Regular.ttf");
const outPath = resolve(appRoot, "src/assets/logo-lockup.svg");

const ACCENT = "oklch(68.5% 0.169 237.323)";
const BOARD_PX = 80;
const FONT_SIZE = 24;
const GAP = 4;
const LINE_GAP = 4;

function boardInner(svgText: string): string {
  return svgText
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

function pathFromGlyphs(
  font: opentype.Font,
  text: string,
  fontSize: number,
  x: number,
  y: number,
): string {
  const path = font.getPath(text, x, y, fontSize);
  return path.toPathData(2);
}

function main(): void {
  const boardSvg = readFileSync(boardPath, "utf8");
  const font = opentype.parse(readFileSync(fontPath).buffer);
  // Board source viewBox is 440×440 centered on 0; scale into 80×80 box at origin.
  const boardScale = BOARD_PX / 440;
  const markX = BOARD_PX / 2;
  const markY = BOARD_PX / 2;

  const textX = BOARD_PX + GAP;
  const line1 = "Darts";
  const line2 = "Analytics";
  // Baseline: roughly center stack against 80px mark (Michroma metrics ~0.8 em).
  const stackHeight = FONT_SIZE * 2 + LINE_GAP;
  const firstBaseline = (BOARD_PX - stackHeight) / 2 + FONT_SIZE * 0.8;
  const secondBaseline = firstBaseline + FONT_SIZE + LINE_GAP;

  const d1 = pathFromGlyphs(font, line1, FONT_SIZE, textX, firstBaseline);
  const d2 = pathFromGlyphs(font, line2, FONT_SIZE, textX, secondBaseline);

  const textWidth = Math.max(
    font.getAdvanceWidth(line1, FONT_SIZE),
    font.getAdvanceWidth(line2, FONT_SIZE),
  );
  const width = Math.ceil(textX + textWidth);
  const height = BOARD_PX;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;display:block">
  <g id="mark" transform="translate(${markX} ${markY}) scale(${boardScale})">
    ${boardInner(boardSvg)}
  </g>
  <g id="wordmark" fill="${ACCENT}">
    <path d="${d1}"/>
    <path d="${d2}"/>
  </g>
</svg>
`;

  writeFileSync(outPath, svg);
  console.log(`Wrote ${outPath} (${width}×${height})`);
}

main();
```

Adjust baseline/gap constants after visual check in Step 4 until the lockup matches the HTML reference (board `size-20` + stacked `text-2xl`).

- [ ] **Step 3: Wire npm script**

```json
"logo:generate": "tsx scripts/generate-logo-lockup.ts"
```

- [ ] **Step 4: Generate + visual gate**

```bash
cd app && npm run logo:generate
rg -n '<text|id="mark"|id="wordmark"|oklch\\(68.5%' src/assets/logo-lockup.svg
```

Expected: no `<text`; both groups present; accent fill present. Open the SVG (or drop into a throwaway page) and compare to the current HTML lockup on `/`.

- [ ] **Step 5: Commit** (only if user requested)

```bash
git add app/scripts/generate-logo-lockup.ts app/scripts/assets/Michroma-Regular.ttf \
  app/src/assets/logo-lockup.svg app/package.json app/package-lock.json
git commit -m "$(cat <<'EOF'
feat(app): add outlined logo-lockup SVG generator

EOF
)"
```

---

### Task 4: Replace home + login lockups

**Files:**
- Modify: `app/src/pages/index.astro`
- Modify: `app/src/pages/login/index.astro`

**Interfaces:**
- Consumes: `app/src/assets/logo-lockup.svg`
- Produces: single-SVG lockups per spec §4 / §5 call-site rules

- [ ] **Step 1: Update home**

Replace the lockup block in `app/src/pages/index.astro` so the frontmatter imports `LogoLockup` and the brand block is:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import LogoutButton from "@components/ui/LogoutButton.astro";
import LogoLockup from "../assets/logo-lockup.svg";
---

<AppLayout title="Home">
  <div class="p-4 flex">
    <LogoutButton />
  </div>
  <div class="px-4">
    <LogoLockup
      aria-hidden="true"
      class="h-20 w-auto"
    />
    <article
      class="flex flex-col gap-2 px-2 text-sm text-muted-foreground space-y-4 pt-4"
    >
      <!-- keep existing paragraphs unchanged -->
```

Remove `DartboardTwo` import and the flex/text spans.

- [ ] **Step 2: Update login**

In `app/src/pages/login/index.astro`, replace board+text lockup with:

```astro
import LogoLockup from "../../assets/logo-lockup.svg";
```

```astro
        <div class="flex items-center justify-center">
          <LogoLockup
            role="img"
            aria-label="Darts Analytics"
            class="h-20 w-auto"
          />
        </div>
```

Remove `DartboardTwo` and the nested flex/text structure. Keep `space-y-12` on the glass card.

- [ ] **Step 3: Format + style gates**

```bash
cd app && npm run format
cd .. && bash scripts/check-style-tokens.sh
```

Expected: exit 0; no new prefix-`!` / leading-dash arbitrary.

- [ ] **Step 4: Visual check**

`npm run dev` → `/` and `/login` show lockup matching prior composition; tab icon still dartboard-on-black.

- [ ] **Step 5: Commit** (only if user requested)

```bash
git add app/src/pages/index.astro app/src/pages/login/index.astro
git commit -m "$(cat <<'EOF'
feat(ui): use logo-lockup SVG on home and login

EOF
)"
```

---

### Task 5: Context touch-up

**Files:**
- Modify: `docs/architecture/00-Context-Map.md` (inventory rows for the two scripts / public icons if the map lists similar assets)
- Modify: `app/README.md` only if it documents npm scripts — add `icons:generate` / `logo:generate` one-liners next to existing script docs
- Do **not** rewrite historical iOS auth plan; optional one-line note is unnecessary (spec already cites the gap)

**Interfaces:**
- Consumes: delivered scripts + assets
- Produces: discoverable regeneration commands for agents

- [ ] **Step 1: Register scripts in context map inventory**

Add short inventory rows (follow existing table style) for:

- `app/scripts/generate-app-icons.ts` — regenerate PWA/favicon from `bg-dartboard.svg`
- `app/scripts/generate-logo-lockup.ts` — regenerate outlined lockup SVG

- [ ] **Step 2: README script blurb (if scripts section exists)**

```markdown
npm run icons:generate   # favicon + apple-touch + PWA PNGs from bg-dartboard.svg
npm run logo:generate    # logo-lockup.svg (Michroma outlines)
```

- [ ] **Step 3: Run context-maintenance skill** before claiming done (graph refresh, agent mirrors if touched, etc.)

- [ ] **Step 4: Commit** (only if user requested)

```bash
git add docs/architecture/00-Context-Map.md app/README.md docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md docs/superpowers/plans/2026-07-31-brand-lockup-and-app-icons.md
git commit -m "$(cat <<'EOF'
docs: register brand lockup and app icon generators

EOF
)"
```

---

## Plan self-review

| Spec requirement | Task |
| ---------------- | ---- |
| `logo-lockup.svg` outlined composite | Task 3 |
| Replace home/login HTML lockups | Task 4 |
| Dark-square icons from `bg-dartboard` | Task 1 |
| Generator script + committed outputs | Task 1 |
| favicon.svg / ico / 180 / 192 / 512 | Task 1 |
| BaseLayout apple-touch + icon links | Task 2 |
| manifest icons + fix bad ico/png type | Task 2 |
| No maskable / OG / CI auto-gen | Global constraints |
| `bg-dartboard` unchanged as bg source | Tasks 1–4 leave BaseLayout bg import |

Placeholder scan: none. Names consistent (`icons:generate`, `logo:generate`, `logo-lockup.svg`).
