#!/bin/bash
# Validation script to ensure single source of truth for bootstrap

echo "🔍 RCRT Bootstrap Validation"
echo "============================"
echo ""

ERRORS=0
WARNINGS=0

# 1. Check for duplicate agent definitions
echo "1️⃣ Checking for duplicate agent definitions..."
AGENT_FILES=$(find . -name "*chat-agent*.json" -type f | grep -v node_modules | grep -v ".backup")

AGENT_COUNT=$(echo "$AGENT_FILES" | wc -l)
if [ $AGENT_COUNT -eq 1 ]; then
    echo "   ✅ Found exactly 1 agent definition file"
    echo "      $AGENT_FILES"
else
    echo "   ❌ Found $AGENT_COUNT agent definition files (expected 1):"
    echo "$AGENT_FILES" | sed 's/^/      /'
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Check the correct file exists
echo "2️⃣ Checking required bootstrap files..."
REQUIRED_FILES=(
    "bootstrap-breadcrumbs/system/default-chat-agent.json"
    "bootstrap-breadcrumbs/system/bootstrap-marker.json"
    "bootstrap-breadcrumbs/bootstrap.js"
    "bootstrap-breadcrumbs/README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (MISSING)"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# 3. Check for deleted duplicates
echo "3️⃣ Checking deleted files (should not exist)..."
SHOULD_NOT_EXIST=(
    "scripts/default-chat-agent.json"
    "scripts/default-chat-agent-v2.json"
    "bootstrap-breadcrumbs/system/default-chat-agent-v3.json"
    "rcrt-visual-builder/apps/agent-runner/ensure-default-agent.js"
    "rcrt-visual-builder/apps/agent-runner/ensure-default-agent-simple.js"
    "scripts/load-default-agent.js"
)

for file in "${SHOULD_NOT_EXIST[@]}"; do
    if [ -f "$file" ]; then
        echo "   ❌ $file (should be deleted)"
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ $file (correctly deleted)"
    fi
done
echo ""

# 4. Check for hardcoded fallbacks in code
echo "4️⃣ Checking for hardcoded agent definitions..."
if grep -r "schema_name.*agent\.def\.v1" ensure-default-agent.js 2>/dev/null | grep -q "{"; then
    echo "   ⚠️  Possible hardcoded agent in ensure-default-agent.js"
    WARNINGS=$((WARNINGS + 1))
else
    echo "   ✅ No hardcoded agents in ensure-default-agent.js"
fi
echo ""

# 5. Check tools directory
echo "5️⃣ Checking tools directory..."
if [ -d "bootstrap-breadcrumbs/tools" ]; then
    TOOL_COUNT=$(find bootstrap-breadcrumbs/tools -name "*.json" -type f | wc -l)
    echo "   ✅ Tools directory exists with $TOOL_COUNT tool definition(s)"
    find bootstrap-breadcrumbs/tools -name "*.json" -type f | sed 's/^/      /'
else
    echo "   ❌ Tools directory missing"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 6. Check bootstrap.js loads tools
echo "6️⃣ Checking bootstrap.js loads tools..."
if grep -q "toolsDir.*tools" bootstrap-breadcrumbs/bootstrap.js; then
    echo "   ✅ bootstrap.js loads from tools/ directory"
else
    echo "   ❌ bootstrap.js doesn't load tools directory"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. Check setup.sh uses bootstrap.js
echo "7️⃣ Checking setup.sh uses bootstrap system..."
if grep -q "bootstrap-breadcrumbs.*bootstrap.js" setup.sh; then
    echo "   ✅ setup.sh uses bootstrap-breadcrumbs/bootstrap.js"
else
    echo "   ⚠️  setup.sh may not use bootstrap system"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Validation Summary"
echo "=========================================="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ ✅ ✅  BOOTSTRAP VALIDATION PASSED  ✅ ✅ ✅"
    echo ""
    echo "Your system has a clean, single source of truth!"
    echo "All bootstrap data is in: bootstrap-breadcrumbs/"
    echo ""
    echo "Next steps:"
    echo "  • Test: docker compose down -v && ./setup.sh"
    echo "  • View: ls -la bootstrap-breadcrumbs/system/"
    echo "  • Tools: ls -la bootstrap-breadcrumbs/tools/"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  VALIDATION PASSED WITH WARNINGS"
    echo ""
    echo "System is functional but has minor issues."
    echo "Review warnings above and fix if needed."
    exit 0
else
    echo "❌ ❌ ❌  VALIDATION FAILED  ❌ ❌ ❌"
    echo ""
    echo "Fix the errors above before deploying."
    echo "See: BOOTSTRAP_SINGLE_SOURCE_OF_TRUTH.md"
    exit 1
fi
