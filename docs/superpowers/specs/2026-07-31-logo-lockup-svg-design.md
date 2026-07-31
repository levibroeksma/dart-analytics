# Design — Brand Lockup SVG + App Icons

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-31.
> Scope: (1) replace the HTML brand lockup with one outlined SVG on home/login; (2) generate favicon + PWA / iOS Home Screen icons from `bg-dartboard.svg` and wire them.
> Relates to: `app/src/assets/bg-dartboard.svg`; `app/public/manifest.json`; `BaseLayout` icon/meta links; known iOS icon gap in `2026-07-29-ios-web-app-auth` plan.

---

## 1. Background & Motivation

### Lockup

Home and login compose the brand as HTML (`bg-dartboard` + Michroma wordmark). That is hard to reuse and font-dependent. Replace with one self-contained outlined SVG.

### App icons

Today:

- `app/public/favicon.svg` / `favicon.ico` are Astro defaults (not the dartboard)
- `manifest.json` only lists those two; `favicon.ico` is mis-typed as `image/png`
- `BaseLayout` has iOS web-app meta tags but **no** `<link rel="apple-touch-icon">`
- Prior iOS auth work explicitly deferred apple-touch PNG icons

Need: icons derived from `bg-dartboard.svg`, dark-square composition, wired for browser tab + install / Home Screen.

---

## 2. Decisions (brainstorming)

| Topic | Choice |
| ----- | ------ |
| Lockup purpose | **1** — replace HTML lockup (home + login) |
| Wordmark form | **2** — outlined paths (no live font) |
| Lockup color | **2** — baked accent for wordmark; board keeps `bg-dartboard` fills |
| Lockup composition | **A** — single composite SVG |
| Icon composition | **1** — full board centered on dark square |
| Icon generation | **2** — checked-in generator script; commit outputs under `app/public/` |

---

## 3. Scope

### In — lockup

- New asset: `app/src/assets/logo-lockup.svg`
- Board geometry/fills from `bg-dartboard.svg` + outlined Michroma “Darts” / “Analytics”
- Replace lockup markup in `index.astro` and `login/index.astro`

### In — app icons

- Generator script (repo or `app/scripts/`) that reads `app/src/assets/bg-dartboard.svg` and writes public icons
- Committed outputs under `app/public/`:
  - `favicon.svg` — board on dark square (SVG)
  - `favicon.ico` — multi-size ICO (at least 32×32; 16/32 preferred)
  - `apple-touch-icon.png` — 180×180
  - `icon-192.png` — 192×192
  - `icon-512.png` — 512×512
- Wire `BaseLayout.astro`:
  - keep `rel="icon"` for svg + ico
  - add `rel="apple-touch-icon"` → `/apple-touch-icon.png`
- Wire `manifest.json`:
  - correct types/sizes
  - include 192 + 512 (and svg if kept); `purpose: "any"` for the opaque PNGs
  - align `background_color` / `theme_color` with dark surface (`#000000` already OK)

### Out

- Changing `bg-dartboard.svg` geometry (source of truth for mark + icons)
- Monochrome / `currentColor` lockup
- Build-time-only icons (not committed)
- Maskable-safe-zone redesign (opaque dark square is the mask; no separate maskable asset in v1)
- Open Graph / social share images
- Auto-running the generator on every commit/CI (manual / documented npm script is enough)

---

## 4. Lockup — visual / call-site

Unchanged from prior approval:

| Element | Spec |
| ------- | ---- |
| Board | Same paths/fills as `bg-dartboard.svg` in ~80 unit square |
| Wordmark | Outlined “Darts” / “Analytics”, stacked, accent fill `oklch(68.5% 0.169 237.323)` |
| Font for outlining | Michroma |
| Call sites | Single `<LogoLockup />`; home may `aria-hidden`; login needs accessible name |

---

## 5. App icons — visual / generation contract

| Rule | Spec |
| ---- | ---- |
| Source | `app/src/assets/bg-dartboard.svg` |
| Canvas | Square; fill `#000000` (= `--surface` / manifest background) |
| Mark | Full board, centered, with padding (~10–12% inset so rings aren’t clipped by OS masks) |
| SVG favicon | Same composition as PNGs (dark square + board), not transparent-only |
| Tooling | Script under `app/scripts/` or repo `scripts/`; npm script e.g. `icons:generate`; deps only as needed (sharp / resvg / similar) — prefer one approach, document in script header |
| Re-run | After any intentional change to `bg-dartboard.svg`; commit regenerated public assets in the same change |

### Wiring (exact)

**`BaseLayout.astro` head:**

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.json" />
```

**`manifest.json` icons (minimum):**

| src | sizes | type | purpose |
| --- | ----- | ---- | ------- |
| `/favicon.svg` | `any` | `image/svg+xml` | `any` |
| `/icon-192.png` | `192x192` | `image/png` | `any` |
| `/icon-512.png` | `512x512` | `image/png` | `any` |

Drop the incorrect `favicon.ico` as `image/png` entry (ico stays via `<link rel="icon">` only), or list ico only if type is correct — prefer not listing ico in manifest when 192/512 PNGs exist.

---

## 6. Verification

**Lockup**

- Home + login match prior HTML lockup visually
- No live Michroma dependency for lockup glyph
- `bg-dartboard.svg` still used as BaseLayout background

**Icons**

- Tab favicon shows dartboard-on-black (not Astro default)
- `manifest.json` validates; installable PWA icon uses 192/512
- iOS Home Screen uses `apple-touch-icon` (not a page screenshot)
- Re-running `icons:generate` is idempotent aside from binary noise

**Shared**

- Format / style gates clean for touched text files

---

## 7. Open implementation notes

- Lockup path outlining method is free (no `<text>` in committed lockup).
- Icon rasterizer choice is free if outputs meet sizes + dark-square contract.
- Prefer grouped, readable SVG sources (`g#mark` / `g#wordmark`; favicon.svg readable).
- Optional follow-up (out of scope): `purpose: "maskable"` variant with extra safe padding.
