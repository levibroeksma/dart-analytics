-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "schema_migrations" (
	"version" varchar PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_features" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_game_features_implementation_key" UNIQUE("implementation_key"),
	CONSTRAINT "chk_game_features_key_not_empty" CHECK (length(TRIM(BOTH FROM implementation_key)) > 0)
);
--> statement-breakpoint
CREATE TABLE "duration_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_duration_types_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "game_statuses" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_game_statuses_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "capture_modes" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_capture_modes_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "input_modes" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_input_modes_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "game_types" (
	"id" uuid PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_game_types_implementation_key" UNIQUE("implementation_key"),
	CONSTRAINT "chk_game_types_implementation_key_not_empty" CHECK (length(TRIM(BOTH FROM implementation_key)) > 0),
	CONSTRAINT "chk_game_types_name_not_empty" CHECK (length(TRIM(BOTH FROM name)) > 0)
);
--> statement-breakpoint
CREATE TABLE "dart_zones" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_dart_zones_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "ruleset_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_type_id" uuid NOT NULL,
	"implementation_key" text NOT NULL,
	"version_number" integer NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_ruleset_versions_key" UNIQUE("game_type_id","implementation_key"),
	CONSTRAINT "uq_ruleset_versions_number" UNIQUE("game_type_id","version_number"),
	CONSTRAINT "chk_ruleset_version_positive" CHECK (version_number > 0)
);
--> statement-breakpoint
CREATE TABLE "player_settings" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"default_capture_mode_id" smallint,
	"default_input_mode_id" smallint,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_players_auth_user_id" UNIQUE("auth_user_id"),
	CONSTRAINT "chk_players_display_name_not_empty" CHECK ((display_name IS NULL) OR (length(TRIM(BOTH FROM display_name)) > 0))
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"player_id" uuid NOT NULL,
	"status_id" smallint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_activity_completed_after_start" CHECK ((completed_at IS NULL) OR (completed_at >= started_at))
);
--> statement-breakpoint
CREATE TABLE "exercise_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"activity_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"game_type_id" uuid NOT NULL,
	"capture_mode_id" smallint NOT NULL,
	"input_mode_id" smallint NOT NULL,
	"status_id" smallint NOT NULL,
	"ruleset_version_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_session_completed_after_start" CHECK ((completed_at IS NULL) OR (completed_at >= started_at))
);
--> statement-breakpoint
CREATE TABLE "participant_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_participant_types_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "stage_types" (
	"id" smallint PRIMARY KEY NOT NULL,
	"implementation_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_stage_types_implementation_key" UNIQUE("implementation_key")
);
--> statement-breakpoint
CREATE TABLE "exercise_configurations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_session_id" uuid NOT NULL,
	"configuration" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_exercise_configuration_session" UNIQUE("exercise_session_id"),
	CONSTRAINT "chk_configuration_not_empty" CHECK (jsonb_typeof(configuration) = 'object'::text)
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_session_id" uuid NOT NULL,
	"participant_type_id" smallint NOT NULL,
	"player_id" uuid,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_participants_dartbot_display_name" CHECK ((participant_type_id <> 3) OR (display_name = 'DartBot'::text)),
	CONSTRAINT "chk_participants_player_type_has_player_id" CHECK ((participant_type_id <> 1) OR (player_id IS NOT NULL)),
	CONSTRAINT "chk_participants_non_player_type_has_null_player_id" CHECK ((participant_type_id = 1) OR (player_id IS NULL)),
	CONSTRAINT "chk_participant_identity" CHECK ((player_id IS NOT NULL) OR (display_name IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "exercise_stages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_session_id" uuid NOT NULL,
	"parent_stage_id" uuid,
	"stage_type_id" smallint NOT NULL,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_stage_sequence_positive" CHECK (sequence_number > 0),
	CONSTRAINT "chk_stage_not_self_parent" CHECK ((parent_stage_id IS NULL) OR (parent_stage_id <> id))
);
--> statement-breakpoint
CREATE TABLE "routine_steps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"routine_template_id" uuid NOT NULL,
	"exercise_template_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"duration_type_id" smallint NOT NULL,
	"duration_value" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_routine_steps_sequence" UNIQUE("routine_template_id","sequence_number"),
	CONSTRAINT "chk_routine_step_sequence_positive" CHECK (sequence_number > 0),
	CONSTRAINT "chk_routine_duration_positive" CHECK (duration_value > 0)
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"exercise_stage_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"total_score" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_turns_stage_participant_sequence" UNIQUE("exercise_stage_id","participant_id","sequence_number"),
	CONSTRAINT "chk_turn_sequence_positive" CHECK (sequence_number > 0),
	CONSTRAINT "chk_turn_completed_after_created" CHECK ((completed_at IS NULL) OR (completed_at >= created_at))
);
--> statement-breakpoint
CREATE TABLE "darts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"turn_id" uuid NOT NULL,
	"dart_number" smallint NOT NULL,
	"intended_target_number" smallint,
	"intended_zone_id" smallint,
	"hit_target_number" smallint,
	"hit_zone_id" smallint,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_darts_turn_number" UNIQUE("turn_id","dart_number"),
	CONSTRAINT "chk_dart_number" CHECK (dart_number > 0),
	CONSTRAINT "chk_intended_target" CHECK ((intended_target_number IS NULL) OR ((intended_target_number >= 1) AND (intended_target_number <= 25))),
	CONSTRAINT "chk_hit_target" CHECK ((hit_target_number IS NULL) OR ((hit_target_number >= 1) AND (hit_target_number <= 25))),
	CONSTRAINT "chk_dart_number_positive" CHECK (dart_number > 0),
	CONSTRAINT "chk_dart_score_positive" CHECK (score >= 0),
	CONSTRAINT "chk_dart_target_consistency" CHECK (((intended_zone_id IS NULL) AND (intended_target_number IS NULL)) OR (intended_zone_id IS NOT NULL)),
	CONSTRAINT "chk_hit_consistency" CHECK (((hit_zone_id IS NULL) AND (hit_target_number IS NULL)) OR (hit_zone_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "configuration_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_type_id" uuid NOT NULL,
	"player_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"configuration" jsonb NOT NULL,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_configuration_templates_name_not_empty" CHECK (length(TRIM(BOTH FROM name)) > 0),
	CONSTRAINT "chk_configuration_templates_object" CHECK (jsonb_typeof(configuration) = 'object'::text),
	CONSTRAINT "chk_configuration_templates_system_ownership" CHECK ((NOT is_system_template) OR (player_id IS NULL))
);
--> statement-breakpoint
CREATE TABLE "session_write_idempotency" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"normalized_payload_hash" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "uq_session_write_idempotency_session_key" UNIQUE("session_id","idempotency_key"),
	CONSTRAINT "chk_session_write_idempotency_result_is_object" CHECK (jsonb_typeof(result) = 'object'::text)
);
--> statement-breakpoint
CREATE TABLE "game_type_features" (
	"game_type_id" uuid NOT NULL,
	"game_feature_id" smallint NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "game_type_features_pkey" PRIMARY KEY("game_type_id","game_feature_id"),
	CONSTRAINT "uq_game_type_feature" UNIQUE("game_type_id","game_feature_id")
);
--> statement-breakpoint
ALTER TABLE "ruleset_versions" ADD CONSTRAINT "fk_ruleset_versions_game_type" FOREIGN KEY ("game_type_id") REFERENCES "public"."game_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_settings" ADD CONSTRAINT "fk_player_settings_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_templates" ADD CONSTRAINT "fk_exercise_templates_game_type" FOREIGN KEY ("game_type_id") REFERENCES "public"."game_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_templates" ADD CONSTRAINT "fk_routine_templates_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "fk_activities_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "fk_activities_status" FOREIGN KEY ("status_id") REFERENCES "public"."game_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_activity" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_game_type" FOREIGN KEY ("game_type_id") REFERENCES "public"."game_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_capture_mode" FOREIGN KEY ("capture_mode_id") REFERENCES "public"."capture_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_input_mode" FOREIGN KEY ("input_mode_id") REFERENCES "public"."input_modes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_status" FOREIGN KEY ("status_id") REFERENCES "public"."game_statuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_sessions" ADD CONSTRAINT "fk_sessions_ruleset" FOREIGN KEY ("ruleset_version_id") REFERENCES "public"."ruleset_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_configurations" ADD CONSTRAINT "fk_exercise_configuration_session" FOREIGN KEY ("exercise_session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "fk_participants_session" FOREIGN KEY ("exercise_session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "fk_participants_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "fk_participants_type" FOREIGN KEY ("participant_type_id") REFERENCES "public"."participant_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_stages" ADD CONSTRAINT "fk_stage_session" FOREIGN KEY ("exercise_session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_stages" ADD CONSTRAINT "fk_stage_parent" FOREIGN KEY ("parent_stage_id") REFERENCES "public"."exercise_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_stages" ADD CONSTRAINT "fk_stage_type" FOREIGN KEY ("stage_type_id") REFERENCES "public"."stage_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_steps" ADD CONSTRAINT "fk_routine_steps_routine" FOREIGN KEY ("routine_template_id") REFERENCES "public"."routine_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_steps" ADD CONSTRAINT "fk_routine_steps_exercise" FOREIGN KEY ("exercise_template_id") REFERENCES "public"."exercise_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_steps" ADD CONSTRAINT "fk_routine_steps_duration_type" FOREIGN KEY ("duration_type_id") REFERENCES "public"."duration_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "fk_turn_stage" FOREIGN KEY ("exercise_stage_id") REFERENCES "public"."exercise_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "fk_turn_participant" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darts" ADD CONSTRAINT "fk_darts_turn" FOREIGN KEY ("turn_id") REFERENCES "public"."turns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darts" ADD CONSTRAINT "fk_darts_intended_zone" FOREIGN KEY ("intended_zone_id") REFERENCES "public"."dart_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darts" ADD CONSTRAINT "fk_darts_hit_zone" FOREIGN KEY ("hit_zone_id") REFERENCES "public"."dart_zones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuration_templates" ADD CONSTRAINT "fk_configuration_templates_game_type" FOREIGN KEY ("game_type_id") REFERENCES "public"."game_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuration_templates" ADD CONSTRAINT "fk_configuration_templates_player" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_write_idempotency" ADD CONSTRAINT "fk_session_write_idempotency_session" FOREIGN KEY ("session_id") REFERENCES "public"."exercise_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_type_features" ADD CONSTRAINT "fk_game_type_features_game_type" FOREIGN KEY ("game_type_id") REFERENCES "public"."game_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_type_features" ADD CONSTRAINT "fk_game_type_features_feature" FOREIGN KEY ("game_feature_id") REFERENCES "public"."game_features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_game_types_published" ON "game_types" USING btree ("is_published" bool_ops) WHERE (is_published = true);--> statement-breakpoint
CREATE INDEX "idx_exercise_templates_game_type" ON "exercise_templates" USING btree ("game_type_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_activities_player_status" ON "activities" USING btree ("player_id" int2_ops,"status_id" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_sessions_active" ON "exercise_sessions" USING btree ("player_id" int2_ops,"status_id" uuid_ops) WHERE (completed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_sessions_activity" ON "exercise_sessions" USING btree ("activity_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_sessions_player_completed" ON "exercise_sessions" USING btree ("player_id" timestamptz_ops,"completed_at" uuid_ops) WHERE (completed_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_sessions_player_created" ON "exercise_sessions" USING btree ("player_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_single_active" ON "exercise_sessions" USING btree ("player_id" uuid_ops,"game_type_id" uuid_ops) WHERE (completed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_configuration_session" ON "exercise_configurations" USING btree ("exercise_session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_participants_session" ON "participants" USING btree ("exercise_session_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_stages_parent" ON "exercise_stages" USING btree ("parent_stage_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_stages_session_sequence" ON "exercise_stages" USING btree ("exercise_session_id" int4_ops,"sequence_number" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stages_root_sequence" ON "exercise_stages" USING btree ("exercise_session_id" int4_ops,"sequence_number" int4_ops) WHERE (parent_stage_id IS NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_stages_sibling_sequence" ON "exercise_stages" USING btree ("exercise_session_id" uuid_ops,"parent_stage_id" int4_ops,"sequence_number" int4_ops) WHERE (parent_stage_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_turns_participant" ON "turns" USING btree ("participant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_turns_stage_sequence" ON "turns" USING btree ("exercise_stage_id" int4_ops,"sequence_number" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_darts_hit_target" ON "darts" USING btree ("hit_target_number" int2_ops,"hit_zone_id" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_darts_intended_target" ON "darts" USING btree ("intended_target_number" int2_ops,"intended_zone_id" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_darts_zone_accuracy" ON "darts" USING btree ("intended_zone_id" int2_ops,"hit_zone_id" int2_ops);--> statement-breakpoint
CREATE INDEX "idx_configuration_templates_game_type" ON "configuration_templates" USING btree ("game_type_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_configuration_templates_player" ON "configuration_templates" USING btree ("player_id" uuid_ops) WHERE (player_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_game_type_features_game_type" ON "game_type_features" USING btree ("game_type_id" uuid_ops);--> statement-breakpoint
CREATE VIEW "public"."v_active_sessions" AS (SELECT es.id AS session_id, es.player_id, es.game_type_id, gt.implementation_key AS game_type_key, gt.name AS game_type_name, es.capture_mode_id, cm.implementation_key AS capture_mode_key, es.input_mode_id, im.implementation_key AS input_mode_key, es.ruleset_version_id, es.started_at FROM exercise_sessions es JOIN game_types gt ON gt.id = es.game_type_id JOIN capture_modes cm ON cm.id = es.capture_mode_id JOIN input_modes im ON im.id = es.input_mode_id JOIN game_statuses gs ON gs.id = es.status_id WHERE gs.implementation_key = 'ACTIVE'::text);--> statement-breakpoint
CREATE VIEW "public"."v_session_overview" AS (SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type, gt.name AS game_name, gs.implementation_key AS status, cm.implementation_key AS capture_mode, es.started_at, es.completed_at, EXTRACT(epoch FROM COALESCE(es.completed_at, now()) - es.started_at) AS duration_seconds FROM exercise_sessions es JOIN game_types gt ON gt.id = es.game_type_id JOIN game_statuses gs ON gs.id = es.status_id JOIN capture_modes cm ON cm.id = es.capture_mode_id);--> statement-breakpoint
CREATE VIEW "public"."v_game_replay" AS (SELECT es.id AS session_id, es.player_id, st.sequence_number AS stage_sequence, stg.implementation_key AS stage_type, t.sequence_number AS turn_sequence, p.display_name AS participant, d.dart_number, d.intended_target_number, dz1.implementation_key AS intended_zone, d.hit_target_number, dz2.implementation_key AS hit_zone, d.score FROM exercise_sessions es JOIN exercise_stages st ON st.exercise_session_id = es.id JOIN stage_types stg ON stg.id = st.stage_type_id JOIN turns t ON t.exercise_stage_id = st.id JOIN participants p ON p.id = t.participant_id JOIN darts d ON d.turn_id = t.id LEFT JOIN dart_zones dz1 ON dz1.id = d.intended_zone_id LEFT JOIN dart_zones dz2 ON dz2.id = d.hit_zone_id);--> statement-breakpoint
CREATE VIEW "public"."v_dart_analytics" AS (SELECT es.player_id, gt.implementation_key AS game_type, d.intended_target_number, intended_zone.implementation_key AS intended_zone, d.hit_target_number, hit_zone.implementation_key AS hit_zone, d.score, CASE WHEN d.intended_target_number = d.hit_target_number AND d.intended_zone_id = d.hit_zone_id THEN true ELSE false END AS exact_hit FROM darts d JOIN turns t ON t.id = d.turn_id JOIN exercise_stages st ON st.id = t.exercise_stage_id JOIN exercise_sessions es ON es.id = st.exercise_session_id JOIN game_types gt ON gt.id = es.game_type_id LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id WHERE d.intended_target_number IS NOT NULL AND d.intended_zone_id IS NOT NULL);--> statement-breakpoint
CREATE VIEW "public"."v_routine_execution" AS (SELECT rt.id AS routine_id, rt.name AS routine_name, rs.sequence_number, et.id AS exercise_template_id, et.name AS exercise_name, gt.implementation_key AS game_type, rs.duration_value, dt.implementation_key AS duration_type FROM routine_templates rt JOIN routine_steps rs ON rs.routine_template_id = rt.id JOIN exercise_templates et ON et.id = rs.exercise_template_id JOIN game_types gt ON gt.id = et.game_type_id JOIN duration_types dt ON dt.id = rs.duration_type_id);
*/