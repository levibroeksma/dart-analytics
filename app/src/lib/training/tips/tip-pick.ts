import { GENERAL_TIPS, KEY_TIPS } from "./tips";

const TIP_BASE_MS = 2500;
const TIP_PER_CHAR_MS = 60;
const TIP_MIN_MS = 5000;
const TIP_MAX_MS = 12000;
export const TIP_MAX_CHARS = 120;

const KEY_TIP_SHARE = 2 / 3;

/** The tips family of a ruleset, exercise or routine game-step key. */
export function tipFamily(key: string | null | undefined): string {
  if (!key) return "";
  return key.replace(/^GAME:/, "").replace(/_V\d+$/, "");
}

/** The key-specific tips for a key, or an empty list. */
export function tipsFor(key: string | null | undefined): readonly string[] {
  return KEY_TIPS[tipFamily(key)] ?? [];
}

/** Picks a tip: a key tip in 2 of 3 draws, never the previous tip unless it is the only one. */
export function pickTip(
  key: string | null | undefined,
  previous: string | null,
  random: () => number = Math.random,
  general: readonly string[] = GENERAL_TIPS,
): string {
  const keyed = tipsFor(key);
  const pool = random() < KEY_TIP_SHARE && keyed.length > 0 ? keyed : general;
  const fresh = pool.filter((tip) => tip !== previous);
  const choices = fresh.length > 0 ? fresh : pool;
  return choices[Math.floor(random() * choices.length)];
}

/** How long a tip stays on screen, by its length. */
export function tipDisplayMs(tip: string): number {
  const ms = TIP_BASE_MS + TIP_PER_CHAR_MS * tip.length;
  return Math.min(TIP_MAX_MS, Math.max(TIP_MIN_MS, ms));
}
