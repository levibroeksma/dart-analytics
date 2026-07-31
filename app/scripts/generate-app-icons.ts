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

  console.log(
    "Wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
