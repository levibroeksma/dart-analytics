import type { GameTypeKey, StatsTag } from "@lib/types";
import {
  STATS_TAGS,
  rulesetsOfGameType,
} from "@lib/game/rulesets/capabilities";
import type { ResultDirection, SectionId, SectionMeta } from "./types";

/**
 * Phase-1 and phase-2 sections, declared in catalog order (`00-Overview.md`
 * §2, `01-Section-Catalog.md` §1-2). `SECTIONS`' own declaration order *is*
 * page order — `sectionsForGame` preserves it rather than re-sorting.
 * Phase 4 revisits this for Shanghai, whose catalog order puts
 * `session-result` before `confusion`.
 */
export const SECTIONS: Readonly<Record<SectionId, SectionMeta>> = {
  "target-accuracy": {
    id: "target-accuracy",
    version: 1,
    requires: ["intent-stored"],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  confusion: {
    id: "confusion",
    version: 1,
    requires: ["intent-stored"],
    computeSite: "sql",
    bucketable: false,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  grouping: {
    id: "grouping",
    version: 1,
    requires: ["board", "intent-stored"],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "miss-direction": {
    id: "miss-direction",
    version: 1,
    requires: ["board", "intent-stored"],
    computeSite: "sql",
    bucketable: false,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "loose-darts": {
    id: "loose-darts",
    version: 1,
    requires: ["board", "intent-stored"],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  heatmap: {
    id: "heatmap",
    version: 1,
    requires: ["board"],
    computeSite: "sql",
    bucketable: false,
    includesAbandoned: false,
    configSensitive: [],
    params: ["target"],
  },
  "session-result": {
    id: "session-result",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: ["ruleset_version_key"],
    params: [],
  },
  completion: {
    id: "completion",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: true,
    configSensitive: [],
    params: [],
  },
  volume: {
    id: "volume",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
};

const SECTION_IDS = Object.keys(SECTIONS) as SectionId[];

/** Whether a string is a phase-built section id. */
export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

/** The union of every stats tag a game type's ruleset versions produce. */
export function tagsForGameType(gameTypeKey: GameTypeKey): Set<StatsTag> {
  const tags = new Set<StatsTag>();
  for (const rulesetVersionKey of rulesetsOfGameType(gameTypeKey)) {
    for (const tag of STATS_TAGS[rulesetVersionKey]) tags.add(tag);
  }
  return tags;
}

function offersSection(tags: Set<StatsTag>, meta: SectionMeta): boolean {
  return meta.requires.every((tag) => tags.has(tag));
}

/** A game page's sections, in catalog order, filtered to those whose `requires` the game's tags satisfy. */
export function sectionsForGame(gameTypeKey: GameTypeKey): SectionId[] {
  const tags = tagsForGameType(gameTypeKey);
  return SECTION_IDS.filter((id) => offersSection(tags, SECTIONS[id]));
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
