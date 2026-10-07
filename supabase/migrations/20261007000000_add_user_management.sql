-- Migration: Add user management columns to auth.users
-- Sprint 23: User Management for Admin
-- Date: 2026-10-07
--
-- Adds username, display_name, and is_active columns to auth.users
-- to support multi-user Cajero management from /admin/usuarios.
-- Does NOT create a parallel users table; auth.users remains the single
-- source of identity. Roles continue to be governed by raw_app_meta_data.role.

-- 1. Add new columns to auth.users with safe IF NOT EXISTS via DO block
DO $$
BEGIN
  -- username: unique human-readable login identifier
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN username VARCHAR(64);
  END IF;

  -- display_name: human-readable name for UI display
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN display_name VARCHAR(255);
  END IF;

  -- is_active: soft-delete / deactivation flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE auth.users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END
$$;

-- 2. Backfill existing users with compatible defaults
-- Existing users get username = email (guaranteed unique), display_name = email prefix, is_active = true
UPDATE auth.users
SET
  username = COALESCE(username, SPLIT_PART(email, '@', 1)),
  display_name = COALESCE(display_name, SPLIT_PART(email, '@', 1)),
  is_active = COALESCE(is_active, true)
WHERE username IS NULL OR display_name IS NULL OR is_active IS NULL;

-- 3. Enforce NOT NULL and DEFAULT on is_active after backfill
ALTER TABLE auth.users ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE auth.users ALTER COLUMN is_active SET NOT NULL;

-- 4. Add UNIQUE constraint on username (after backfill to avoid conflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_unique' AND conrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE auth.users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END
$$;

-- 5. Create index for fast username lookups during login
CREATE INDEX IF NOT EXISTS idx_auth_users_username ON auth.users (username);

-- 6. Create index for active user filtering
CREATE INDEX IF NOT EXISTS idx_auth_users_is_active ON auth.users (is_active);
