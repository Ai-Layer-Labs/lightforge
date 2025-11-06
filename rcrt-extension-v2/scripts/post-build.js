/**
 * Post-build script
 * Fixes file locations for Chrome extension requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist');

console.log('[post-build] Fixing extension structure...');

// 1. Copy sidepanel HTML to root if it's in src/sidepanel/
const htmlSource = path.join(distDir, 'src/sidepanel/index.html');
const htmlDest = path.join(distDir, 'sidepanel.html');

if (fs.existsSync(htmlSource)) {
  fs.copyFileSync(htmlSource, htmlDest);
  console.log('✓ Copied sidepanel.html to dist root');
}

// 2. Verify all required files exist
const requiredFiles = [
  'manifest.json',
  'background.js',
  'sidepanel.html',
  'sidepanel.js'
];

let allPresent = true;
for (const file of requiredFiles) {
  const filePath = path.join(distDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Missing required file: ${file}`);
    allPresent = false;
  } else {
    console.log(`✓ ${file}`);
  }
}

// 3. Check icons
const iconSizes = [16, 32, 48, 128];
const iconsDir = path.join(distDir, 'icons');

if (fs.existsSync(iconsDir)) {
  for (const size of iconSizes) {
    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    if (fs.existsSync(iconPath)) {
      console.log(`✓ icons/icon-${size}.png`);
    } else {
      console.warn(`⚠ Missing icon-${size}.png (extension will use defaults)`);
    }
  }
} else {
  console.warn('⚠ Icons directory missing');
}

if (allPresent) {
  console.log('\n✅ Extension build complete and valid!');
  console.log(`📦 Location: ${distDir}`);
  console.log('\nTo install:');
  console.log('1. Open chrome://extensions/');
  console.log('2. Enable Developer mode');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select the dist/ folder');
} else {
  console.error('\n❌ Build incomplete - missing required files');
  process.exit(1);
}

