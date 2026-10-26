import { createPresetSetupController } from "@lib/game/setup-controller";
import {
  AROUND_THE_CLOCK_DEFAULT_MINUTES,
  clampAroundTheClockDuration,
} from "@lib/game/around-the-clock-duration";
import { searchParamFromLocation } from "@lib/location";
import type { AroundTheClockSetupContext } from "./types";

const LIVES = 3;

const V2_DEFAULTS = {
  pathDirection: "LOW_TO_HIGH" as AroundTheClockSetupContext["pathDirection"],
  oddsFirst: false,
  segmentRule: "ANY" as AroundTheClockSetupContext["segmentRule"],
  difficulty: "EASY" as AroundTheClockSetupContext["difficulty"],
  durationType: "UNTIMED" as AroundTheClockSetupContext["durationType"],
  durationValue: null as AroundTheClockSetupContext["durationValue"],
  lives: false,
};

/**
 * The V2 wire keys from the form. Nine Lives locks the run to Easy untimed and
 * adds `lives`. A timed run's minutes (blank reads as 10) are clamped into
 * range first and written back to the form. Outer single only needs a board
 * position, so outside ANALYTICS (where the row is hidden) it is sent as `ANY`
 * rather than refused by the validator.
 */
function v2Overrides(ctx: AroundTheClockSetupContext): Record<string, unknown> {
  let durationValue: number | null = null;
  if (!ctx.lives && ctx.durationType === "MINUTES") {
    const typed =
      ctx.durationValue === null || ctx.durationValue === ""
        ? AROUND_THE_CLOCK_DEFAULT_MINUTES
        : ctx.durationValue;
    const clamped = clampAroundTheClockDuration(typed);
    durationValue = clamped.value;
    ctx.durationValue = clamped.value;
  }
  return {
    path_direction: ctx.pathDirection,
    odds_first: ctx.oddsFirst,
    segment_rule:
      ctx.$store.settings.captureModeKey === "ANALYTICS"
        ? ctx.segmentRule
        : "ANY",
    difficulty: ctx.lives ? "EASY" : ctx.difficulty,
    duration_type: ctx.lives ? "UNTIMED" : ctx.durationType,
    duration_value: durationValue,
    ...(ctx.lives ? { lives: LIVES } : {}),
  };
}

/**
 * Around the Clock setup. Solo and guest games start V2 with the form's
 * variants, or V3 (Nine Lives, solo or 1v1) when lives are on; a seated DartBot
 * starts V1 (no V2 bot strategy), so seating one
 * resets the toggles. Timed 1v1 is deferred: seating a guest forces untimed.
 */
export function aroundTheClockSetup() {
  const controller = createPresetSetupController<AroundTheClockSetupContext>({
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: (ctx) => {
      if (ctx.bot) return "AROUND_THE_CLOCK_V1";
      return ctx.lives ? "AROUND_THE_CLOCK_V3" : "AROUND_THE_CLOCK_V2";
    },
    playHref: "/games/around-the-clock/play",
    label: "Around the Clock",
    configOverrides: (ctx) => (ctx.bot ? undefined : v2Overrides(ctx)),
  });
  return {
    ...V2_DEFAULTS,
    ...controller,
    async init(this: AroundTheClockSetupContext) {
      this.lives = searchParamFromLocation("lives") === String(LIVES);
      await controller.init.call(this);
    },
    addGuest(this: AroundTheClockSetupContext) {
      controller.addGuest.call(this);
      if (this.guests.length > 0) {
        this.durationType = "UNTIMED";
        this.durationValue = null;
      }
    },
    addBot(this: AroundTheClockSetupContext) {
      controller.addBot.call(this);
      if (this.bot) Object.assign(this, V2_DEFAULTS);
    },
  };
}
