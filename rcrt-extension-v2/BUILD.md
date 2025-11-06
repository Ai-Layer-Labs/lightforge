# Build Guide for RCRT Browser Extension v2

## Quick Build

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output: dist/ folder ready to load in Chrome
```

## Development Build

```bash
# Watch mode with hot reload
npm run dev
```

After changes, reload extension in Chrome:
1. Go to `chrome://extensions/`
2. Find RCRT Extension v2
3. Click reload icon

## Build Structure

```
dist/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (tab tracking)
├── sidepanel.html        # Side panel HTML
├── index-[hash].js       # Side panel React app
├── chunks/               # Code-split chunks
│   └── *.js
├── assets/               # CSS and other assets
│   └── *.css
└── icons/                # Extension icons
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

## Build Requirements

### Node.js Version

Requires Node.js 18 or higher:
```bash
node --version
# Should show: v18.x.x or higher
```

### Dependencies

Key dependencies:
- React 18
- TypeScript 5
- Vite 5
- TailwindCSS 3
- Lucide React (icons)
- markdown-it (markdown rendering)
- DOMPurify (XSS protection)

## TypeScript Compilation

Type check without building:
```bash
npm run type-check
```

Fix type errors before building.

## Production Optimization

The build is optimized for:
- **Code splitting**: Chunks for faster loading
- **Minification**: Smaller file sizes
- **Tree shaking**: Removes unused code
- **Asset optimization**: CSS/images optimized

## Build Troubleshooting

### Build Fails

**Error:** "Cannot find module"
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Error:** TypeScript errors
```bash
# Check types
npm run type-check

# Fix errors in src/ files
```

### Large Bundle Size

Check bundle analysis:
```bash
npm run build -- --mode analyze
```

Optimize by:
- Lazy loading components
- Code splitting
- Removing unused dependencies

### Extension Won't Load After Build

1. Check `dist/manifest.json` exists
2. Verify `dist/background.js` exists
3. Check browser console for errors
4. Try clearing browser cache

## Icons

Extension needs icons in `icons/` directory:
- `icon-16.png` - Toolbar icon
- `icon-32.png` - Extension management
- `icon-48.png` - Extensions page
- `icon-128.png` - Web store

Create from existing RCRT icon or use placeholders.

## Release Build

For distribution:

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build

# Create ZIP for distribution
cd dist
zip -r ../rcrt-extension-v2.zip .
```

Upload `rcrt-extension-v2.zip` to Chrome Web Store or share with users.

