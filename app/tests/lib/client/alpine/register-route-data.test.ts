import { describe, it, expect, vi } from "vitest";
import type { Alpine } from "alpinejs";
import { registerRouteData } from "@lib/client/alpine/register-route-data";
import { quickSubtractPlay } from "@lib/training/trivia/quick-subtract-play.data";
import { routinePlay } from "@lib/training/routines/routine-play.data";
import { routineDetail } from "@lib/training/routines/routine-detail.data";
import { trainingIndex } from "@lib/training/routines/training-index.data";
import { statisticsRoutines } from "@lib/training/routines/statistics-routines.data";
import { scoreTrendSection } from "@lib/stats/sections/score-trend.data";
import { scoreHeatmapSection } from "@lib/stats/sections/score-heatmap.data";
import { scoreTrebleSection } from "@lib/stats/sections/score-treble.data";
import { scoreCompletionSection } from "@lib/stats/sections/score-completion.data";
import { scoreSessionList } from "@lib/stats/sections/score-session-list.data";
import { routineBuilder } from "@lib/training/routines/routine-builder.data";
import { schedulesIndex } from "@lib/training/schedules/schedules-index.data";
import { scheduleEditor } from "@lib/training/schedules/schedule-editor.data";
import { myScheduleForm } from "@lib/training/schedules/my-schedule.data";
import { homeWeek } from "@lib/training/schedules/home-week.data";

describe("registerRouteData", () => {
  it("registers quickSubtractPlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("quickSubtractPlay", quickSubtractPlay);
  });

  it("registers routinePlay as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("routinePlay", routinePlay);
  });

  it("registers routineDetail as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("routineDetail", routineDetail);
  });

  it("registers trainingIndex as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("trainingIndex", trainingIndex);
  });

  it("registers scoreTrendSection as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("scoreTrendSection", scoreTrendSection);
  });

  it("registers scoreHeatmapSection as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith(
      "scoreHeatmapSection",
      scoreHeatmapSection,
    );
  });

  it.each([
    ["scoreTrebleSection", scoreTrebleSection],
    ["scoreCompletionSection", scoreCompletionSection],
    ["scoreSessionList", scoreSessionList],
  ])("registers %s as an Alpine data factory", (name, factory) => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith(name, factory);
  });

  it("registers statisticsRoutines as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("statisticsRoutines", statisticsRoutines);
  });

  it("registers routineBuilder as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("routineBuilder", routineBuilder);
  });

  it("registers schedulesIndex as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("schedulesIndex", schedulesIndex);
  });

  it("registers scheduleEditor as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("scheduleEditor", scheduleEditor);
  });

  it("registers myScheduleForm as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("myScheduleForm", myScheduleForm);
  });

  it("registers homeWeek as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("homeWeek", homeWeek);
  });
});
