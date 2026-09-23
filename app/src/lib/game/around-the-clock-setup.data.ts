import { createPresetSetupController } from "@lib/game/setup-controller";
import {
  aroundTheClockDurationClampNotice,
  clampAroundTheClockDuration,
} from "@lib/game/around-the-clock-duration";
import type { AroundTheClockSetupContext } from "./types";

/** A timed run left blank starts at the spec's default length. */
const DEFAULT_MINUTES = 10;

const V2_DEFAULTS = {
  pathDirection: "LOW_TO_HIGH" as AroundTheClockSetupContext["pathDirection"],
  oddsFirst: false,
  segmentRule: "ANY" as AroundTheClockSetupContext["segmentRule"],
  difficulty: "EASY" as AroundTheClockSetupContext["difficulty"],
  durationType: "UNTIMED" as AroundTheClockSetupContext["durationType"],
  durationValue: null as AroundTheClockSetupContext["durationValue"],
};

/**
 * The six V2 wire keys from the form. A timed run's minutes (blank reads
 * as 10) are clamped into range first, written back to the form, and the clamp is announced.
 * Outer single only needs a board position, so outside ANALYTICS (where the
 * row is hidden) it is sent as `ANY` rather than refused by the validator.
 */
function v2Overrides(ctx: AroundTheClockSetupContext): Record<string, unknown> {
  let durationValue: number | null = null;
  ctx.clampNotice = "";
  if (ctx.durationType === "MINUTES") {
    const typed =
      ctx.durationValue === null || ctx.durationValue === ""
        ? DEFAULT_MINUTES
        : ctx.durationValue;
    const clamped = clampAroundTheClockDuration(typed);
    durationValue = clamped.value;
    ctx.durationValue = clamped.value;
    if (clamped.clamped) ctx.clampNotice = aroundTheClockDurationClampNotice();
  }
  return {
    path_direction: ctx.pathDirection,
    odds_first: ctx.oddsFirst,
    segment_rule:
      ctx.$store.settings.captureModeKey === "ANALYTICS"
        ? ctx.segmentRule
        : "ANY",
    difficulty: ctx.difficulty,
    duration_type: ctx.durationType,
    duration_value: durationValue,
  };
}

/**
 * Around the Clock setup. Solo and guest games start V2 with the form's
 * variants; a seated DartBot starts V1 (no V2 bot strategy), so seating one
 * resets the toggles. Timed 1v1 is deferred: seating a guest forces untimed.
 */
export function aroundTheClockSetup() {
  const controller = createPresetSetupController<AroundTheClockSetupContext>({
    gameTypeKey: "AROUND_THE_CLOCK",
    rulesetVersionKey: (ctx) =>
      ctx.bot ? "AROUND_THE_CLOCK_V1" : "AROUND_THE_CLOCK_V2",
    playHref: "/games/around-the-clock/play",
    label: "Around the Clock",
    configOverrides: (ctx) => (ctx.bot ? undefined : v2Overrides(ctx)),
  });
  return {
    ...V2_DEFAULTS,
    clampNotice: "",
    ...controller,
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
