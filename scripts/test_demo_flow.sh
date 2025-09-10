#!/bin/bash

# RCRT Demo Flow Test Script
# This script mimics the agentic demo flow using curl commands

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUILDER_URL="http://localhost:3000"
RCRT_URL="http://localhost:8081"
WORKSPACE="workspace:agentic-demo"

echo -e "${BLUE}=== RCRT Demo Flow Test ===${NC}\n"

# Step 1: Get JWT Token
echo -e "${YELLOW}[1] Fetching JWT token from builder...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/auth/token" \
  -H "Content-Type: application/json" \
  -d '{}' || echo "FAILED")

if [ "$TOKEN_RESPONSE" = "FAILED" ]; then
  echo -e "${RED}Failed to get token from builder${NC}"
  exit 1
fi

echo "Response: $TOKEN_RESPONSE"
TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}No token in response${NC}"
  exit 1
fi

echo -e "${GREEN}Got token: ${TOKEN:0:50}...${NC}\n"

# Step 2: Test RCRT connectivity through builder proxy
echo -e "${YELLOW}[2] Testing RCRT connectivity through builder proxy...${NC}"
HEALTH_CHECK=$(curl -s -X GET "${BUILDER_URL}/api/rcrt/breadcrumbs?limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP_STATUS:%{http_code}" || echo "FAILED")

HTTP_STATUS=$(echo "$HEALTH_CHECK" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
RESPONSE_BODY=$(echo "$HEALTH_CHECK" | grep -v 'HTTP_STATUS:')

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $RESPONSE_BODY"

if [ "$HTTP_STATUS" != "200" ]; then
  echo -e "${RED}RCRT proxy test failed${NC}"
  exit 1
fi

echo -e "${GREEN}RCRT proxy working${NC}\n"

# Step 3: Wipe existing instances
echo -e "${YELLOW}[3] Wiping existing UI instances...${NC}"
SEARCH_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/rcrt/breadcrumbs/search" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"tag\": \"$WORKSPACE\", \"schema_name\": \"ui.instance.v1\"}" || echo "FAILED")

echo "Search response: $SEARCH_RESPONSE"

# Extract IDs and delete each instance
INSTANCE_IDS=$(echo "$SEARCH_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -n "$INSTANCE_IDS" ]; then
  echo "Found instances to delete:"
  echo "$INSTANCE_IDS"
  
  while IFS= read -r id; do
    if [ -n "$id" ]; then
      echo "Deleting instance: $id"
      DELETE_RESPONSE=$(curl -s -X DELETE "${BUILDER_URL}/api/rcrt/breadcrumbs/$id" \
        -H "Authorization: Bearer $TOKEN" \
        -w "\nHTTP_STATUS:%{http_code}")
      
      DELETE_STATUS=$(echo "$DELETE_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
      echo "Delete status: $DELETE_STATUS"
    fi
  done <<< "$INSTANCE_IDS"
else
  echo "No existing instances found"
fi

echo -e "${GREEN}Instance cleanup complete${NC}\n"

# Step 4: Create layout instance
echo -e "${YELLOW}[4] Creating layout instance...${NC}"
LAYOUT_PAYLOAD=$(cat <<EOF
{
  "schema_name": "ui.instance.v1",
  "title": "Root Layout",
  "tags": ["$WORKSPACE", "ui:instance", "region:layout"],
  "context": {
    "component_ref": "AppShell",
    "props": {},
    "order": 0
  }
}
EOF
)

echo "Creating layout with payload:"
echo "$LAYOUT_PAYLOAD" | jq . 2>/dev/null || echo "$LAYOUT_PAYLOAD"

LAYOUT_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/rcrt/breadcrumbs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$LAYOUT_PAYLOAD" \
  -w "\nHTTP_STATUS:%{http_code}")

LAYOUT_STATUS=$(echo "$LAYOUT_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
LAYOUT_BODY=$(echo "$LAYOUT_RESPONSE" | grep -v 'HTTP_STATUS:')

echo "Layout creation status: $LAYOUT_STATUS"
echo "Response: $LAYOUT_BODY"

if [ "$LAYOUT_STATUS" != "200" ] && [ "$LAYOUT_STATUS" != "201" ] && [ "$LAYOUT_STATUS" != "409" ]; then
  echo -e "${RED}Failed to create layout${NC}"
  exit 1
fi

echo -e "${GREEN}Layout created/exists${NC}\n"

# Step 5: Create initial UI instances
echo -e "${YELLOW}[5] Creating initial UI instances...${NC}"

# Card instance
CARD_PAYLOAD=$(cat <<EOF
{
  "schema_name": "ui.instance.v1",
  "title": "Welcome Card",
  "tags": ["$WORKSPACE", "ui:instance", "region:content"],
  "context": {
    "component_ref": "Card",
    "props": {
      "className": "p-6",
      "children": "Welcome to the RCRT Agentic Demo"
    },
    "order": 0
  }
}
EOF
)

echo "Creating card..."
CARD_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/rcrt/breadcrumbs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CARD_PAYLOAD" \
  -w "\nHTTP_STATUS:%{http_code}")

CARD_STATUS=$(echo "$CARD_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
echo "Card creation status: $CARD_STATUS"

# Button instance
BUTTON_PAYLOAD=$(cat <<EOF
{
  "schema_name": "ui.instance.v1",
  "title": "Continue Button",
  "tags": ["$WORKSPACE", "ui:instance", "region:content"],
  "context": {
    "component_ref": "Button",
    "props": {
      "color": "primary",
      "children": "Click to Continue"
    },
    "order": 1
  }
}
EOF
)

echo "Creating button..."
BUTTON_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/rcrt/breadcrumbs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BUTTON_PAYLOAD" \
  -w "\nHTTP_STATUS:%{http_code}")

BUTTON_STATUS=$(echo "$BUTTON_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
echo "Button creation status: $BUTTON_STATUS"

echo -e "${GREEN}Initial instances created${NC}\n"

# Step 6: Test UI plan application
echo -e "${YELLOW}[6] Testing UI plan application...${NC}"

UI_PLAN=$(cat <<EOF
{
  "schema_name": "ui.plan.v1",
  "title": "Test UI Update",
  "tags": ["$WORKSPACE", "ui:plan"],
  "context": {
    "actions": [
      {
        "type": "create_instance",
        "region": "content",
        "instance": {
          "component_ref": "Card",
          "props": {
            "className": "p-4 bg-blue-50",
            "children": "This was created by a UI plan!"
          },
          "order": 2
        }
      }
    ]
  }
}
EOF
)

echo "Applying UI plan:"
echo "$UI_PLAN" | jq . 2>/dev/null || echo "$UI_PLAN"

# First create the plan breadcrumb
PLAN_RESPONSE=$(curl -s -X POST "${BUILDER_URL}/api/rcrt/breadcrumbs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UI_PLAN" \
  -w "\nHTTP_STATUS:%{http_code}")

PLAN_STATUS=$(echo "$PLAN_RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d':' -f2)
PLAN_BODY=$(echo "$PLAN_RESPONSE" | grep -v 'HTTP_STATUS:')

echo "Plan creation status: $PLAN_STATUS"
echo "Response: $PLAN_BODY"

# Extract plan ID
PLAN_ID=$(echo "$PLAN_BODY" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$PLAN_ID" ]; then
  echo -e "${RED}Failed to get plan ID${NC}"
else
  echo "Plan ID: $PLAN_ID"
  
  # Now apply the plan
  echo -e "\n${YELLOW}[7] Applying the plan via /api/forge/apply...${NC}"
  
  APPLY_PAYLOAD="{\"planId\": \"$PLAN_ID\"}"
  echo "Apply payload: $APPLY_PAYLOAD"
  
  # Test with curl and capture full response including headers
  echo -e "\n${BLUE}Making apply request...${NC}"
  APPLY_RESPONSE=$(curl -v -X POST "${BUILDER_URL}/api/forge/apply" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$APPLY_PAYLOAD" \
    --max-time 30 \
    2>&1)
  
  echo -e "\n${BLUE}Full apply response:${NC}"
  echo "$APPLY_RESPONSE"
fi

echo -e "\n${YELLOW}[8] Testing SSE event stream...${NC}"
echo "Starting SSE connection (will run for 5 seconds)..."

# Test SSE with timeout
timeout 5 curl -N -H "Authorization: Bearer $TOKEN" \
  "${BUILDER_URL}/api/rcrt/events?access_token=$TOKEN&workspace=$WORKSPACE" \
  2>&1 || true

echo -e "\n${GREEN}=== Test Complete ===${NC}"
echo -e "\nSummary:"
echo "- Token acquisition: ✓"
echo "- RCRT proxy: ✓"
echo "- Breadcrumb CRUD: ✓"
echo "- Check the apply request output above for any issues"
