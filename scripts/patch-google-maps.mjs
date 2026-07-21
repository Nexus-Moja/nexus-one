#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Patch the hardcoded Google Maps API key placeholder
// This script is run after build to replace the placeholder with empty string
// The real API key is loaded dynamically via index.html script

const root = process.cwd();
const files = [
  path.join(root, 'assets', 'index-drvotlb1.js'),
  path.join(root, '__deploy_temp', 'assets', 'index-drvotlb1.js'),
  path.join(root, 'dist', 'assets', 'index-drvotlb1.js'),
];

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    const hasRedacted = content.includes('REDACTED_GOOGLE_API_KEY');
    const hasPlaceholder = content.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE');
    
    if (hasRedacted || hasPlaceholder) {
      // Simply replace the hardcoded placeholder with an empty string
      // The real API key is injected via index.html script before React loads
      content = content.replace(/`REDACTED_GOOGLE_API_KEY`/g, '``');
      content = content.replace(/`YOUR_GOOGLE_MAPS_API_KEY_HERE`/g, '``');
      
      writeFileSync(file, content, 'utf8');
      console.log(`✓ Removed hardcoded API key placeholder from ${path.basename(file)}`);
    }
  } catch (err) {
    // File might not exist, that's ok
    if (err.code !== 'ENOENT') {
      console.error(`⚠ Could not patch ${file}:`, err.message);
    }
  }
}

console.log('[Build] Google Maps placeholder removal complete');

