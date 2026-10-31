import { createPresetSetupController } from "@lib/game/setup-controller";
import type { FollowTheLeaderSetupContext } from "@lib/types";

/**
 * Follow the Leader setup controller: the preset controller with no per-seat
 * options. Start needs a guest seated; `start` is a no-op while blocked.
 */
export function followTheLeaderSetup() {
  const base = createPresetSetupController<FollowTheLeaderSetupContext>({
    gameTypeKey: "FOLLOW_THE_LEADER",
    rulesetVersionKey: "FOLLOW_THE_LEADER_V1",
    playHref: "/games/follow-the-leader/play",
    label: "Follow the Leader",
  });

  return {
    ...base,

    canStart(this: FollowTheLeaderSetupContext) {
      return this.guests.length > 0;
    },

    async start(this: FollowTheLeaderSetupContext) {
      if (!this.canStart()) return;
      await base.start.call(this);
    },
  };
}
