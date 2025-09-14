#!/bin/bash

# RCRT Dashboard Build Script
# Production-ready build automation for the modular dashboard

set -e

echo "🚀 RCRT Dashboard Production Build"
echo "================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: No package.json found. Run this script from the js/ directory."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Error: Node.js 16+ required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "📦 Dependencies already installed"
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Run TypeScript type checking (if files exist)
if [ -f "tsconfig.json" ]; then
    echo "🔍 Running type checks..."
    npx tsc --noEmit || echo "⚠️ Type check issues found (non-blocking for JS build)"
fi

# Run linting
echo "🔍 Linting code..."
npx eslint modules/ dashboard-main.js --max-warnings 0 || echo "⚠️ Linting issues found (non-blocking)"

# Build for production
echo "🏗️ Building production bundle..."
NODE_ENV=production npx webpack --mode production --config webpack.config.js

# Check bundle size
echo "📊 Bundle analysis:"
du -sh dist/* | sort -hr

# Verify build output
if [ -f "dist/dashboard-bundle*.js" ]; then
    echo "✅ Build completed successfully!"
    echo ""
    echo "📁 Output files:"
    ls -la dist/
    echo ""
    echo "🚀 Ready for production deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Update your HTML to use: /static/js/dist/index.html"
    echo "2. Or copy dist/dashboard-bundle*.js to your production server"
    echo "3. Update script tags to reference the new bundle"
    echo ""
    echo "💡 For development: npm run dev"
    echo "📊 For bundle analysis: npm run analyze"
else
    echo "❌ Build failed - no output bundle found"
    exit 1
fi
