import type { GameTypeKey, Requirement, StatsTag } from "@lib/types";
import {
  STATS_TAGS,
  rulesetsOfGameType,
} from "@lib/game/rulesets/capabilities";
import { STEP_METRIC_SPECS } from "@modules/stats/step-metrics.module";
import type { DartExerciseKind } from "@modules/types";
import type {
  ComputeSite,
  ResultDirection,
  RoutineSectionId,
  RoutineSectionMeta,
  SectionId,
  SectionMeta,
} from "./types";

/** Either `intent-stored` (declared aims) or `intent-derived` (folded from the engine) satisfies the four widened board sections (phase-4 decision 5). */
const INTENT_ANY_OF: Requirement = {
  anyOf: ["intent-stored", "intent-derived"],
};

/** Overrides `computeSite` with `server` wherever a game's tags include `intent-derived` (phase-4 decision 5). */
const DERIVED_ON_SERVER: Partial<Record<StatsTag, ComputeSite>> = {
  "intent-derived": "server",
};

/**
 * Phase-1 through phase-4 sections, declared in catalog order
 * (`00-Overview.md` §2, `01-Section-Catalog.md` §1-2). `SECTIONS`' own
 * declaration order *is* page order, unless `PAGE_ORDER_OVERRIDES` names the
 * game — `sectionsForGame` applies the tag filter in declaration order, then
 * that override, rather than re-sorting.
 */
export const SECTIONS: Readonly<Record<SectionId, SectionMeta>> = {
  "scoring-trend": {
    id: "scoring-trend",
    version: 2,
    requires: ["scoring"],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "ladder-progress": {
    id: "ladder-progress",
    version: 1,
    requires: ["ladder"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: ["ruleset_version_key"],
    params: [],
  },
  "checkout-rate": {
    id: "checkout-rate",
    version: 1,
    requires: ["checkout"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "double-performance": {
    id: "double-performance",
    version: 1,
    requires: ["checkout"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "checkout-path": {
    id: "checkout-path",
    version: 1,
    requires: ["checkout"],
    computeSite: "server",
    bucketable: false,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "bust-rate": {
    id: "bust-rate",
    version: 1,
    requires: ["checkout"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "leg-stats": {
    id: "leg-stats",
    version: 2,
    requires: ["leg"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "treble-rate": {
    id: "treble-rate",
    version: 1,
    requires: ["scoring", "board"],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "atc-darts-per-target": {
    id: "atc-darts-per-target",
    version: 1,
    requires: ["intent-derived"],
    games: ["AROUND_THE_CLOCK"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: ["ruleset_version_key", "difficulty", "segment_rule"],
    params: [],
  },
  "training-result": {
    id: "training-result",
    version: 1,
    requires: [INTENT_ANY_OF],
    games: ["SINGLES_TRAINING", "DOUBLES_TRAINING"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: ["ruleset_version_key", "difficulty", "scoring_mode"],
    params: [],
  },
  "target-accuracy": {
    id: "target-accuracy",
    version: 1,
    requires: [INTENT_ANY_OF],
    siteByTag: DERIVED_ON_SERVER,
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "bobs27-survival": {
    id: "bobs27-survival",
    version: 1,
    requires: ["intent-stored"],
    games: ["BOBS27"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [
      "ruleset_version_key",
      "start_score",
      "miss_penalty_multiplier",
      "bull_hit_value",
    ],
    params: [],
  },
  "shanghai-count": {
    id: "shanghai-count",
    version: 1,
    requires: ["intent-derived"],
    games: ["SHANGHAI"],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  confusion: {
    id: "confusion",
    version: 1,
    requires: [INTENT_ANY_OF],
    siteByTag: DERIVED_ON_SERVER,
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
    requires: ["board", INTENT_ANY_OF],
    siteByTag: DERIVED_ON_SERVER,
    computeSite: "sql",
    bucketable: false,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
  },
  "loose-darts": {
    id: "loose-darts",
    version: 1,
    requires: ["board", INTENT_ANY_OF],
    siteByTag: DERIVED_ON_SERVER,
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
    version: 2,
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

/**
 * Above this many darts in a scoped range, a server-folded section refuses
 * the request (`00-Overview.md` §4). Lowered from a starting `20_000`: a synthetic worst-case TUOD log
 * (100-round sessions) measured `sessionCheckoutVisits` plus the six
 * server-section shapes at ~128ms total at `20_000`, well over the 50ms
 * budget; `5_000` measured ~30ms, with margin.
 */
export const MAX_FOLD_DARTS = 5_000;

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

function requirementMet(
  tags: Set<StatsTag>,
  requirement: Requirement,
): boolean {
  return typeof requirement === "string"
    ? tags.has(requirement)
    : requirement.anyOf.some((tag) => tags.has(tag));
}

function offersSection(
  tags: Set<StatsTag>,
  gameTypeKey: GameTypeKey,
  meta: SectionMeta,
): boolean {
  if (meta.games && !meta.games.includes(gameTypeKey)) return false;
  return meta.requires.every((requirement) =>
    requirementMet(tags, requirement),
  );
}

/**
 * Reorders a game's page after Shanghai's catalog order, which puts
 * `session-result` right after `shanghai-count` (`01-Section-Catalog.md` §2,
 * phase-4 decision 11). Every entry is a permutation of the tag- and
 * game-gated set for that game (`section-registry.test.ts` asserts this) —
 * an override can reorder a page but never add or drop a section from it.
 */
export const PAGE_ORDER_OVERRIDES: Partial<
  Record<GameTypeKey, readonly SectionId[]>
> = {
  SHANGHAI: [
    "target-accuracy",
    "shanghai-count",
    "session-result",
    "confusion",
    "miss-direction",
    "loose-darts",
    "heatmap",
    "completion",
    "volume",
  ],
};

/** Where a section's numbers are computed for a game: the first `siteByTag` entry whose tag the game carries, else `computeSite` (phase-4 decision 5). */
export function sectionSite(
  meta: SectionMeta,
  gameTypeKey: GameTypeKey,
): ComputeSite {
  const tags = tagsForGameType(gameTypeKey);
  for (const [tag, site] of Object.entries(meta.siteByTag ?? {})) {
    if (tags.has(tag as StatsTag)) return site as ComputeSite;
  }
  return meta.computeSite;
}

/**
 * A game page's sections, filtered to those whose `requires` and `games` the
 * game satisfies, in catalog order — then reordered by `PAGE_ORDER_OVERRIDES`
 * when the game has one.
 */
export function sectionsForGame(gameTypeKey: GameTypeKey): SectionId[] {
  const tags = tagsForGameType(gameTypeKey);
  const tagDerived = SECTION_IDS.filter((id) =>
    offersSection(tags, gameTypeKey, SECTIONS[id]),
  );
  return PAGE_ORDER_OVERRIDES[gameTypeKey]?.slice() ?? tagDerived;
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
 * session-result headline is phase-4 scope, not invented in phase 1. Singles
 * and Doubles Training stay `null` too: their headline and PB live in
 * `training-result` (D396), not in the rule-free `session-result`.
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

/**
 * The Routines tab's own registry, parallel to `SECTIONS` (D372 decision
 * 6). Declared in page order: the two run-level sections
 * (`sectionsForRoutine`'s own order), then the two step-level ones.
 */
export const ROUTINE_SECTIONS: Readonly<
  Record<RoutineSectionId, RoutineSectionMeta>
> = {
  "routine-volume": {
    id: "routine-volume",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
    surface: "routine",
  },
  "routine-completion": {
    id: "routine-completion",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: true,
    configSensitive: [],
    params: [],
    surface: "routine",
  },
  "step-volume": {
    id: "step-volume",
    version: 1,
    requires: [],
    computeSite: "sql",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
    surface: "step",
  },
  "step-result": {
    id: "step-result",
    version: 1,
    requires: [],
    computeSite: "server",
    bucketable: true,
    includesAbandoned: false,
    configSensitive: [],
    params: [],
    surface: "step",
  },
};

/** Whether `key` is one of `STEP_METRIC_SPECS`' seven dart exercise kinds (D372 decision 7), the only non-game steps `step-result` covers. Exported so a caller resolving one step's own kind (e.g. dispatching `step-result`) can narrow it the same way, instead of an unchecked cast. */
export function isDartExerciseKind(key: string): key is DartExerciseKind {
  return Object.hasOwn(STEP_METRIC_SPECS, key);
}

/** The routine picker's run-level sections, in page order (D372 decision 6). */
export function sectionsForRoutine(): RoutineSectionMeta[] {
  return [
    ROUTINE_SECTIONS["routine-volume"],
    ROUTINE_SECTIONS["routine-completion"],
  ];
}

/**
 * One routine step's sections (D372 decisions 5, 6): a GAME step
 * (`gameTypeKey` set) gets exactly its game's own
 * page, `sectionsForGame(gameTypeKey)` resolved to their `SECTIONS` metas —
 * `step-volume` is never added alongside it, since the game's own `volume`
 * section already covers that step's darts. A non-game step whose
 * `exerciseTypeKey` is one of `STEP_METRIC_SPECS`' seven dart exercise kinds
 * gets `step-result` and `step-volume`; every other non-game step
 * (Warm-Up, or a future non-dart exercise) gets `step-volume` alone.
 */
export function sectionsForStep(step: {
  exerciseTypeKey: string;
  gameTypeKey: GameTypeKey | null;
}):
  | { kind: "game"; gameTypeKey: GameTypeKey; sections: SectionMeta[] }
  | { kind: "exercise"; sections: RoutineSectionMeta[] } {
  if (step.gameTypeKey !== null) {
    return {
      kind: "game",
      gameTypeKey: step.gameTypeKey,
      sections: sectionsForGame(step.gameTypeKey).map((id) => SECTIONS[id]),
    };
  }
  if (isDartExerciseKind(step.exerciseTypeKey)) {
    return {
      kind: "exercise",
      sections: [
        ROUTINE_SECTIONS["step-result"],
        ROUTINE_SECTIONS["step-volume"],
      ],
    };
  }
  return { kind: "exercise", sections: [ROUTINE_SECTIONS["step-volume"]] };
}
