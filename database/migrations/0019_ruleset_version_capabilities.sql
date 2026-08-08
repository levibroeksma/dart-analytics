-- ============================================================
-- Migration: 0019_ruleset_version_capabilities.sql
--
-- Purpose:
-- Declare which capture/input mode combinations each ruleset
-- version supports.
--
-- Seeded by database/seeds/0007; migration 0020 adds the
-- composite foreign key from exercise_sessions once those rows
-- exist. The three-way split (table -> seed -> FK) is forced
-- by the apply order: seeds run after migrations.
-- ============================================================

-- migrate:up
CREATE TABLE ruleset_version_capabilities (
    ruleset_version_id UUID NOT NULL,
    capture_mode_id SMALLINT NOT NULL,
    input_mode_id SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_ruleset_version_capabilities PRIMARY KEY (
        ruleset_version_id,
        capture_mode_id,
        input_mode_id
    ),
    CONSTRAINT fk_rvc_ruleset_version FOREIGN KEY (ruleset_version_id) REFERENCES ruleset_versions(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rvc_capture_mode FOREIGN KEY (capture_mode_id) REFERENCES capture_modes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_rvc_input_mode FOREIGN KEY (input_mode_id) REFERENCES input_modes(id) ON DELETE RESTRICT
);

COMMENT ON TABLE ruleset_version_capabilities IS 'Which capture/input mode combinations each ruleset version supports.';

-- migrate:down
DROP TABLE IF EXISTS ruleset_version_capabilities;
