-- Add active flag to workshops for admin deactivation without data loss.
ALTER TABLE workshops ADD COLUMN is_active boolean NOT NULL DEFAULT true;
