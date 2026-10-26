-- GENERATED — do not edit. Run `npm run tags:generate` (app/).
-- Source: docs/game-rules/TAGS.md and the `## Tags` tables of the playable
-- rules files. Drift is gated by `npm run tags:generate -- --check`.
-- Idempotent: lookups upsert by id; link tables are cleared and refilled.
BEGIN;

INSERT INTO tag_axes (id, implementation_key, name, created_at, updated_at) VALUES
  (1, 'SKILL', 'Skill', now(), now()),
  (2, 'SESSION_ROLE', 'Session role', now(), now()),
  (3, 'FORMAT', 'Format', now(), now()),
  (4, 'DIFFICULTY', 'Difficulty', now(), now()),
  (5, 'MECHANIC', 'Mechanic', now(), now()),
  (6, 'PRESSURE', 'Pressure', now(), now()),
  (7, 'FAMILY', 'Family', now(), now())
ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, updated_at = now();

INSERT INTO tag_contexts (id, implementation_key, name, created_at, updated_at) VALUES
  (1, 'STANDALONE', 'Standalone', now(), now()),
  (2, 'ROUTINE_STEP', 'Routine step', now(), now())
ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, updated_at = now();

INSERT INTO tags (id, tag_axis_id, implementation_key, name, sort_order, created_at, updated_at) VALUES
  (1, 1, 'SCORING', 'Scoring', 1, now(), now()),
  (2, 1, 'SWITCHING', 'Switching', 2, now(), now()),
  (3, 1, 'DOUBLES', 'Doubles', 3, now(), now()),
  (4, 1, 'CHECKOUT', 'Checkout', 4, now(), now()),
  (5, 1, 'BULL', 'Bull', 5, now(), now()),
  (6, 1, 'ACCURACY', 'Accuracy', 6, now(), now()),
  (7, 1, 'CONTROL', 'Control', 7, now(), now()),
  (8, 2, 'WARM_UP', 'Warm-up', 1, now(), now()),
  (9, 2, 'CORE', 'Core', 2, now(), now()),
  (10, 2, 'FINISHER', 'Finisher', 3, now(), now()),
  (11, 2, 'BENCHMARK', 'Benchmark', 4, now(), now()),
  (12, 2, 'RECREATIONAL', 'Recreational', 5, now(), now()),
  (13, 3, 'SOLO', 'Solo', 1, now(), now()),
  (14, 3, 'ONE_V_ONE', '1v1', 2, now(), now()),
  (15, 3, 'MULTIPLAYER', 'Multiplayer', 3, now(), now()),
  (16, 3, 'TEAMS', 'Teams', 4, now(), now()),
  (17, 4, 'BEGINNER', 'Beginner', 1, now(), now()),
  (18, 4, 'INTERMEDIATE', 'Intermediate', 2, now(), now()),
  (19, 4, 'ADVANCED', 'Advanced', 3, now(), now()),
  (20, 4, 'EXPERT', 'Expert', 4, now(), now()),
  (21, 5, 'COUNTDOWN', 'Countdown', 1, now(), now()),
  (22, 5, 'TERRITORIAL', 'Territorial', 2, now(), now()),
  (23, 5, 'SEQUENTIAL', 'Sequential', 3, now(), now()),
  (24, 5, 'ACCUMULATION', 'Accumulation', 4, now(), now()),
  (25, 5, 'ELIMINATION', 'Elimination', 5, now(), now()),
  (26, 5, 'CHASE', 'Chase', 6, now(), now()),
  (27, 5, 'SIMULATION', 'Simulation', 7, now(), now()),
  (28, 5, 'ADJACENCY', 'Adjacency', 8, now(), now()),
  (29, 5, 'LADDER', 'Ladder', 9, now(), now()),
  (30, 5, 'THRESHOLD', 'Threshold', 10, now(), now()),
  (31, 5, 'FIXED_COUNT', 'Fixed count', 11, now(), now()),
  (32, 6, 'NONE', 'None', 1, now(), now()),
  (33, 6, 'PENALTY', 'Penalty', 2, now(), now()),
  (34, 6, 'SETBACK', 'Setback', 3, now(), now()),
  (35, 6, 'RESET', 'Reset', 4, now(), now()),
  (36, 6, 'LIVES', 'Lives', 5, now(), now()),
  (37, 7, 'STANDARD', 'Standard', 1, now(), now()),
  (38, 7, 'PUB', 'Pub', 2, now(), now()),
  (39, 7, 'REGIONAL', 'Regional', 3, now(), now()),
  (40, 7, 'NOVELTY', 'Novelty', 4, now(), now())
ON CONFLICT (id) DO UPDATE SET tag_axis_id = EXCLUDED.tag_axis_id, implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now();

DELETE FROM game_type_tags;
DELETE FROM exercise_type_tags;
DELETE FROM ruleset_version_tags;

-- game 501
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game AROUND_THE_CLOCK
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 34, FALSE, now());
-- game BASEBALL
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 16, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 27, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 40, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 12, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 16, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 27, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game BOBS27
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 33, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 33, FALSE, now());
-- game CRICKET
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 5, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 22, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 5, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 22, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game DOUBLES_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game ONE_TWENTY_ONE
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 10, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 29, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 10, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 29, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game SCORE_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game SHANGHAI
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 18, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 38, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 12, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 18, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game SINGLES_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game TACTICS
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 5, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 22, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 5, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 22, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE, now());
-- game TUOD
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 10, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 29, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 34, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE, now());
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, TRUE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 10, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 29, FALSE, now()),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 34, FALSE, now());

-- exercise BULLSEYE_CHECKOUT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 4, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 5, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 7, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 10, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 21, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise BULL_UP
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 5, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 8, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 17, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise CHECKOUT_SEQUENCE
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 3, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 4, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 10, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 11, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 21, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise DOUBLES_LOCK
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 3, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 29, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 34, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise DOUBLES_SNAKES_LADDERS
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 3, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 5, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 20, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 29, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_SNAKES_LADDERS'), 34, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise DOUBLE_PATTERN
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 2, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 3, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLE_PATTERN'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise HALVE_IT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 6, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 11, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 15, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 18, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HALVE_IT'), 33, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise HIT_COUNT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 1, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 6, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 11, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 31, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise RANDOM_CHECKOUT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 3, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 4, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 10, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 19, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 21, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise SCORE_THRESHOLD
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 1, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 18, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 30, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise SWITCHBLADE
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 1, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 2, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 11, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 14, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 18, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise SWITCHING
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 2, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 6, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING'), 35, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise TARGET_SCORING
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 6, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 9, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 18, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 24, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 35, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;
-- exercise WARM_UP
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 6, TRUE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 8, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 13, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 17, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 23, FALSE, now()),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 32, FALSE, now())
) AS v (exercise_type_id, tag_id, is_primary, created_at)
WHERE v.exercise_type_id IS NOT NULL;

-- card AROUND_THE_CLOCK_V3
INSERT INTO ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)
SELECT * FROM (VALUES
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 6, TRUE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 8, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 12, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 13, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 14, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 17, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 23, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 25, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 36, FALSE, now()),
  ((SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3'), 38, FALSE, now())
) AS v (ruleset_version_id, tag_id, is_primary, created_at)
WHERE v.ruleset_version_id IS NOT NULL;

COMMIT;
