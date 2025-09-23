#!/bin/bash
# Script to set OpenRouter API key and restart agent-runner

echo "🔐 Setting up OpenRouter API key for RCRT chat agent"
echo ""

# Check if OPENROUTER_API_KEY is already set
if [ -n "$OPENROUTER_API_KEY" ]; then
    echo "✅ OPENROUTER_API_KEY is already set in your environment"
    echo ""
else
    echo "Please enter your OpenRouter API key:"
    echo "(Get one from https://openrouter.ai/settings if you don't have one)"
    read -p "API Key: " api_key
    
    if [ -z "$api_key" ]; then
        echo "❌ No API key provided. Exiting."
        exit 1
    fi
    
    # Export for current session
    export OPENROUTER_API_KEY="$api_key"
    
    echo ""
    echo "✅ API key set for current session"
    echo ""
    echo "To make this permanent, add this line to your ~/.bashrc or ~/.bash_profile:"
    echo "export OPENROUTER_API_KEY='$api_key'"
    echo ""
fi

# Restart agent-runner with the new environment variable
echo "🔄 Restarting agent-runner with OpenRouter API key..."
docker compose up -d agent-runner

echo ""
echo "⏳ Waiting for agent-runner to restart..."
sleep 5

# Check logs
echo ""
echo "📋 Recent agent-runner logs:"
docker logs breadcrums-agent-runner-1 --tail 20

echo ""
echo "✅ Setup complete! Your chat agent should now be able to use OpenRouter."
echo ""
echo "Try sending another message to test it:"
echo "node send-chat-message.js \"Hello! Can you hear me now?\""
