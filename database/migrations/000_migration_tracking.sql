-- Migration: 000_migration_tracking
-- Description: Create migration tracking table in the ops schema.

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.schema_migrations (
  version VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64)
);

ALTER TABLE ops.schema_migrations
  ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_ops_schema_migrations_applied_at
  ON ops.schema_migrations(applied_at DESC);

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    INSERT INTO ops.schema_migrations (version, name, applied_at, checksum)
    SELECT
      version,
      name,
      applied_at::timestamptz,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'schema_migrations'
            AND column_name = 'checksum'
        )
        THEN checksum
        ELSE NULL
      END
    FROM public.schema_migrations
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

INSERT INTO ops.schema_migrations (version, name, checksum)
VALUES ('000', 'migration_tracking', '')
ON CONFLICT (version) DO NOTHING;
