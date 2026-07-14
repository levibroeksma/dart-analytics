import { relations } from "drizzle-orm/relations";
import { gameTypes, rulesetVersions, players, playerSettings, exerciseTemplates, routineTemplates, activities, gameStatuses, exerciseSessions, captureModes, inputModes, exerciseConfigurations, participants, participantTypes, exerciseStages, stageTypes, routineSteps, durationTypes, turns, darts, dartZones, configurationTemplates, sessionWriteIdempotency, gameTypeFeatures, gameFeatures } from "./schema";

export const rulesetVersionsRelations = relations(rulesetVersions, ({one, many}) => ({
	gameType: one(gameTypes, {
		fields: [rulesetVersions.gameTypeId],
		references: [gameTypes.id]
	}),
	exerciseSessions: many(exerciseSessions),
}));

export const gameTypesRelations = relations(gameTypes, ({many}) => ({
	rulesetVersions: many(rulesetVersions),
	exerciseTemplates: many(exerciseTemplates),
	exerciseSessions: many(exerciseSessions),
	configurationTemplates: many(configurationTemplates),
	gameTypeFeatures: many(gameTypeFeatures),
}));

export const playerSettingsRelations = relations(playerSettings, ({one}) => ({
	player: one(players, {
		fields: [playerSettings.playerId],
		references: [players.id]
	}),
}));

export const playersRelations = relations(players, ({many}) => ({
	playerSettings: many(playerSettings),
	routineTemplates: many(routineTemplates),
	activities: many(activities),
	exerciseSessions: many(exerciseSessions),
	participants: many(participants),
	configurationTemplates: many(configurationTemplates),
}));

export const exerciseTemplatesRelations = relations(exerciseTemplates, ({one, many}) => ({
	gameType: one(gameTypes, {
		fields: [exerciseTemplates.gameTypeId],
		references: [gameTypes.id]
	}),
	routineSteps: many(routineSteps),
}));

export const routineTemplatesRelations = relations(routineTemplates, ({one, many}) => ({
	player: one(players, {
		fields: [routineTemplates.playerId],
		references: [players.id]
	}),
	routineSteps: many(routineSteps),
}));

export const activitiesRelations = relations(activities, ({one, many}) => ({
	player: one(players, {
		fields: [activities.playerId],
		references: [players.id]
	}),
	gameStatus: one(gameStatuses, {
		fields: [activities.statusId],
		references: [gameStatuses.id]
	}),
	exerciseSessions: many(exerciseSessions),
}));

export const gameStatusesRelations = relations(gameStatuses, ({many}) => ({
	activities: many(activities),
	exerciseSessions: many(exerciseSessions),
}));

export const exerciseSessionsRelations = relations(exerciseSessions, ({one, many}) => ({
	activity: one(activities, {
		fields: [exerciseSessions.activityId],
		references: [activities.id]
	}),
	player: one(players, {
		fields: [exerciseSessions.playerId],
		references: [players.id]
	}),
	gameType: one(gameTypes, {
		fields: [exerciseSessions.gameTypeId],
		references: [gameTypes.id]
	}),
	captureMode: one(captureModes, {
		fields: [exerciseSessions.captureModeId],
		references: [captureModes.id]
	}),
	inputMode: one(inputModes, {
		fields: [exerciseSessions.inputModeId],
		references: [inputModes.id]
	}),
	gameStatus: one(gameStatuses, {
		fields: [exerciseSessions.statusId],
		references: [gameStatuses.id]
	}),
	rulesetVersion: one(rulesetVersions, {
		fields: [exerciseSessions.rulesetVersionId],
		references: [rulesetVersions.id]
	}),
	exerciseConfigurations: many(exerciseConfigurations),
	participants: many(participants),
	exerciseStages: many(exerciseStages),
	sessionWriteIdempotencies: many(sessionWriteIdempotency),
}));

export const captureModesRelations = relations(captureModes, ({many}) => ({
	exerciseSessions: many(exerciseSessions),
}));

export const inputModesRelations = relations(inputModes, ({many}) => ({
	exerciseSessions: many(exerciseSessions),
}));

export const exerciseConfigurationsRelations = relations(exerciseConfigurations, ({one}) => ({
	exerciseSession: one(exerciseSessions, {
		fields: [exerciseConfigurations.exerciseSessionId],
		references: [exerciseSessions.id]
	}),
}));

export const participantsRelations = relations(participants, ({one, many}) => ({
	exerciseSession: one(exerciseSessions, {
		fields: [participants.exerciseSessionId],
		references: [exerciseSessions.id]
	}),
	player: one(players, {
		fields: [participants.playerId],
		references: [players.id]
	}),
	participantType: one(participantTypes, {
		fields: [participants.participantTypeId],
		references: [participantTypes.id]
	}),
	turns: many(turns),
}));

export const participantTypesRelations = relations(participantTypes, ({many}) => ({
	participants: many(participants),
}));

export const exerciseStagesRelations = relations(exerciseStages, ({one, many}) => ({
	exerciseSession: one(exerciseSessions, {
		fields: [exerciseStages.exerciseSessionId],
		references: [exerciseSessions.id]
	}),
	exerciseStage: one(exerciseStages, {
		fields: [exerciseStages.parentStageId],
		references: [exerciseStages.id],
		relationName: "exerciseStages_parentStageId_exerciseStages_id"
	}),
	exerciseStages: many(exerciseStages, {
		relationName: "exerciseStages_parentStageId_exerciseStages_id"
	}),
	stageType: one(stageTypes, {
		fields: [exerciseStages.stageTypeId],
		references: [stageTypes.id]
	}),
	turns: many(turns),
}));

export const stageTypesRelations = relations(stageTypes, ({many}) => ({
	exerciseStages: many(exerciseStages),
}));

export const routineStepsRelations = relations(routineSteps, ({one}) => ({
	routineTemplate: one(routineTemplates, {
		fields: [routineSteps.routineTemplateId],
		references: [routineTemplates.id]
	}),
	exerciseTemplate: one(exerciseTemplates, {
		fields: [routineSteps.exerciseTemplateId],
		references: [exerciseTemplates.id]
	}),
	durationType: one(durationTypes, {
		fields: [routineSteps.durationTypeId],
		references: [durationTypes.id]
	}),
}));

export const durationTypesRelations = relations(durationTypes, ({many}) => ({
	routineSteps: many(routineSteps),
}));

export const dartsRelations = relations(darts, ({one}) => ({
	turn: one(turns, {
		fields: [darts.turnId],
		references: [turns.id]
	}),
	dartZone_intendedZoneId: one(dartZones, {
		fields: [darts.intendedZoneId],
		references: [dartZones.id],
		relationName: "darts_intendedZoneId_dartZones_id"
	}),
	dartZone_hitZoneId: one(dartZones, {
		fields: [darts.hitZoneId],
		references: [dartZones.id],
		relationName: "darts_hitZoneId_dartZones_id"
	}),
}));

export const turnsRelations = relations(turns, ({one, many}) => ({
	darts: many(darts),
	exerciseStage: one(exerciseStages, {
		fields: [turns.exerciseStageId],
		references: [exerciseStages.id]
	}),
	participant: one(participants, {
		fields: [turns.participantId],
		references: [participants.id]
	}),
}));

export const dartZonesRelations = relations(dartZones, ({many}) => ({
	darts_intendedZoneId: many(darts, {
		relationName: "darts_intendedZoneId_dartZones_id"
	}),
	darts_hitZoneId: many(darts, {
		relationName: "darts_hitZoneId_dartZones_id"
	}),
}));

export const configurationTemplatesRelations = relations(configurationTemplates, ({one}) => ({
	gameType: one(gameTypes, {
		fields: [configurationTemplates.gameTypeId],
		references: [gameTypes.id]
	}),
	player: one(players, {
		fields: [configurationTemplates.playerId],
		references: [players.id]
	}),
}));

export const sessionWriteIdempotencyRelations = relations(sessionWriteIdempotency, ({one}) => ({
	exerciseSession: one(exerciseSessions, {
		fields: [sessionWriteIdempotency.sessionId],
		references: [exerciseSessions.id]
	}),
}));

export const gameTypeFeaturesRelations = relations(gameTypeFeatures, ({one}) => ({
	gameType: one(gameTypes, {
		fields: [gameTypeFeatures.gameTypeId],
		references: [gameTypes.id]
	}),
	gameFeature: one(gameFeatures, {
		fields: [gameTypeFeatures.gameFeatureId],
		references: [gameFeatures.id]
	}),
}));

export const gameFeaturesRelations = relations(gameFeatures, ({many}) => ({
	gameTypeFeatures: many(gameTypeFeatures),
}));