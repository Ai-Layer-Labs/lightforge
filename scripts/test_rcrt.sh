#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8081}"
OWNER_ID="${OWNER_ID:-00000000-0000-0000-0000-000000000001}"
AGENT_ID="${AGENT_ID:-00000000-0000-0000-0000-0000000000aa}"

echo "[0] Waiting for API $BASE_URL/health"
READY=0
for i in $(seq 1 60); do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then echo "API not ready after 60s"; exit 1; fi

echo "[1] Health check"
curl -fsS "$BASE_URL/health" | sed -e 's/.*/OK: &/'

echo "[2] Start webhook receiver on :8082"
# Choose a Python executable (python3 → python → py -3)
if command -v python3 >/dev/null 2>&1; then PYTHON_BIN=python3;
elif command -v python >/dev/null 2>&1; then PYTHON_BIN=python;
elif command -v py >/dev/null 2>&1; then PYTHON_BIN="py -3";
else echo "Python not found. Set PYTHON_BIN env var."; exit 1; fi

( PORT=8082 $PYTHON_BIN scripts/webhook_receiver.py ) >/tmp/rcrt_webhook.log 2>&1 &
RCVR_PID=$!
trap 'kill $RCVR_PID || true' EXIT
sleep 1

echo "[2.4] Ensure tenant"
curl -fsS -X POST "$BASE_URL/tenants/$OWNER_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"local-tenant"}' | tee /tmp/rcrt_tenant.json

echo "[2.5] Register agent"
curl -fsS -X POST "$BASE_URL/agents/$AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"roles":["curator","emitter","subscriber"]}' | tee /tmp/rcrt_agent.json

echo "[3] Register webhook for agent $AGENT_ID"
curl -fsS -X POST "$BASE_URL/agents/$AGENT_ID/webhooks" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://host.docker.internal:8082/webhook"}' | tee /tmp/rcrt_register_webhook.json

echo "[4] Create selector subscription (tags: travel)"
curl -fsS -X POST "$BASE_URL/subscriptions/selectors" \
  -H "Content-Type: application/json" \
  -d '{"any_tags":["travel"]}' | tee /tmp/rcrt_selector.json

echo "[5] Start SSE stream in background"
curl -fsS "$BASE_URL/events/stream" --no-buffer > /tmp/rcrt_sse.log 2>&1 &
SSE_PID=$!
sleep 1

echo "[6] Create breadcrumb (Idempotency-Key)"
IDEMP_KEY="test-ikey-$(date +%s)"
CREATE_RESP=$(curl -fsS -X POST "$BASE_URL/breadcrumbs" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMP_KEY" \
  -d '{"title":"Travel Dates","context":{"start_date":"2025-10-20","end_date":"2025-10-28","timezone":"Europe/London"},"tags":["travel","dates"],"schema_name":"travel.dates.v1","visibility":"team","sensitivity":"low"}')
echo "$CREATE_RESP" | tee /tmp/rcrt_create.json

BC_ID=$(echo "$CREATE_RESP" | grep -oE '[0-9a-f-]{36}' | head -n1)
if [[ -z "${BC_ID}" ]]; then echo "Failed to parse breadcrumb id"; exit 1; fi
echo "Breadcrumb ID: $BC_ID"

echo "[7] Get breadcrumb context"
curl -fsS "$BASE_URL/breadcrumbs/$BC_ID" | tee /tmp/rcrt_get_ctx.json

echo "[8] Get breadcrumb full"
curl -fsS "$BASE_URL/breadcrumbs/$BC_ID/full" | tee /tmp/rcrt_get_full.json

echo "[9] Get history"
curl -fsS "$BASE_URL/breadcrumbs/$BC_ID/history" | tee /tmp/rcrt_history.json

echo "[10] List breadcrumbs (tag=travel)"
curl -fsS "$BASE_URL/breadcrumbs?tag=travel" | tee /tmp/rcrt_list.json

echo "[11] Verify SSE and webhook logs"
sleep 2
echo "--- SSE log (tail) ---"
tail -n +1 /tmp/rcrt_sse.log || true
echo "--- Webhook log (tail) ---"
tail -n +1 /tmp/rcrt_webhook.log || true

kill $SSE_PID || true
echo "Done"


