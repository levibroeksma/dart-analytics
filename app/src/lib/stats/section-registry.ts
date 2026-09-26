import type { GameTypeKey } from "@lib/types";
import type { ResultDirection, SectionId, SectionMeta } from "./types";

/**
 * Phase-1 sections in catalog order (`10-Statistics/01-Section-Catalog.md`
 * §1). `requires: []` — the "any" tier every game qualifies for — since none
 * of the three needs a capability tag.
 */
export const SECTIONS: Readonly<Record<SectionId, SectionMeta>> = {
  "session-result": {
    id: "session-result",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: ["ruleset_version_key"],
  },
  completion: {
    id: "completion",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: true,
    configSensitive: [],
  },
  volume: {
    id: "volume",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
  },
};

const SECTION_IDS = Object.keys(SECTIONS) as SectionId[];

/** Whether a string is a phase-built section id. */
export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

/** A game page's sections, in catalog order. Every phase-1 section applies to every game (`requires: []`). */
export function sectionsForGame(_gameTypeKey: GameTypeKey): SectionId[] {
  return [...SECTION_IDS];
}

/**
 * Which extreme of a session's rule-free `counted_score` is the personal
 * best, per game (D367). `null` means the game's actual headline result is
 * not a pure function of `counted_score`/`dart_count`/`turn_count`, so the
 * UI shows sums with no PB line until a game-specific section exists
 * (phase 4). Reasoning per game, verified against each engine module:
 *
 * | Game | What `turns.total_score` holds | Pure function of the rule-free sums? |
 * | ---- | ------------------------------ | ------------------------------------- |
 * | 501 | points scored off the remaining-score ladder per visit | no — the headline is darts-per-leg/average, which needs leg boundaries `v_stats_session_facts` does not carry |
 * | Ten Up One Down | 0 unless the visit itself scored (`foldTuodState`) | no — the headline is the ladder height reached, not a score sum |
 * | 121 | points scored off the countdown ladder per visit (`deriveClosedSeatState`) | no — same ladder-fold shape as 501 |
 * | Score Training | every dart's face value, summed per visit (`foldScoreTrainingState`) | yes — the headline *is* the total score; higher is better |
 * | Singles Training | the dart's board score; the ring-quality training point that decides the match is a separate fold (`singles-training.engine.module.ts`) | no — `counted_score` is not the match's scoring signal |
 * | Doubles Training | same shape as Singles: the match is decided by most-doubles-hit, not `turns.total_score` (`doubles-training.engine.module.ts`) | no |
 * | Bob's 27 | the dart's board score; survival progress is a separate running `score` the fact never exposes (`bobs27.engine.module.ts`) | no |
 * | Shanghai | the dart's board score, halved under the swindle rule (`foldShanghaiState`); the catalog's own headline is points-per-round | yes — `countedScore` is exactly that numerator; higher is better |
 * | Around the Clock | the dart's board score; the match is decided by fewest darts to finish the circuit (`around-the-clock.engine.module.ts`) | no |
 *
 * Every `null` here is filed as `discovered-work` (D367): a game-specific
 * session-result headline is phase-4 scope, not invented in phase 1.
 */
export const RESULT_DIRECTION: Readonly<Record<GameTypeKey, ResultDirection>> =
  {
    "501": null,
    TUOD: null,
    ONE_TWENTY_ONE: null,
    SCORE_TRAINING: "higher",
    SINGLES_TRAINING: null,
    DOUBLES_TRAINING: null,
    BOBS27: null,
    SHANGHAI: "higher",
    AROUND_THE_CLOCK: null,
  };
