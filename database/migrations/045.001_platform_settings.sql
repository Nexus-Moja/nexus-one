BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO system_settings(key, value)
VALUES (
  'platform',
  jsonb_build_object(
    'pricing', '{}'::jsonb,
    'fareRules', jsonb_build_object(
      'minimumFare', 0,
      'fuelSurchargePerMile', 0,
      'afterHoursSurchargePct', 0,
      'weekendSurchargePct', 0,
      'holidaySurchargePct', 10,
      'cancellationFee', 30,
      'noShowFee', 50,
      'freeWaitMinutes', 15,
      'mileageRoundingRule', 'TENTH_MILE',
      'telemetryRefreshSeconds', 20,
      'maxBookingDistanceMiles', 125
    ),
    'organization', jsonb_build_object(
      'name', 'Nexus Medical Transit',
      'phone', '(888) 760-4990',
      'email', 'contact@nexusmt.com',
      'website', 'https://nexusmt.com'
    ),
    'activeServices', jsonb_build_array('AMBULANCE','WHEELCHAIR','STRETCHER','HOSPITAL_DISCHARGE')
  )
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations(version,description)
VALUES('045.001','Add database-backed platform settings for pricing and fare rules')
ON CONFLICT(version) DO NOTHING;

COMMIT;
