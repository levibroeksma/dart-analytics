import { UpdateRoutineRequest } from "./types";
import {
  deleteRoutine,
  getRoutine,
  replaceRoutine,
} from "@services/routine.service";
import { itemRoutes } from "@server/resource-routes";

export const { GET, PUT, DELETE } = itemRoutes({
  param: "routineId",
  get: getRoutine,
  replace: replaceRoutine,
  remove: deleteRoutine,
  updateSchema: UpdateRoutineRequest,
});
