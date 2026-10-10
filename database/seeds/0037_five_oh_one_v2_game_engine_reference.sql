-- ============================================================
-- Seed: 0037_five_oh_one_v2_game_engine_reference.sql
--
-- 501_V2: match formats (best of N, sets, win by 2 legs with a
-- sudden-death cap, deciding-set margin, per-set throw rotation;
-- docs/game-rules/rulesets/501.md). Same game type as 501_V1.
--
-- One configuration_templates row, V2-shaped: session creation
-- merges template.configuration with overrides and validates the
-- merge (session.service.ts), and the V1 presets carry
-- legs_to_win, which the strict FiveOhOneV2Config rejects. V2
-- setup selects this preset by configuration.legs being an object.
--
-- UUID allocation:
-- - 0198f100-...-000017 ruleset_versions (501_V2)
-- - 0198f300-...-000019 configuration_templates (501 — Match)
--
-- Capability rows are appended to seeds/0007 (the running
-- ledger); verification/0037_five_oh_one_v2_capability_checks.sql
-- asserts them.
-- ============================================================
BEGIN;

INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000017',
        '0198f000-0000-7000-8000-000000000001',
        '501_V2',
        2,
        '501 V2: best of N legs or sets (odd N), sets of legs, optional win by 2 legs with a sudden-death cap and every-set or deciding-set scope, per-set throw rotation. In/out rules unchanged from V1.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

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
        '0198f300-0000-7000-8000-000000000019',
        '0198f000-0000-7000-8000-000000000001',
        NULL,
        '501 — Match',
        'Match format chosen at setup, double out.',
        '{
            "starting_score": 501,
            "check_in": "STRAIGHT_IN",
            "check_out": "DOUBLE_OUT",
            "max_darts_per_turn": 3,
            "max_visit_score": 180,
            "legs": {"mode": "FIRST_TO", "count": 1},
            "sets": null,
            "win_by_two": null
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
