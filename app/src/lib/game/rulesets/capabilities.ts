import type { RulesetVersionKey } from "@lib/types";
import type { ModePair } from "./types";

const QUICK_SCORE: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
};

const DETAILED_DARTS: ModePair = {
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
};

const VISUAL_BOARD: ModePair = {
  captureModeKey: "ANALYTICS",
  inputModeKey: "VISUAL_BOARD",
};

/**
 * Which capture/input mode combinations each ruleset version's engine actually
 * implements. This is the code-side source of truth. `createSession`
 * (`services/session.service.ts`) refuses an undeclared pair before any write,
 * `settings.service.ts` refuses an app mode no ruleset can play, and the games
 * page filters its cards on it through `lib/game/rulesets/games-visibility.ts`.
 *
 * `database/seeds/0007_ruleset_version_capabilities.sql` mirrors this table
 * into `ruleset_version_capabilities`, and a parity test proves the two agree.
 * Adding a pair here without adding the seed row leaves the database rejecting
 * sessions the code accepts.
 *
 * Each ruleset's `validateConfig` states the same thing independently, and is
 * deliberately not wired to this constant — one says what the system claims to
 * support, the other what a ruleset implements, and collapsing them would
 * destroy the cross-check. `capability-validator-parity.test.ts` proves they
 * agree in both directions.
 */
export const RULESET_CAPABILITIES: Readonly<
  Record<RulesetVersionKey, readonly ModePair[]>
> = {
  "501_V1": [QUICK_SCORE, VISUAL_BOARD],
  SCORE_TRAINING_V1: [QUICK_SCORE, VISUAL_BOARD],
  TUOD_V1: [QUICK_SCORE, VISUAL_BOARD],
  SINGLES_V1: [DETAILED_DARTS, VISUAL_BOARD],
  SINGLES_V2: [DETAILED_DARTS, VISUAL_BOARD],
  BOBS27_V1: [DETAILED_DARTS, VISUAL_BOARD],
  DOUBLES_TRAINING_V1: [DETAILED_DARTS, VISUAL_BOARD],
  SHANGHAI_V1: [DETAILED_DARTS, VISUAL_BOARD],
  SHANGHAI_V2: [DETAILED_DARTS, VISUAL_BOARD],
  "121_V1": [QUICK_SCORE, VISUAL_BOARD],
  "121_V2": [QUICK_SCORE, VISUAL_BOARD],
  AROUND_THE_CLOCK_V1: [DETAILED_DARTS, VISUAL_BOARD],
};

/** Whether this ruleset version's engine implements the given mode pair. */
export function supportsMode(
  rulesetVersionKey: RulesetVersionKey,
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  const pairs = RULESET_CAPABILITIES[rulesetVersionKey];
  if (!pairs) return false;
  return pairs.some(
    (pair) =>
      pair.captureModeKey === captureModeKey &&
      pair.inputModeKey === inputModeKey,
  );
}

/**
 * Whether this ruleset version's engine implements ANY mode pair under the
 * given capture mode — used only for games-page card visibility
 * (`games-visibility.ts`), where the two real app-mode settings
 * (`RECREATIONAL`+`QUICK_SCORE`, `ANALYTICS`+`VISUAL_BOARD`) don't always
 * match a ruleset's own declared input mode (e.g. `BOBS27_V1` declares
 * `RECREATIONAL`+`DETAILED_DARTS`, never `QUICK_SCORE`). `resolveSessionModePair`
 * already falls back to the ruleset's own first declared pair under an
 * unsupported exact pair, so a card visible here is always actually
 * startable. Exact-pair enforcement for session creation itself stays in
 * `supportsMode` (`session.service.ts`), unaffected by this helper.
 */
export function supportsCaptureMode(
  rulesetVersionKey: RulesetVersionKey,
  captureModeKey: string,
): boolean {
  const pairs = RULESET_CAPABILITIES[rulesetVersionKey];
  if (!pairs) return false;
  return pairs.some((pair) => pair.captureModeKey === captureModeKey);
}

/** Every ruleset version playable under the given mode pair. */
export function capableRulesets(
  captureModeKey: string,
  inputModeKey: string,
): readonly RulesetVersionKey[] {
  return (Object.keys(RULESET_CAPABILITIES) as RulesetVersionKey[]).filter(
    (key) => supportsMode(key, captureModeKey, inputModeKey),
  );
}

/**
 * Which ruleset versions currently admit a DartBot opponent seat. `08-DartBot.md`
 * §Delivery Phases names the five rulesets `DictatedStrategy` (phase 3) already
 * plays: Around the Clock, Bob's 27, Doubles Training, Shanghai, Singles
 * Training. Four are listed here — Shanghai V2 and Singles Training V2
 * can never create *any* 2-seat session today (`FINDINGS.md` F45: both setup
 * screens hardcode their V2 ruleset key with no seat-count branch, so a guest
 * add already 422s at `createSession`), and that gap is explicitly deferred,
 * not this map's to route around. 121 and Score Training still have no bot
 * strategy. Absent keys read as unsupported, exactly like `SEAT_CAPS`'s own
 * "no entry" default in `session-seats.service.ts`.
 */
export const RULESET_DARTBOT: Readonly<
  Partial<Record<RulesetVersionKey, boolean>>
> = {
  AROUND_THE_CLOCK_V1: true,
  BOBS27_V1: true,
  DOUBLES_TRAINING_V1: true,
  "501_V1": true,
};

/** Whether this ruleset version currently admits a DartBot opponent seat. */
export function supportsDartbot(rulesetVersionKey: RulesetVersionKey): boolean {
  return RULESET_DARTBOT[rulesetVersionKey] === true;
}

/**
 * The bot level (1–15, D-D's public knob) a new DartBot seat gets when the
 * setup screen's chooser offers no picker — `08-DartBot.md` §Skill Model
 * names 8 the default. Both the client (`guest-list.ts`'s `addBotOpponent`)
 * and the server (`session.service.ts`'s `buildSeatPlan`, the fallback for a
 * request that omits `level`) read this one constant.
 */
export const DEFAULT_BOT_LEVEL = 8;
