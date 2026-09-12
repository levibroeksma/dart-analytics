-- ============================================================
-- Seed: 0018_singles_training_v3_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Singles Training V3: adds an
-- Accuracy scoring mode (`scoring_mode` STANDARD/ACCURACY) on
-- top of V2's unchanged 21-target path, ring-quality STANDARD
-- scoring, Hard/Extreme mandatory-hit difficulties, and
-- score-compare/elimination match outcome. Under ACCURACY, only
-- the outer/large single on a NUMBER target, or either bull
-- ring, scores 1 point; everything else (miss, double, treble,
-- inner single, wrong target) scores 0 — see
-- app/src/modules/game/singles-training.engine.module.ts. No
-- new game_types row: SINGLES_V3 is a new ruleset_versions row
-- under the same SINGLES_TRAINING game type 0003 already
-- seeded. Without this seed there is no ruleset version to
-- start a SINGLES_V3 session from — POST /api/sessions has
-- nothing to look up for SINGLES_V3.
--
-- No new configuration_templates row: SINGLES_V3's setup
-- controller (app/src/lib/game/singles-training-setup.data.ts)
-- reuses 0002's existing "Singles — Low to High, Easy" preset
-- as its templateRef and always supplies `order_mode`,
-- `target_order`, `difficulty`, and `scoring_mode` via its own
-- configOverrides — session.service.ts's createSession merges
-- template.configuration with overrides and validates the
-- MERGED result against SinglesV3Config, so the existing preset
-- is sufficient, exactly as 0013 established for SINGLES_V2.
--
-- UUID allocation (continues the 0003 range, next after 0013's
-- SINGLES_V2 row, id 000012):
-- - 0198f100-...-000013 ruleset_versions (SINGLES_V3)
--
-- No game_type_features mapping: no opponent toggle to
-- configure beyond what 0001/0003 already established for
-- SINGLES_TRAINING; SinglesV3Config models no duration field
-- either (TIMED_MODE/ROUNDS_MODE do not apply, same as V1/V2).
--
-- No exercise_templates row: nothing outside 0002's own
-- configuration_templates preset currently reads
-- exercise_templates at runtime.
--
-- Capability: SINGLES_V3 + RECREATIONAL + DETAILED_DARTS and
-- SINGLES_V3 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0018_singles_training_v3_
-- capability_checks.sql asserts the resulting rows.
-- ============================================================
BEGIN;
-- ============================================================
-- Ruleset version
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000013',
        '0198f000-0000-7000-8000-000000000003',
        'SINGLES_V3',
        3,
        'Singles Training V3: adds an Accuracy scoring mode (only the outer/large single on a NUMBER target, or either bull ring, scores 1 point; everything else scores 0) alongside V2''s unchanged Standard scoring and Hard/Extreme mandatory-hit difficulties.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
