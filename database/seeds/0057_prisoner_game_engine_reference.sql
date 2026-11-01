-- ============================================================
-- Seed: 0057_prisoner_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Prisoner v1: two seats, three darts
-- held each. Each seat goes round the clock 1 to 20 on outer
-- singles; a dart in the inner single of its target, or either
-- bull, is imprisoned and leaves its darts held, and a valid hit
-- on a number holding a prisoner captures it. A bounce-out sits
-- out the next visit. Complete 20, or be the last seat holding
-- darts, to win. Without this seed there is no game type,
-- ruleset version, or preset to start a session from —
-- POST /api/sessions has nothing to look up for PRISONER_V1.
--
-- UUID allocation (continues the 0003 range, next after 0055's
-- Follow the Leader rows):
-- - 0198f000-...-000000000010 game_types              (PRISONER)
-- - 0198f100-...-000000000027 ruleset_versions        (PRISONER_V1)
-- - 0198f300-...-00000000001e configuration_templates (Prisoner — Three Darts)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — PrisonerConfig: `darts`
-- is locked at 3, so the preset carries `{"darts": 3}`.
--
-- No game_type_features mapping: v1 has no duration or opponent
-- toggle, as 0054 Killer.
--
-- Capability: PRISONER_V1 + ANALYTICS + VISUAL_BOARD only — the
-- inner and outer single bands decide every dart, and keypad
-- capture writes the unbanded SINGLE. Declared in
-- seeds/0007_ruleset_version_capabilities.sql, the running
-- ledger. verification/0057_prisoner_capability_checks.sql
-- asserts it.
-- ============================================================
BEGIN;
-- ============================================================
-- Game type
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000010',
        'PRISONER',
        'Prisoner',
        'Go round the clock 1 to 20 on outer singles. A dart in your target''s inner single or the bull is imprisoned and lost; hit a number holding a prisoner to capture it. Complete 20, or be the last seat holding darts.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
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
        '0198f100-0000-7000-8000-000000000027',
        '0198f000-0000-7000-8000-000000000010',
        'PRISONER_V1',
        1,
        'Initial Prisoner ruleset: two seats, three darts held, targets 1 to 20 in order; only an outer single is a valid hit (advance on the target, capture on a number holding a prisoner, or both); the target''s inner single or either bull imprisons the dart (bull prisoners are gone for good); a bounce-out or off-board dart sits out the next visit; a seat whose darts all sit out is skipped; out at no darts held; complete 20 or be the last seat in to win.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration preset
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-00000000001e',
        '0198f000-0000-7000-8000-000000000010',
        NULL,
        'Prisoner — Three Darts',
        'Three darts held each, targets 1 to 20, two seats.',
        '{"darts": 3}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
