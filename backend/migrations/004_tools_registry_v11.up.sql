-- v1.1: tools registry + portfolio_items (tool-registration.md)

ALTER TABLE tools ADD COLUMN IF NOT EXISTS slug VARCHAR(64);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS user_accessible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS online_capable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS internal_api_base VARCHAR(256) NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN IF NOT EXISTS github_repo VARCHAR(128) NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN IF NOT EXISTS release_url VARCHAR(512) NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN IF NOT EXISTS manifest_path VARCHAR(512) NOT NULL DEFAULT '';
ALTER TABLE tools ADD COLUMN IF NOT EXISTS description_override TEXT DEFAULT NULL;

-- Backfill slug from legacy name rows (if any)
UPDATE tools
SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

ALTER TABLE tools DROP CONSTRAINT IF EXISTS tools_name_key;
ALTER TABLE tools ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_slug ON tools (slug);

CREATE TABLE IF NOT EXISTS portfolio_items (
    slug                 VARCHAR(64)  PRIMARY KEY,
    name                 VARCHAR(128) NOT NULL,
    description          TEXT         NOT NULL DEFAULT '',
    github_repo          VARCHAR(128) NOT NULL DEFAULT '',
    source_dir           VARCHAR(512) NOT NULL DEFAULT '',
    name_override        VARCHAR(128) DEFAULT NULL,
    description_override TEXT         DEFAULT NULL,
    linked_tool_slug     VARCHAR(64)  DEFAULT NULL
);
