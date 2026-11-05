import { CreateScheduleRequest } from "./types";
import { createSchedule, listSchedules } from "@services/schedule.service";
import { collectionRoutes } from "@server/resource-routes";

export const { GET, POST } = collectionRoutes({
  list: listSchedules,
  create: createSchedule,
  createSchema: CreateScheduleRequest,
});
