import { CreateRoutineRequest } from "./types";
import { createRoutine, listRoutines } from "@services/routine.service";
import { collectionRoutes } from "@server/resource-routes";

export const { GET, POST } = collectionRoutes({
  list: listRoutines,
  create: createRoutine,
  createSchema: CreateRoutineRequest,
});
