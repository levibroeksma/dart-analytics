import { UpdateScheduleRequest } from "@routes/types";
import {
  deleteSchedule,
  getSchedule,
  replaceSchedule,
} from "@services/schedule.service";
import { itemRoutes } from "@server/resource-routes";

export const { GET, PUT, DELETE } = itemRoutes({
  param: "scheduleId",
  get: getSchedule,
  replace: replaceSchedule,
  remove: deleteSchedule,
  updateSchema: UpdateScheduleRequest,
});
