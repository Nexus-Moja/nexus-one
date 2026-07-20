BEGIN;

-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create a default organization for development
INSERT INTO organizations (name, slug, active)
VALUES ('Nexus Medical Transit', 'nexus-default', true)
ON CONFLICT (name) DO NOTHING;

-- Add organization_id column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Add foreign key constraint if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'users' AND constraint_name = 'fk_users_organization'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_organization 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Populate organization_id for existing users who don't have one
UPDATE users 
SET organization_id = (SELECT id FROM organizations WHERE name = 'Nexus Medical Transit' LIMIT 1)
WHERE organization_id IS NULL;

-- Set NOT NULL constraint on organization_id after populating
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;

INSERT INTO schema_migrations(version,description) VALUES('004.001','Create organizations table and link users to organizations') ON CONFLICT(version) DO NOTHING;

COMMIT;
