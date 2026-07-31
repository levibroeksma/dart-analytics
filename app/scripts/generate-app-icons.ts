/**
 * Build favicon + PWA / iOS icons from bg-dartboard.svg (dark square + centered board).
 * Spec: docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md
 * Decision: D176
 *
 * Run: npm run icons:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { formatRgb, parse } from "culori";

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
  const [, , width, height] = parts;
  const inner = svgText
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
  return { inner, width, height };
}

/**
 * Resvg does not rasterize oklch(); convert fills/strokes to sRGB before PNG export.
 */
export function svgOklchToSrgb(svg: string): string {
  return svg.replace(/oklch\([^)]+\)/gi, (match) => {
    const color = parse(match);
    if (!color) {
      throw new Error(`failed to parse color: ${match}`);
    }
    return formatRgb(color);
  });
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    ${board.inner}
  </g>
</svg>
`;
}

/**
 * Count visible non-near-black RGBA pixels (catches oklch raster failures).
 *
 * @param pixels - Packed RGBA bytes from Resvg.
 * @returns Count of pixels that are both opaque enough and not near-black.
 */
export function countNonBlackRgba(pixels: Uint8Array): number {
  let nonBlack = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a > 0 && (r > 10 || g > 10 || b > 10)) {
      nonBlack++;
    }
  }
  return nonBlack;
}

/**
 * Reject a raster whose visible pixels are all near-black.
 *
 * @param pixels - Packed RGBA bytes.
 * @param label - Asset name used in errors and logs.
 * @returns Count of visible non-black pixels.
 */
export function assertNonBlackRgba(pixels: Uint8Array, label: string): number {
  const nonBlack = countNonBlackRgba(pixels);
  if (nonBlack === 0) {
    throw new Error(
      `${label}: raster is all black — oklch conversion may have failed`,
    );
  }
  return nonBlack;
}

function renderPng(svg: string, size: number, label: string): Buffer {
  const resvg = new Resvg(svgOklchToSrgb(svg), {
    fitTo: { mode: "width", value: size },
  });
  const image = resvg.render();
  const nonBlack = assertNonBlackRgba(image.pixels, label);
  const png = Buffer.from(image.asPng());
  console.log(`  ${label}: ${nonBlack} non-black pixels, ${png.length} B`);
  return png;
}

/**
 * Package PNG frames into an ICO directory without transcoding them.
 *
 * @param frames - Square PNG frames and their pixel sizes.
 * @returns ICO file bytes.
 */
export function createIco(
  frames: ReadonlyArray<{ size: number; png: Buffer }>,
): Buffer {
  const directorySize = 6 + frames.length * 16;
  const header = Buffer.alloc(directorySize);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let dataOffset = directorySize;
  frames.forEach(({ size, png }, index) => {
    const entryOffset = 6 + index * 16;
    header[entryOffset] = size === 256 ? 0 : size;
    header[entryOffset + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(png.length, entryOffset + 8);
    header.writeUInt32LE(dataOffset, entryOffset + 12);
    dataOffset += png.length;
  });

  return Buffer.concat([header, ...frames.map(({ png }) => png)]);
}

function main(): void {
  const board = parseBoardSvg(readFileSync(sourcePath, "utf8"));

  const faviconSvg = composeIconSvg(board, 512);
  writeFileSync(resolve(publicDir, "favicon.svg"), faviconSvg);

  writeFileSync(
    resolve(publicDir, "apple-touch-icon.png"),
    renderPng(composeIconSvg(board, 180), 180, "apple-touch-icon.png"),
  );
  writeFileSync(
    resolve(publicDir, "icon-192.png"),
    renderPng(composeIconSvg(board, 192), 192, "icon-192.png"),
  );
  writeFileSync(
    resolve(publicDir, "icon-512.png"),
    renderPng(composeIconSvg(board, 512), 512, "icon-512.png"),
  );

  const ico = createIco([
    {
      size: 16,
      png: renderPng(composeIconSvg(board, 16), 16, "favicon-16.png"),
    },
    {
      size: 32,
      png: renderPng(composeIconSvg(board, 32), 32, "favicon-32.png"),
    },
  ]);
  writeFileSync(resolve(publicDir, "favicon.ico"), ico);

  console.log(
    "Wrote favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
