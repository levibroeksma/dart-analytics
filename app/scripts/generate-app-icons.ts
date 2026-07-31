/**
 * Build favicon + PWA / iOS icons from bg-dartboard.svg (dark square + centered board).
 * Spec: docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md
 *
 * Run: npm run icons:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { formatRgb, parse } from "culori";
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
function svgOklchToSrgb(svg: string): string {
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

function renderPng(svg: string, size: number): Buffer {
  const resvg = new Resvg(svgOklchToSrgb(svg), {
    fitTo: { mode: "width", value: size },
  });
  return Buffer.from(resvg.render().asPng());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterScanline(
  filter: number,
  row: Buffer,
  prev: Buffer,
  bpp: number,
): Buffer {
  const out = Buffer.from(row);
  switch (filter) {
    case 0:
      break;
    case 1:
      for (let i = bpp; i < out.length; i++) {
        out[i] = (out[i] + out[i - bpp]) & 0xff;
      }
      break;
    case 2:
      for (let i = 0; i < out.length; i++) {
        out[i] = (out[i] + prev[i]) & 0xff;
      }
      break;
    case 3:
      for (let i = 0; i < out.length; i++) {
        const left = i >= bpp ? out[i - bpp] : 0;
        const up = prev[i];
        out[i] = (out[i] + Math.floor((left + up) / 2)) & 0xff;
      }
      break;
    case 4:
      for (let i = 0; i < out.length; i++) {
        const left = i >= bpp ? out[i - bpp] : 0;
        const up = prev[i];
        const upLeft = i >= bpp ? prev[i - bpp] : 0;
        out[i] = (out[i] + paeth(left, up, upLeft)) & 0xff;
      }
      break;
    default:
      throw new Error(`unsupported PNG filter type: ${filter}`);
  }
  return out;
}

/**
 * Count RGBA pixels that are visible and not near-black (catches oklch raster failures).
 */
function countNonBlackPixels(png: Buffer): number {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }

  if (colorType !== 6) {
    throw new Error(`expected RGBA PNG (color type 6), got ${colorType}`);
  }

  const raw = inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const rowBytes = width * bpp;
  let nonBlack = 0;
  let pos = 0;
  let prev = Buffer.alloc(rowBytes);

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = unfilterScanline(
      filter,
      raw.subarray(pos, pos + rowBytes),
      prev,
      bpp,
    );
    prev = row;
    pos += rowBytes;

    for (let x = 0; x < width; x++) {
      const i = x * bpp;
      const r = row[i];
      const g = row[i + 1];
      const b = row[i + 2];
      const a = row[i + 3];
      if (a > 0 && (r > 10 || g > 10 || b > 10)) {
        nonBlack++;
      }
    }
  }

  return nonBlack;
}

function writePng(path: string, png: Buffer, label: string): void {
  const nonBlack = countNonBlackPixels(png);
  if (nonBlack === 0) {
    throw new Error(
      `${label}: raster is all black — oklch conversion may have failed`,
    );
  }
  writeFileSync(path, png);
  console.log(`  ${label}: ${nonBlack} non-black pixels, ${png.length} B`);
}

async function main(): Promise<void> {
  const board = parseBoardSvg(readFileSync(sourcePath, "utf8"));

  const faviconSvg = composeIconSvg(board, 512);
  writeFileSync(resolve(publicDir, "favicon.svg"), faviconSvg);

  writePng(
    resolve(publicDir, "apple-touch-icon.png"),
    renderPng(composeIconSvg(board, 180), 180),
    "apple-touch-icon.png",
  );
  writePng(
    resolve(publicDir, "icon-192.png"),
    renderPng(composeIconSvg(board, 192), 192),
    "icon-192.png",
  );
  writePng(
    resolve(publicDir, "icon-512.png"),
    renderPng(composeIconSvg(board, 512), 512),
    "icon-512.png",
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
