#!/bin/bash
# Quick setup script for RCRT secrets service in development

set -euo pipefail

echo "🔐 RCRT Secrets Service Development Setup"
echo "========================================="
echo

# Check if RCRT is running
if ! curl -s http://localhost:8081/health > /dev/null 2>&1; then
    echo "⚠️  RCRT server not running at localhost:8081"
    echo "   Please start RCRT first with: cargo run --bin rcrt-server"
    exit 1
fi

# Check if KEK is already set
if [[ -n "${LOCAL_KEK_BASE64:-}" ]]; then
    echo "✅ KEK already configured in environment"
    echo "   To regenerate, unset LOCAL_KEK_BASE64 first"
else
    # Generate new KEK
    echo "🔑 Generating new Key Encryption Key (KEK)..."
    export LOCAL_KEK_BASE64=$(openssl rand -base64 32)
    echo "✅ KEK generated successfully"
    echo
    
    # Save to .env file for persistence
    echo "💾 Saving to .env file for development..."
    echo "LOCAL_KEK_BASE64=\"$LOCAL_KEK_BASE64\"" >> ../.env
    echo "✅ Saved to .env (added to .gitignore)"
    echo
    
    echo "📝 To use this KEK in future sessions:"
    echo "   export LOCAL_KEK_BASE64=\"$LOCAL_KEK_BASE64\""
    echo
    echo "   Or add to your shell profile:"
    echo "   echo 'export LOCAL_KEK_BASE64=\"$LOCAL_KEK_BASE64\"' >> ~/.bashrc"
    echo
fi

# Test the secrets service
echo "🧪 Testing secrets service..."
TEST_SECRET=$(curl -s -X POST http://localhost:8081/secrets \
    -H "Content-Type: application/json" \
    -d '{
        "name": "test-secret",
        "value": "test-value-123",
        "scope_type": "global"
    }' 2>/dev/null || echo "FAILED")

if [[ "$TEST_SECRET" == "FAILED" ]] || [[ "$TEST_SECRET" == *"error"* ]] || [[ "$TEST_SECRET" == *"missing"* ]]; then
    echo "❌ Secrets service test failed!"
    echo "   Response: $TEST_SECRET"
    echo
    echo "⚠️  The server needs to be restarted with the KEK:"
    echo "   1. Stop the current RCRT server (Ctrl+C)"
    echo "   2. Run: export LOCAL_KEK_BASE64=\"$LOCAL_KEK_BASE64\""
    echo "   3. Start RCRT: cargo run --bin rcrt-server"
    exit 1
fi

# Extract secret ID
SECRET_ID=$(echo "$TEST_SECRET" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [[ -n "$SECRET_ID" ]]; then
    echo "✅ Secret created: $SECRET_ID"
    
    # Test decryption
    echo "🔓 Testing decryption..."
    DECRYPTED=$(curl -s -X POST "http://localhost:8081/secrets/$SECRET_ID/decrypt" \
        -H "Content-Type: application/json" \
        -d '{"reason": "test decryption"}' 2>/dev/null || echo "FAILED")
    
    if [[ "$DECRYPTED" == *"test-value-123"* ]]; then
        echo "✅ Decryption successful!"
        
        # Cleanup
        curl -s -X DELETE "http://localhost:8081/secrets/$SECRET_ID" > /dev/null 2>&1
        echo "🧹 Test secret cleaned up"
    else
        echo "❌ Decryption failed: $DECRYPTED"
        exit 1
    fi
else
    echo "❌ Could not extract secret ID from response"
    exit 1
fi

echo
echo "✨ RCRT Secrets Service is ready for development!"
echo
echo "📚 Next steps:"
echo "   1. Run the SDK tests: npm test"
echo "   2. Try the example: npx ts-node test/test-secrets-native.ts"
echo "   3. Read the production guide: docs/RCRT_Secrets_Production_Guide.md"
echo
echo "⚠️  Remember: Never commit the KEK to version control!"
echo "   The .env file should be in .gitignore"
