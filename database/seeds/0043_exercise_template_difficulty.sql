-- database/seeds/0043_exercise_template_difficulty.sql
-- Per-template difficulty (exercise_templates.difficulty_tag_id, 0047).
--
-- Hand-authored, like every other template column. Only a type whose
-- `### Routine step` tag block labels several difficulties gets rows
-- here; every other template stays NULL and v_exercise_template_catalog
-- falls back to its type's single routine-step Difficulty.
--
-- Read alongside each template's own seed. Proof of agreement with the
-- docs is app/tests/integration/template-difficulty-parity.itest.ts
-- (per type: docs Difficulty set = seeded difficulty_level set).
--
-- Runs after 0042_catalog_tags.sql (filename order), which writes the
-- DIFFICULTY tags. Idempotent: primary-key-targeted UPDATEs.
--
-- AROUND_THE_CLOCK (docs/game-rules/rulesets/around-the-clock.md,
-- Routine step: INTERMEDIATE (1 dart), ADVANCED (2 darts),
-- EXPERT (3 darts)); templates from seed 0028:
-- - 0199b000-...-00b  Around the Clock — 1 dart   -> INTERMEDIATE
-- - 0199b000-...-00c  Around the Clock — 2 darts  -> ADVANCED
-- - 0199b000-...-00d  Around the Clock — 3 darts  -> EXPERT
BEGIN;

UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = 'INTERMEDIATE') WHERE id = '0199b000-0000-7000-8000-00000000000b';
UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = 'ADVANCED') WHERE id = '0199b000-0000-7000-8000-00000000000c';
UPDATE exercise_templates SET difficulty_tag_id = (SELECT t.id FROM tags t JOIN tag_axes a ON a.id = t.tag_axis_id WHERE a.implementation_key = 'DIFFICULTY' AND t.implementation_key = 'EXPERT') WHERE id = '0199b000-0000-7000-8000-00000000000d';

COMMIT;
