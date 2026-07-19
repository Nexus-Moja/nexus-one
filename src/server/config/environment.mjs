import { resolve, join } from 'node:path';

const allowedEnvironments = new Set(['development', 'staging', 'production', 'test']);
const rawEnvironment = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const environment = allowedEnvironments.has(rawEnvironment) ? rawEnvironment : 'development';
const isProduction = environment === 'production';
const isStaging = environment === 'staging';
const isDevelopment = environment === 'development';

function text(name, fallback = '') {
  return String(process.env[name] ?? fallback).trim();
}
function integer(name, fallback) {
  const parsed = Number.parseInt(text(name, String(fallback)), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function boolean(name, fallback = false) {
  const value = text(name, String(fallback)).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}
function requireValue(name, options = {}) {
  const value = text(name);
  const minimum = options.minimum ?? 1;
  if (!value || value.length < minimum) {
    throw new Error(`${name} is required and must contain at least ${minimum} characters.`);
  }
  return value;
}

const dataDirectory = resolve(text('DATA_DIR', 'data'));
const config = Object.freeze({
  environment,
  isProduction,
  isStaging,
  isDevelopment,
  app: Object.freeze({
    name: text('APP_NAME', 'NEXUS ONE'),
    version: text('APP_VERSION', process.env.npm_package_version || '1.0.0'),
    release: text('RELEASE_SHA', text('RENDER_GIT_COMMIT', 'local')),
    origin: text('APP_ORIGIN', isProduction ? '' : 'http://localhost:4173'),
    host: text('HOST', '0.0.0.0'),
    port: integer('PORT', 4173),
    logLevel: text('LOG_LEVEL', isProduction ? 'info' : 'debug')
  }),
  database: Object.freeze({
    provider: text('DATABASE_PROVIDER', (isProduction || isStaging) ? 'postgres' : 'sqlite'),
    url: text('DATABASE_URL'),
    path: resolve(text('DB_PATH', join(dataDirectory, 'nexus-one.sqlite'))),
    dataDirectory,
    poolMax: integer('DB_POOL_MAX', 10),
    ssl: boolean('DB_SSL', isProduction || isStaging)
  }),
  auth: Object.freeze({
    sessionSecret: text('SESSION_SECRET'),
    adminKey: text('ADMIN_KEY'),
    enablePreviewAccounts: boolean('ENABLE_PREVIEW_ACCOUNTS', isDevelopment),
    sessionHours: integer('SESSION_HOURS', 8)
  }),
  integrations: Object.freeze({
    googleMapsApiKey: text('GOOGLE_MAPS_API_KEY'),
    stripeSecretKey: text('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: text('STRIPE_WEBHOOK_SECRET'),
    sendgridApiKey: text('SENDGRID_API_KEY'),
    twilioAccountSid: text('TWILIO_ACCOUNT_SID'),
    twilioAuthToken: text('TWILIO_AUTH_TOKEN'),
    sentryDsn: text('SENTRY_DSN')
  }),
  features: Object.freeze({
    mockFleet: boolean('ENABLE_MOCK_FLEET', isDevelopment),
    payments: boolean('ENABLE_PAYMENTS', false),
    notifications: boolean('ENABLE_NOTIFICATIONS', false)
  })
});

export function validateEnvironment() {
  const errors = [];
  if (!allowedEnvironments.has(rawEnvironment)) errors.push(`APP_ENV must be one of: ${[...allowedEnvironments].join(', ')}.`);
  if ((isProduction || isStaging) && !config.app.origin) errors.push('APP_ORIGIN is required in staging and production.');
  if (isProduction && config.auth.enablePreviewAccounts) errors.push('ENABLE_PREVIEW_ACCOUNTS must be false in production.');
  if (isProduction && config.features.mockFleet) errors.push('ENABLE_MOCK_FLEET must be false in production.');
  if (isProduction && config.auth.sessionSecret.length < 32) errors.push('SESSION_SECRET must contain at least 32 characters in production.');
  if (isProduction && config.auth.adminKey.length < 24) errors.push('ADMIN_KEY must contain at least 24 characters in production.');
  if (isProduction && config.app.origin.startsWith('http://')) errors.push('APP_ORIGIN must use HTTPS in production.');
  if (!['sqlite','postgres'].includes(config.database.provider)) errors.push('DATABASE_PROVIDER must be sqlite or postgres.');
  if ((isProduction || isStaging) && config.database.provider !== 'postgres') errors.push('Staging and production require DATABASE_PROVIDER=postgres.');
  if (config.database.provider === 'postgres' && !config.database.url) errors.push('DATABASE_URL is required when DATABASE_PROVIDER=postgres.');
  if (config.features.payments && !config.integrations.stripeSecretKey) errors.push('STRIPE_SECRET_KEY is required when payments are enabled.');
  if (config.features.notifications && (!config.integrations.sendgridApiKey || !config.integrations.twilioAuthToken)) {
    errors.push('SENDGRID_API_KEY and TWILIO_AUTH_TOKEN are required when notifications are enabled.');
  }
  if (errors.length) throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  return config;
}

export { config, requireValue };
