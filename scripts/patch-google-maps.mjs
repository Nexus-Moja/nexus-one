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
        // The replacement must include complete function definition with proper variable scoping
        const dynamicLoaderDef = `var ud='',_ud_promise;async function _fetchGoogleMapsKey(){if(ud)return ud;if(!_ud_promise)_ud_promise=fetch('/api/integrations/config').then(r=>r.json()).then(c=>{ud=c.googleMapsBrowserKey||'';return ud}).catch(e=>{console.warn('[Nexus] Failed to load Google Maps key:',e);return ''});return _ud_promise},dd;async function fd(){await _fetchGoogleMapsKey();return window.google?.maps`;
        
        // Replace both the variable AND the fd() function in one operation to avoid syntax errors
        if (hasRedacted) {
          content = content.replace(
            /var ud=`REDACTED_GOOGLE_API_KEY`,dd;function fd\(\){return window\.google\?\.maps/g,
            dynamicLoaderDef + `?Promise.resolve(window.google.maps):dd||(dd=new Promise`
          );
        }
        if (hasPlaceholder) {
          content = content.replace(
            /var ud=`YOUR_GOOGLE_MAPS_API_KEY_HERE`,dd;function fd\(\){return window\.google\?\.maps/g,
            dynamicLoaderDef + `?Promise.resolve(window.google.maps):dd||(dd=new Promise`
          );
        }
        
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
