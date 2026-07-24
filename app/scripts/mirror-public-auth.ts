/**
 * Mirrors NEON_AUTH_BASE_URL → PUBLIC_NEON_AUTH_BASE_URL in a local env file.
 * Neon CLI env pull never writes the Astro PUBLIC_ key — run after checkout/pull.
 *
 * Run: npm run env:mirror
 *      npm run env:dev  (checkout + pull + mirror)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_KEY = "NEON_AUTH_BASE_URL";
const PUBLIC_KEY = "PUBLIC_NEON_AUTH_BASE_URL";

export type MirrorResult = {
  content: string;
  changed: boolean;
};

/**
 * Ensure PUBLIC_NEON_AUTH_BASE_URL matches NEON_AUTH_BASE_URL in env file text.
 */
export function mirrorPublicNeonAuthBaseUrl(envText: string): MirrorResult {
  const sourceMatch = envText.match(new RegExp(`^${SOURCE_KEY}=(.*)$`, "m"));
  if (!sourceMatch) {
    throw new Error(
      `${SOURCE_KEY} is missing — run neon checkout/env pull first.`,
    );
  }

  const sourceValue = sourceMatch[1].trim();
  const publicLine = `${PUBLIC_KEY}=${sourceValue}`;
  const publicMatch = envText.match(new RegExp(`^${PUBLIC_KEY}=(.*)$`, "m"));

  if (publicMatch) {
    const current = publicMatch[1].trim();
    if (current === sourceValue) {
      return { content: envText, changed: false };
    }
    return {
      content: envText.replace(publicMatch[0], publicLine),
      changed: true,
    };
  }

  const trimmed = envText.replace(/\s*$/, "");
  const content = `${trimmed}\n${publicLine}\n`;
  return { content, changed: true };
}

function parseFileArg(argv: string[]): string {
  const flagIndex = argv.indexOf("--file");
  if (flagIndex !== -1 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1];
  }
  return ".env";
}

function main(): void {
  const filePath = resolve(process.cwd(), parseFileArg(process.argv.slice(2)));
  const before = readFileSync(filePath, "utf8");
  const result = mirrorPublicNeonAuthBaseUrl(before);
  if (!result.changed) {
    console.log(`${PUBLIC_KEY} already mirrors ${SOURCE_KEY} in ${filePath}`);
    return;
  }
  writeFileSync(filePath, result.content, "utf8");
  console.log(`Mirrored ${SOURCE_KEY} → ${PUBLIC_KEY} in ${filePath}`);
}

if (!process.env.VITEST) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
