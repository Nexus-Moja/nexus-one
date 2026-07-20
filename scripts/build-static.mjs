import { mkdirSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const distDir = join(root, 'dist');

mkdirSync(distDir, { recursive: true });

const copyRecursive = (src, dest) => {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

const filesToCopy = [
  'index.html',
  'accessibility.html',
  'admin.html',
  'ai-operations.html',
  'billing.html',
  'dispatch.html',
  'driver.html',
  'executive.html',
  'facility.html',
  'fleet.html',
  'livecare.html',
  'operations.html',
  'patient.html',
  'qa.html',
  'auth-guard.js',
  'build4-operations.js',
  'build5-facility.js',
  'build6-livecare.js',
  'build6-patient.js',
  'driver-app.css',
  'driver-app.js',
  'facility-service.js',
  'i18n.js',
  'netlify.toml',
  'nexus-ai.js',
  'nexus-core.js',
  'nexus-executive.js',
  'nexus-revenue.js',
  'patient-service.js',
  'platform.css',
  'platform.js',
  'platform-template.js',
  'trustedsite.js',
  'assets',
  'hero-ambulance.svg',
  'hero-shuttle.svg',
  'hero-wheelchair.svg',
  'nexus-footer-logo.png',
  'nexus-logo.png'
];

for (const item of filesToCopy) {
  const srcPath = join(root, item);
  const destPath = join(distDir, item);
  if (!existsSync(srcPath)) continue;
  if (statSync(srcPath).isDirectory()) {
    copyRecursive(srcPath, destPath);
  } else {
    copyFileSync(srcPath, destPath);
  }
}

console.log('Static build output written to dist');
