ALTER TABLE hero_images DROP CONSTRAINT IF EXISTS hero_images_pkey;
DROP INDEX IF EXISTS idx_hero_images_order;
DROP TABLE IF EXISTS hero_images;
