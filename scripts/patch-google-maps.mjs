#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Patch the hardcoded Google Maps API key placeholder
// This script is run after build to inject the real key or configure dynamic loading

const root = process.cwd();
const files = [
  path.join(root, 'assets', 'index-drvotlb1.js'),
  path.join(root, '__deploy_temp', 'assets', 'index-drvotlb1.js'),
  path.join(root, 'dist', 'assets', 'index-drvotlb1.js'),
];

const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY || '';

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    const hasRedacted = content.includes('REDACTED_GOOGLE_API_KEY');
    const hasPlaceholder = content.includes('YOUR_GOOGLE_MAPS_API_KEY_HERE');
    
    if (hasRedacted || hasPlaceholder) {
      if (apiKey) {
        // Replace with actual key
        content = content.replace(/var ud=`REDACTED_GOOGLE_API_KEY`/g, `var ud=\`${apiKey}\``);
        content = content.replace(/var ud=`YOUR_GOOGLE_MAPS_API_KEY_HERE`/g, `var ud=\`${apiKey}\``);
        console.log(`✓ Injected API key into ${path.basename(file)}`);
      } else {
        // Configure dynamic loading: replace the key variable initialization
        // so it fetches from the config endpoint instead
        const dynamicLoader = `var ud='',_ud_promise;async function _fetchGoogleMapsKey(){if(ud)return ud;if(!_ud_promise)_ud_promise=fetch('/api/integrations/config').then(r=>r.json()).then(c=>{ud=c.googleMapsBrowserKey||'';return ud}).catch(e=>{console.warn('[Nexus] Failed to load Google Maps key:',e);return ''});return _ud_promise}`;
        
        // Replace the variable initialization
        if (hasRedacted) {
          content = content.replace(
            /var ud=`REDACTED_GOOGLE_API_KEY`/g,
            dynamicLoader
          );
        }
        if (hasPlaceholder) {
          content = content.replace(
            /var ud=`YOUR_GOOGLE_MAPS_API_KEY_HERE`/g,
            dynamicLoader
          );
        }
        
        // Now replace the fd() function to call our fetcher
        // Look for the function that uses `ud` and make it async + call our fetcher
        content = content.replace(
          /function fd\(\)\{return window\.google\?\.maps/g,
          `async function fd(){await _fetchGoogleMapsKey();return window.google?.maps`
        );
        
        console.log(`✓ Configured dynamic API key loading for ${path.basename(file)}`);
      }
      
      writeFileSync(file, content, 'utf8');
    }
  } catch (err) {
    // File might not exist, that's ok
    if (err.code !== 'ENOENT') {
      console.error(`⚠ Could not patch ${file}:`, err.message);
    }
  }
}

console.log('[Build] Google Maps configuration complete');
