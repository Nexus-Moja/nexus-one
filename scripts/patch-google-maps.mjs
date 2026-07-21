#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Patch the hardcoded Google Maps API key placeholder
// Replace the entire var ud=`PLACEHOLDER` declaration with var ud=""

const root = process.cwd();
const files = [
  path.join(root, 'assets', 'index-drvotlb1.js'),
  path.join(root, '__deploy_temp', 'assets', 'index-drvotlb1.js'),
  path.join(root, 'dist', 'assets', 'index-drvotlb1.js'),
];

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    
    // Replace the entire var ud=`REDACTED_GOOGLE_API_KEY` with var ud=""
    if (content.includes('var ud=`REDACTED_GOOGLE_API_KEY`')) {
      content = content.replace(/var ud=`REDACTED_GOOGLE_API_KEY`/g, 'var ud=""');
      console.log(`✓ Removed REDACTED_GOOGLE_API_KEY from ${path.basename(file)}`);
    }
    
    // Also handle YOUR_GOOGLE_MAPS_API_KEY_HERE variant
    if (content.includes('var ud=`YOUR_GOOGLE_MAPS_API_KEY_HERE`')) {
      content = content.replace(/var ud=`YOUR_GOOGLE_MAPS_API_KEY_HERE`/g, 'var ud=""');
      console.log(`✓ Removed YOUR_GOOGLE_MAPS_API_KEY_HERE from ${path.basename(file)}`);
    }
    
    writeFileSync(file, content, 'utf8');
  } catch (err) {
    // File might not exist, that's ok
    if (err.code !== 'ENOENT') {
      console.error(`⚠ Could not patch ${file}:`, err.message);
    }
  }
}

console.log('[Build] Google Maps key placeholder replacement complete');


