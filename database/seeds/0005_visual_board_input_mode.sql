-- ============================================================
-- Seed: 0005_visual_board_input_mode.sql
--
-- Adds the VISUAL_BOARD input mode: darts captured by tapping
-- the board, storing a landing coordinate per dart.
--
-- Capability rows live in seed 0006 (plan 2), so no ruleset
-- version advertises this mode until an engine implements it.
-- ============================================================
BEGIN;

INSERT INTO input_modes (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        3,
        'VISUAL_BOARD',
        'Visual Board',
        'Dart entry by tapping the board, capturing a landing coordinate.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
