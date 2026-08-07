import { pgTable, varchar, unique, check, smallint, text, timestamp, index, uuid, boolean, foreignKey, integer, uniqueIndex, jsonb, primaryKey, pgView } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const schemaMigrations = pgTable("schema_migrations", {
	version: varchar().primaryKey().notNull(),
});

export const gameFeatures = pgTable("game_features", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_game_features_implementation_key").on(table.implementationKey),
	check("chk_game_features_key_not_empty", sql`length(TRIM(BOTH FROM implementation_key)) > 0`),
]);

export const durationTypes = pgTable("duration_types", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_duration_types_implementation_key").on(table.implementationKey),
]);

export const gameStatuses = pgTable("game_statuses", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_game_statuses_implementation_key").on(table.implementationKey),
]);

export const captureModes = pgTable("capture_modes", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_capture_modes_implementation_key").on(table.implementationKey),
]);

export const inputModes = pgTable("input_modes", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_input_modes_implementation_key").on(table.implementationKey),
]);

export const gameTypes = pgTable("game_types", {
	id: uuid().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	isPublished: boolean("is_published").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_game_types_published").using("btree", table.isPublished.asc().nullsLast().op("bool_ops")).where(sql`(is_published = true)`),
	unique("uq_game_types_implementation_key").on(table.implementationKey),
	check("chk_game_types_implementation_key_not_empty", sql`length(TRIM(BOTH FROM implementation_key)) > 0`),
	check("chk_game_types_name_not_empty", sql`length(TRIM(BOTH FROM name)) > 0`),
]);

export const dartZones = pgTable("dart_zones", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_dart_zones_implementation_key").on(table.implementationKey),
]);

export const rulesetVersions = pgTable("ruleset_versions", {
	id: uuid().primaryKey().notNull(),
	gameTypeId: uuid("game_type_id").notNull(),
	implementationKey: text("implementation_key").notNull(),
	versionNumber: integer("version_number").notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.gameTypeId],
			foreignColumns: [gameTypes.id],
			name: "fk_ruleset_versions_game_type"
		}).onDelete("restrict"),
	unique("uq_ruleset_versions_key").on(table.gameTypeId, table.implementationKey),
	unique("uq_ruleset_versions_number").on(table.gameTypeId, table.versionNumber),
	check("chk_ruleset_version_positive", sql`version_number > 0`),
]);

export const players = pgTable("players", {
	id: uuid().primaryKey().notNull(),
	authUserId: text("auth_user_id").notNull(),
	displayName: text("display_name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_players_auth_user_id").on(table.authUserId),
	check("chk_players_display_name_not_empty", sql`length(TRIM(BOTH FROM display_name)) > 0`),
]);

export const playerSettings = pgTable("player_settings", {
	playerId: uuid("player_id").primaryKey().notNull(),
	defaultCaptureModeId: smallint("default_capture_mode_id"),
	defaultInputModeId: smallint("default_input_mode_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_player_settings_player"
		}).onDelete("cascade"),
]);

export const exerciseTemplates = pgTable("exercise_templates", {
	id: uuid().primaryKey().notNull(),
	gameTypeId: uuid("game_type_id").notNull(),
	name: text().notNull(),
	description: text(),
	isSystemTemplate: boolean("is_system_template").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_exercise_templates_game_type").using("btree", table.gameTypeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.gameTypeId],
			foreignColumns: [gameTypes.id],
			name: "fk_exercise_templates_game_type"
		}).onDelete("restrict"),
]);

export const routineTemplates = pgTable("routine_templates", {
	id: uuid().primaryKey().notNull(),
	playerId: uuid("player_id"),
	name: text().notNull(),
	description: text(),
	isSystemTemplate: boolean("is_system_template").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_routine_templates_player"
		}).onDelete("cascade"),
]);

export const activities = pgTable("activities", {
	id: uuid().primaryKey().notNull(),
	playerId: uuid("player_id").notNull(),
	statusId: smallint("status_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_activities_player_status").using("btree", table.playerId.asc().nullsLast().op("int2_ops"), table.statusId.asc().nullsLast().op("int2_ops")),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_activities_player"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [gameStatuses.id],
			name: "fk_activities_status"
		}).onDelete("restrict"),
	check("chk_activity_completed_after_start", sql`(completed_at IS NULL) OR (completed_at >= started_at)`),
]);

export const exerciseSessions = pgTable("exercise_sessions", {
	id: uuid().primaryKey().notNull(),
	activityId: uuid("activity_id").notNull(),
	playerId: uuid("player_id").notNull(),
	gameTypeId: uuid("game_type_id").notNull(),
	captureModeId: smallint("capture_mode_id").notNull(),
	inputModeId: smallint("input_mode_id").notNull(),
	statusId: smallint("status_id").notNull(),
	rulesetVersionId: uuid("ruleset_version_id").notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_sessions_active").using("btree", table.playerId.asc().nullsLast().op("int2_ops"), table.statusId.asc().nullsLast().op("uuid_ops")).where(sql`(completed_at IS NULL)`),
	index("idx_sessions_activity").using("btree", table.activityId.asc().nullsLast().op("uuid_ops")),
	index("idx_sessions_player_completed").using("btree", table.playerId.asc().nullsLast().op("timestamptz_ops"), table.completedAt.desc().nullsFirst().op("uuid_ops")).where(sql`(completed_at IS NOT NULL)`),
	index("idx_sessions_player_created").using("btree", table.playerId.asc().nullsLast().op("uuid_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	uniqueIndex("uq_sessions_single_active").using("btree", table.playerId.asc().nullsLast().op("uuid_ops"), table.gameTypeId.asc().nullsLast().op("uuid_ops")).where(sql`(completed_at IS NULL)`),
	foreignKey({
			columns: [table.activityId],
			foreignColumns: [activities.id],
			name: "fk_sessions_activity"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_sessions_player"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gameTypeId],
			foreignColumns: [gameTypes.id],
			name: "fk_sessions_game_type"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.captureModeId],
			foreignColumns: [captureModes.id],
			name: "fk_sessions_capture_mode"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.inputModeId],
			foreignColumns: [inputModes.id],
			name: "fk_sessions_input_mode"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.statusId],
			foreignColumns: [gameStatuses.id],
			name: "fk_sessions_status"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.rulesetVersionId],
			foreignColumns: [rulesetVersions.id],
			name: "fk_sessions_ruleset"
		}).onDelete("restrict"),
	check("chk_session_completed_after_start", sql`(completed_at IS NULL) OR (completed_at >= started_at)`),
]);

export const participantTypes = pgTable("participant_types", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_participant_types_implementation_key").on(table.implementationKey),
]);

export const stageTypes = pgTable("stage_types", {
	id: smallint().primaryKey().notNull(),
	implementationKey: text("implementation_key").notNull(),
	name: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	unique("uq_stage_types_implementation_key").on(table.implementationKey),
]);

export const exerciseConfigurations = pgTable("exercise_configurations", {
	id: uuid().primaryKey().notNull(),
	exerciseSessionId: uuid("exercise_session_id").notNull(),
	configuration: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_configuration_session").using("btree", table.exerciseSessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.exerciseSessionId],
			foreignColumns: [exerciseSessions.id],
			name: "fk_exercise_configuration_session"
		}).onDelete("cascade"),
	unique("uq_exercise_configuration_session").on(table.exerciseSessionId),
	check("chk_configuration_not_empty", sql`jsonb_typeof(configuration) = 'object'::text`),
]);

export const participants = pgTable("participants", {
	id: uuid().primaryKey().notNull(),
	exerciseSessionId: uuid("exercise_session_id").notNull(),
	participantTypeId: smallint("participant_type_id").notNull(),
	playerId: uuid("player_id"),
	displayName: text("display_name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_participants_session").using("btree", table.exerciseSessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.exerciseSessionId],
			foreignColumns: [exerciseSessions.id],
			name: "fk_participants_session"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_participants_player"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.participantTypeId],
			foreignColumns: [participantTypes.id],
			name: "fk_participants_type"
		}).onDelete("restrict"),
	check("chk_participants_dartbot_display_name", sql`(participant_type_id <> 3) OR (display_name = 'DartBot'::text)`),
	check("chk_participants_player_type_has_player_id", sql`(participant_type_id <> 1) OR (player_id IS NOT NULL)`),
	check("chk_participants_non_player_type_has_null_player_id", sql`(participant_type_id = 1) OR (player_id IS NULL)`),
	check("chk_participant_identity", sql`(player_id IS NOT NULL) OR (display_name IS NOT NULL)`),
]);

export const exerciseStages = pgTable("exercise_stages", {
	id: uuid().primaryKey().notNull(),
	exerciseSessionId: uuid("exercise_session_id").notNull(),
	parentStageId: uuid("parent_stage_id"),
	stageTypeId: smallint("stage_type_id").notNull(),
	sequenceNumber: integer("sequence_number").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_stages_parent").using("btree", table.parentStageId.asc().nullsLast().op("uuid_ops")),
	index("idx_stages_session_sequence").using("btree", table.exerciseSessionId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("uq_stages_root_sequence").using("btree", table.exerciseSessionId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.asc().nullsLast().op("int4_ops")).where(sql`(parent_stage_id IS NULL)`),
	uniqueIndex("uq_stages_sibling_sequence").using("btree", table.exerciseSessionId.asc().nullsLast().op("uuid_ops"), table.parentStageId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.asc().nullsLast().op("int4_ops")).where(sql`(parent_stage_id IS NOT NULL)`),
	foreignKey({
			columns: [table.exerciseSessionId],
			foreignColumns: [exerciseSessions.id],
			name: "fk_stage_session"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentStageId],
			foreignColumns: [table.id],
			name: "fk_stage_parent"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.stageTypeId],
			foreignColumns: [stageTypes.id],
			name: "fk_stage_type"
		}).onDelete("restrict"),
	check("chk_stage_sequence_positive", sql`sequence_number > 0`),
	check("chk_stage_not_self_parent", sql`(parent_stage_id IS NULL) OR (parent_stage_id <> id)`),
]);

export const routineSteps = pgTable("routine_steps", {
	id: uuid().primaryKey().notNull(),
	routineTemplateId: uuid("routine_template_id").notNull(),
	exerciseTemplateId: uuid("exercise_template_id").notNull(),
	sequenceNumber: integer("sequence_number").notNull(),
	durationTypeId: smallint("duration_type_id").notNull(),
	durationValue: integer("duration_value").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.routineTemplateId],
			foreignColumns: [routineTemplates.id],
			name: "fk_routine_steps_routine"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.exerciseTemplateId],
			foreignColumns: [exerciseTemplates.id],
			name: "fk_routine_steps_exercise"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.durationTypeId],
			foreignColumns: [durationTypes.id],
			name: "fk_routine_steps_duration_type"
		}).onDelete("restrict"),
	unique("uq_routine_steps_sequence").on(table.routineTemplateId, table.sequenceNumber),
	check("chk_routine_step_sequence_positive", sql`sequence_number > 0`),
	check("chk_routine_duration_positive", sql`duration_value > 0`),
]);

export const darts = pgTable("darts", {
	id: uuid().primaryKey().notNull(),
	turnId: uuid("turn_id").notNull(),
	dartNumber: smallint("dart_number").notNull(),
	intendedTargetNumber: smallint("intended_target_number"),
	intendedZoneId: smallint("intended_zone_id"),
	hitTargetNumber: smallint("hit_target_number"),
	hitZoneId: smallint("hit_zone_id"),
	score: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_darts_hit_target").using("btree", table.hitTargetNumber.asc().nullsLast().op("int2_ops"), table.hitZoneId.asc().nullsLast().op("int2_ops")),
	index("idx_darts_intended_target").using("btree", table.intendedTargetNumber.asc().nullsLast().op("int2_ops"), table.intendedZoneId.asc().nullsLast().op("int2_ops")),
	index("idx_darts_zone_accuracy").using("btree", table.intendedZoneId.asc().nullsLast().op("int2_ops"), table.hitZoneId.asc().nullsLast().op("int2_ops")),
	foreignKey({
			columns: [table.turnId],
			foreignColumns: [turns.id],
			name: "fk_darts_turn"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.intendedZoneId],
			foreignColumns: [dartZones.id],
			name: "fk_darts_intended_zone"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.hitZoneId],
			foreignColumns: [dartZones.id],
			name: "fk_darts_hit_zone"
		}).onDelete("restrict"),
	unique("uq_darts_turn_number").on(table.turnId, table.dartNumber),
	check("chk_dart_number", sql`dart_number > 0`),
	check("chk_intended_target", sql`(intended_target_number IS NULL) OR ((intended_target_number >= 1) AND (intended_target_number <= 25))`),
	check("chk_hit_target", sql`(hit_target_number IS NULL) OR ((hit_target_number >= 1) AND (hit_target_number <= 25))`),
	check("chk_dart_number_positive", sql`dart_number > 0`),
	check("chk_dart_score_positive", sql`score >= 0`),
	check("chk_dart_target_consistency", sql`((intended_zone_id IS NULL) AND (intended_target_number IS NULL)) OR (intended_zone_id IS NOT NULL)`),
	check("chk_hit_consistency", sql`((hit_zone_id IS NULL) AND (hit_target_number IS NULL)) OR (hit_zone_id IS NOT NULL)`),
]);

export const turns = pgTable("turns", {
	id: uuid().primaryKey().notNull(),
	exerciseStageId: uuid("exercise_stage_id").notNull(),
	participantId: uuid("participant_id").notNull(),
	sequenceNumber: integer("sequence_number").notNull(),
	totalScore: integer("total_score").default(0).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_turns_participant").using("btree", table.participantId.asc().nullsLast().op("uuid_ops")),
	index("idx_turns_stage_sequence").using("btree", table.exerciseStageId.asc().nullsLast().op("int4_ops"), table.sequenceNumber.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.exerciseStageId],
			foreignColumns: [exerciseStages.id],
			name: "fk_turn_stage"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.participantId],
			foreignColumns: [participants.id],
			name: "fk_turn_participant"
		}).onDelete("restrict"),
	unique("uq_turns_stage_participant_sequence").on(table.exerciseStageId, table.participantId, table.sequenceNumber),
	check("chk_turn_sequence_positive", sql`sequence_number > 0`),
]);

export const configurationTemplates = pgTable("configuration_templates", {
	id: uuid().primaryKey().notNull(),
	gameTypeId: uuid("game_type_id").notNull(),
	playerId: uuid("player_id"),
	name: text().notNull(),
	description: text(),
	configuration: jsonb().notNull(),
	isSystemTemplate: boolean("is_system_template").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_configuration_templates_game_type").using("btree", table.gameTypeId.asc().nullsLast().op("uuid_ops")),
	index("idx_configuration_templates_player").using("btree", table.playerId.asc().nullsLast().op("uuid_ops")).where(sql`(player_id IS NOT NULL)`),
	foreignKey({
			columns: [table.gameTypeId],
			foreignColumns: [gameTypes.id],
			name: "fk_configuration_templates_game_type"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "fk_configuration_templates_player"
		}).onDelete("cascade"),
	check("chk_configuration_templates_name_not_empty", sql`length(TRIM(BOTH FROM name)) > 0`),
	check("chk_configuration_templates_object", sql`jsonb_typeof(configuration) = 'object'::text`),
	check("chk_configuration_templates_system_ownership", sql`(NOT is_system_template) OR (player_id IS NULL)`),
]);

export const sessionWriteIdempotency = pgTable("session_write_idempotency", {
	id: uuid().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	idempotencyKey: text("idempotency_key").notNull(),
	normalizedPayloadHash: text("normalized_payload_hash").notNull(),
	result: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [exerciseSessions.id],
			name: "fk_session_write_idempotency_session"
		}).onDelete("cascade"),
	unique("uq_session_write_idempotency_session_key").on(table.sessionId, table.idempotencyKey),
	check("chk_session_write_idempotency_result_is_object", sql`jsonb_typeof(result) = 'object'::text`),
]);

export const gameTypeFeatures = pgTable("game_type_features", {
	gameTypeId: uuid("game_type_id").notNull(),
	gameFeatureId: smallint("game_feature_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	index("idx_game_type_features_game_type").using("btree", table.gameTypeId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.gameTypeId],
			foreignColumns: [gameTypes.id],
			name: "fk_game_type_features_game_type"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gameFeatureId],
			foreignColumns: [gameFeatures.id],
			name: "fk_game_type_features_feature"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.gameTypeId, table.gameFeatureId], name: "game_type_features_pkey"}),
	unique("uq_game_type_feature").on(table.gameTypeId, table.gameFeatureId),
]);
export const vSessionOverview = pgView("v_session_overview", {	sessionId: uuid("session_id"),
	playerId: uuid("player_id"),
	gameTypeKey: text("game_type_key"),
	gameTypeName: text("game_type_name"),
	statusKey: text("status_key"),
	captureModeKey: text("capture_mode_key"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	durationSeconds: integer("duration_seconds"),
}).as(sql`SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type_key, gt.name AS game_type_name, gs.implementation_key AS status_key, cm.implementation_key AS capture_mode_key, es.started_at, es.completed_at, floor(EXTRACT(epoch FROM COALESCE(es.completed_at, now()) - es.started_at))::integer AS duration_seconds FROM exercise_sessions es JOIN game_types gt ON gt.id = es.game_type_id JOIN game_statuses gs ON gs.id = es.status_id JOIN capture_modes cm ON cm.id = es.capture_mode_id`);

export const vConfigurationPresets = pgView("v_configuration_presets", {	configurationTemplateId: uuid("configuration_template_id"),
	playerId: uuid("player_id"),
	gameTypeKey: text("game_type_key"),
	name: text(),
	description: text(),
	configuration: jsonb(),
	isSystemTemplate: boolean("is_system_template"),
}).as(sql`SELECT ct.id AS configuration_template_id, ct.player_id, gt.implementation_key AS game_type_key, ct.name, ct.description, ct.configuration, ct.is_system_template FROM configuration_templates ct JOIN game_types gt ON gt.id = ct.game_type_id`);

export const vActiveSessions = pgView("v_active_sessions", {	sessionId: uuid("session_id"),
	playerId: uuid("player_id"),
	gameTypeKey: text("game_type_key"),
	gameTypeName: text("game_type_name"),
	captureModeKey: text("capture_mode_key"),
	inputModeKey: text("input_mode_key"),
	rulesetVersionKey: text("ruleset_version_key"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
}).as(sql`SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type_key, gt.name AS game_type_name, cm.implementation_key AS capture_mode_key, im.implementation_key AS input_mode_key, rv.implementation_key AS ruleset_version_key, es.started_at FROM exercise_sessions es JOIN game_types gt ON gt.id = es.game_type_id JOIN capture_modes cm ON cm.id = es.capture_mode_id JOIN input_modes im ON im.id = es.input_mode_id JOIN ruleset_versions rv ON rv.id = es.ruleset_version_id JOIN game_statuses gs ON gs.id = es.status_id WHERE gs.implementation_key = 'ACTIVE'::text`);

export const vRoutineExecution = pgView("v_routine_execution", {	routineId: uuid("routine_id"),
	routineName: text("routine_name"),
	sequenceNumber: integer("sequence_number"),
	exerciseTemplateId: uuid("exercise_template_id"),
	exerciseName: text("exercise_name"),
	gameTypeKey: text("game_type_key"),
	durationValue: integer("duration_value"),
	durationTypeKey: text("duration_type_key"),
}).as(sql`SELECT rt.id AS routine_id, rt.name AS routine_name, rs.sequence_number, et.id AS exercise_template_id, et.name AS exercise_name, gt.implementation_key AS game_type_key, rs.duration_value, dt.implementation_key AS duration_type_key FROM routine_templates rt JOIN routine_steps rs ON rs.routine_template_id = rt.id JOIN exercise_templates et ON et.id = rs.exercise_template_id JOIN game_types gt ON gt.id = et.game_type_id JOIN duration_types dt ON dt.id = rs.duration_type_id`);

export const vDartAnalytics = pgView("v_dart_analytics", {	sessionId: uuid("session_id"),
	playerId: uuid("player_id"),
	gameTypeKey: text("game_type_key"),
	intendedTargetNumber: smallint("intended_target_number"),
	intendedZoneKey: text("intended_zone_key"),
	hitTargetNumber: smallint("hit_target_number"),
	hitZoneKey: text("hit_zone_key"),
	score: integer(),
	exactHit: boolean("exact_hit"),
}).as(sql`SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type_key, d.intended_target_number, intended_zone.implementation_key AS intended_zone_key, d.hit_target_number, hit_zone.implementation_key AS hit_zone_key, d.score, CASE WHEN d.intended_target_number = d.hit_target_number AND d.intended_zone_id = d.hit_zone_id THEN true ELSE false END AS exact_hit FROM darts d JOIN turns t ON t.id = d.turn_id JOIN exercise_stages st ON st.id = t.exercise_stage_id JOIN exercise_sessions es ON es.id = st.exercise_session_id JOIN game_types gt ON gt.id = es.game_type_id LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id WHERE d.intended_target_number IS NOT NULL AND d.intended_zone_id IS NOT NULL`);

export const vGameReplay = pgView("v_game_replay", {	sessionId: uuid("session_id"),
	playerId: uuid("player_id"),
	stageId: uuid("stage_id"),
	parentStageId: uuid("parent_stage_id"),
	stageSequence: integer("stage_sequence"),
	stageTypeKey: text("stage_type_key"),
	turnSequence: integer("turn_sequence"),
	participantName: text("participant_name"),
	turnTotalScore: integer("turn_total_score"),
	dartNumber: smallint("dart_number"),
	intendedTargetNumber: smallint("intended_target_number"),
	intendedZoneKey: text("intended_zone_key"),
	hitTargetNumber: smallint("hit_target_number"),
	hitZoneKey: text("hit_zone_key"),
	score: integer(),
}).as(sql`SELECT es.id AS session_id, es.player_id, st.id AS stage_id, st.parent_stage_id, st.sequence_number AS stage_sequence, stg.implementation_key AS stage_type_key, t.sequence_number AS turn_sequence, p.display_name AS participant_name, t.total_score AS turn_total_score, d.dart_number, d.intended_target_number, dz1.implementation_key AS intended_zone_key, d.hit_target_number, dz2.implementation_key AS hit_zone_key, d.score FROM exercise_sessions es JOIN exercise_stages st ON st.exercise_session_id = es.id JOIN stage_types stg ON stg.id = st.stage_type_id JOIN turns t ON t.exercise_stage_id = st.id JOIN participants p ON p.id = t.participant_id LEFT JOIN darts d ON d.turn_id = t.id LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id`);