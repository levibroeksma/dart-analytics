-- ============================================================
-- Migration: 0001_extensions.sql
--
-- Purpose:
-- Enable PostgreSQL extensions required by the application.
--
-- UUID generation happens in the application layer.
-- IDs are generated using UUIDv7 before persistence.
--
-- ============================================================

-- migrate:up
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- migrate:down
DROP EXTENSION IF EXISTS pg_stat_statements;
