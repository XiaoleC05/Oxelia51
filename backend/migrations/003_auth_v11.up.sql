-- v1.1: email verification + admin seed column support
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing rows (if any) from before migration: treat as unverified except we fix admin in seed
UPDATE users SET email_verified = TRUE WHERE role = 'admin' AND email_verified = FALSE;
