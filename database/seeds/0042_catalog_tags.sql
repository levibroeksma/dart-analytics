-- GENERATED — do not edit. Run `npm run tags:generate` (app/).
-- Source: docs/game-rules/TAGS.md and the `## Tags` tables of the playable
-- rules files. Drift is gated by `npm run tags:generate -- --check`.
-- Idempotent: lookups upsert by id; link tables are cleared and refilled.
BEGIN;

INSERT INTO tag_axes (id, implementation_key, name) VALUES
  (1, 'SKILL', 'Skill'),
  (2, 'SESSION_ROLE', 'Session role'),
  (3, 'FORMAT', 'Format'),
  (4, 'DIFFICULTY', 'Difficulty'),
  (5, 'MECHANIC', 'Mechanic'),
  (6, 'PRESSURE', 'Pressure'),
  (7, 'FAMILY', 'Family')
ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name;

INSERT INTO tag_contexts (id, implementation_key, name) VALUES
  (1, 'STANDALONE', 'Standalone'),
  (2, 'ROUTINE_STEP', 'Routine step')
ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name;

INSERT INTO tags (id, tag_axis_id, implementation_key, name, sort_order) VALUES
  (1, 1, 'SCORING', 'Scoring', 1),
  (2, 1, 'SWITCHING', 'Switching', 2),
  (3, 1, 'DOUBLES', 'Doubles', 3),
  (4, 1, 'CHECKOUT', 'Checkout', 4),
  (5, 1, 'BULL', 'Bull', 5),
  (6, 1, 'ACCURACY', 'Accuracy', 6),
  (7, 1, 'CONTROL', 'Control', 7),
  (8, 2, 'WARM_UP', 'Warm-up', 1),
  (9, 2, 'CORE', 'Core', 2),
  (10, 2, 'FINISHER', 'Finisher', 3),
  (11, 2, 'BENCHMARK', 'Benchmark', 4),
  (12, 2, 'RECREATIONAL', 'Recreational', 5),
  (13, 3, 'SOLO', 'Solo', 1),
  (14, 3, 'ONE_V_ONE', '1v1', 2),
  (15, 3, 'MULTIPLAYER', 'Multiplayer', 3),
  (16, 3, 'TEAMS', 'Teams', 4),
  (17, 4, 'BEGINNER', 'Beginner', 1),
  (18, 4, 'INTERMEDIATE', 'Intermediate', 2),
  (19, 4, 'ADVANCED', 'Advanced', 3),
  (20, 4, 'EXPERT', 'Expert', 4),
  (21, 5, 'COUNTDOWN', 'Countdown', 1),
  (22, 5, 'TERRITORIAL', 'Territorial', 2),
  (23, 5, 'SEQUENTIAL', 'Sequential', 3),
  (24, 5, 'ACCUMULATION', 'Accumulation', 4),
  (25, 5, 'ELIMINATION', 'Elimination', 5),
  (26, 5, 'CHASE', 'Chase', 6),
  (27, 5, 'SIMULATION', 'Simulation', 7),
  (28, 5, 'ADJACENCY', 'Adjacency', 8),
  (29, 5, 'LADDER', 'Ladder', 9),
  (30, 5, 'THRESHOLD', 'Threshold', 10),
  (31, 5, 'FIXED_COUNT', 'Fixed count', 11),
  (32, 6, 'NONE', 'None', 1),
  (33, 6, 'PENALTY', 'Penalty', 2),
  (34, 6, 'SETBACK', 'Setback', 3),
  (35, 6, 'RESET', 'Reset', 4),
  (36, 7, 'STANDARD', 'Standard', 1),
  (37, 7, 'PUB', 'Pub', 2),
  (38, 7, 'REGIONAL', 'Regional', 3),
  (39, 7, 'NOVELTY', 'Novelty', 4)
ON CONFLICT (id) DO UPDATE SET tag_axis_id = EXCLUDED.tag_axis_id, implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

DELETE FROM game_type_tags;
DELETE FROM exercise_type_tags;

-- game 501
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = '501'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game AROUND_THE_CLOCK
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'AROUND_THE_CLOCK'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 34, FALSE);
-- game BASEBALL
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 16, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 27, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 39, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 12, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 16, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 27, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BASEBALL'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game BOBS27
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 33, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'BOBS27'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 33, FALSE);
-- game CRICKET
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 5, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 22, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 5, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 22, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'CRICKET'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game DOUBLES_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'DOUBLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game ONE_TWENTY_ONE
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 10, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 29, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 10, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 29, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'ONE_TWENTY_ONE'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game SCORE_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 11, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SCORE_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game SHANGHAI
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 12, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 18, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 37, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 12, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 18, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SHANGHAI'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game SINGLES_TRAINING
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 6, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 8, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 17, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 23, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 24, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 31, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'SINGLES_TRAINING'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game TACTICS
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 5, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 22, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 32, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 1, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 5, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 15, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 22, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TACTICS'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 32, FALSE);
-- game TUOD
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 4, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 10, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 14, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 29, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 34, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'STANDALONE'), 36, FALSE);
INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary) VALUES
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 3, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 4, TRUE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 9, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 10, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 13, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 19, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 21, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 29, FALSE),
  ((SELECT id FROM game_types WHERE implementation_key = 'TUOD'), (SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP'), 34, FALSE);

-- exercise BULLSEYE_CHECKOUT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 4, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 5, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 7, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 10, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 19, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 21, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULLSEYE_CHECKOUT'), 32, FALSE);
-- exercise BULL_UP
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 5, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 8, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 17, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 24, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'BULL_UP'), 32, FALSE);
-- exercise CHECKOUT_SEQUENCE
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 3, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 4, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 10, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 11, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 14, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 19, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 21, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 24, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'CHECKOUT_SEQUENCE'), 32, FALSE);
-- exercise DOUBLES_LOCK
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 3, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 14, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 19, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 29, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'DOUBLES_LOCK'), 34, FALSE);
-- exercise HIT_COUNT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 1, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 6, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 11, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 14, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 19, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 31, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'HIT_COUNT'), 32, FALSE);
-- exercise RANDOM_CHECKOUT
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 3, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 4, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 10, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 14, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 19, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 21, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'RANDOM_CHECKOUT'), 32, FALSE);
-- exercise SCORE_THRESHOLD
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 1, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 18, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 30, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SCORE_THRESHOLD'), 32, FALSE);
-- exercise SWITCHBLADE
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 1, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 2, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 11, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 14, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 18, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 24, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHBLADE'), 32, FALSE);
-- exercise SWITCHING_TARGET_SCORING
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 2, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 6, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 18, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 24, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'SWITCHING_TARGET_SCORING'), 35, FALSE);
-- exercise TARGET_SCORING
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 6, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 9, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 18, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 24, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'TARGET_SCORING'), 35, FALSE);
-- exercise WARM_UP
INSERT INTO exercise_type_tags (exercise_type_id, tag_id, is_primary) VALUES
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 6, TRUE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 8, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 13, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 17, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 23, FALSE),
  ((SELECT id FROM exercise_types WHERE implementation_key = 'WARM_UP'), 32, FALSE);

COMMIT;
