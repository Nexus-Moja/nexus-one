BEGIN;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'USER';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_chk;
ALTER TABLE users ADD CONSTRAINT users_role_chk CHECK (
  role IN (
    'ADMIN',
    'DISPATCHER',
    'EXECUTIVE',
    'BILLING',
    'QA',
    'FACILITY',
    'DRIVER',
    'PATIENT',
    'USER',
    'admin',
    'clinician',
    'reviewer',
    'operator',
    'auditor'
  )
);

INSERT INTO schema_migrations(version, description)
VALUES ('043.001', 'Align users role constraint with application roles while preserving legacy values')
ON CONFLICT (version) DO NOTHING;

COMMIT;
