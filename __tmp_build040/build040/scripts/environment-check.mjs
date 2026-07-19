import { config, validateEnvironment } from '../src/server/config/environment.mjs';

try {
  validateEnvironment();
  console.log(`Environment valid: ${config.environment}`);
  console.log(`Origin: ${config.app.origin || '(not set)'}`);
  console.log(`Database provider: ${config.database.provider}`);
  console.log(`Preview accounts: ${config.auth.enablePreviewAccounts ? 'enabled' : 'disabled'}`);
  console.log(`Mock fleet: ${config.features.mockFleet ? 'enabled' : 'disabled'}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
