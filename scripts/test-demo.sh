#!/usr/bin/env bash
# =============================================================================
# Voisli Demo Readiness Check
# =============================================================================
# Verifies that all systems are ready for the hackathon demo.
# Run this before presenting to ensure everything works end-to-end.
#
# Usage:  ./scripts/test-demo.sh
# =============================================================================

set -euo pipefail

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No color

PASS=0
FAIL=0
WARN=0

BRIDGE_URL="${NEXT_PUBLIC_BRIDGE_SERVER_URL:-http://localhost:8080}"
DASHBOARD_URL="http://localhost:3001"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check_pass() {
  echo -e "  ${GREEN}✓${NC} $1"
  ((PASS++))
}

check_fail() {
  echo -e "  ${RED}✗${NC} $1"
  ((FAIL++))
}

check_warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
  ((WARN++))
}

section() {
  echo ""
  echo -e "${BOLD}${BLUE}── $1 ──${NC}"
}

# ---------------------------------------------------------------------------
# 1. Environment Variables
# ---------------------------------------------------------------------------

section "Environment Variables"

env_vars=(
  "TWILIO_ACCOUNT_SID"
  "TWILIO_AUTH_TOKEN"
  "TWILIO_PHONE_NUMBER"
  "GEMINI_API_KEY"
  "BRIDGE_SERVER_PORT"
  "NEXT_PUBLIC_BRIDGE_SERVER_URL"
  "PUBLIC_SERVER_URL"
  "GOOGLE_SERVICE_ACCOUNT_EMAIL"
  "GOOGLE_PRIVATE_KEY"
  "GOOGLE_CALENDAR_ID"
  "RECALL_API_KEY"
)

# Source .env if it exists (in case the shell doesn't have them)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

for var in "${env_vars[@]}"; do
  val="${!var:-}"
  if [ -z "$val" ]; then
    check_fail "$var is not set"
  elif [[ "$val" == your_* ]] || [[ "$val" == "+1234567890" ]] || [[ "$val" == https://your-* ]]; then
    check_warn "$var is still a placeholder value"
  else
    check_pass "$var is set"
  fi
done

# ---------------------------------------------------------------------------
# 2. Bridge Server
# ---------------------------------------------------------------------------

section "Bridge Server ($BRIDGE_URL)"

if curl -sf --max-time 5 "$BRIDGE_URL/status" > /dev/null 2>&1; then
  check_pass "Bridge server is running"

  # Health check
  HEALTH=$(curl -sf --max-time 15 "$BRIDGE_URL/health" 2>/dev/null || echo '{}')

  if [ "$HEALTH" != "{}" ]; then
    check_pass "/health endpoint responds"

    OVERALL=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
    if [ "$OVERALL" = "healthy" ]; then
      check_pass "Overall health: healthy"
    elif [ "$OVERALL" = "degraded" ]; then
      check_warn "Overall health: degraded (some services may be down)"
    else
      check_fail "Overall health: $OVERALL"
    fi

    # Check individual services
    for svc in twilio gemini googleCalendar recall; do
      SVC_STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('services',{}).get('$svc',{}).get('status','unknown'))" 2>/dev/null || echo "unknown")
      case "$SVC_STATUS" in
        healthy)     check_pass "  $svc: healthy" ;;
        unconfigured) check_warn "  $svc: unconfigured" ;;
        *)           check_fail "  $svc: $SVC_STATUS" ;;
      esac
    done
  else
    check_fail "/health endpoint did not respond"
  fi

  # Status endpoint
  STATUS=$(curl -sf --max-time 5 "$BRIDGE_URL/status" 2>/dev/null || echo '{}')
  if [ "$STATUS" != "{}" ]; then
    check_pass "/status endpoint responds"
  else
    check_fail "/status endpoint did not respond"
  fi

  # SSE endpoint
  SSE_RESPONSE=$(curl -sf --max-time 3 -H "Accept: text/event-stream" "$BRIDGE_URL/events" 2>/dev/null || echo "")
  if [ -n "$SSE_RESPONSE" ] || curl -sf --max-time 2 -o /dev/null -w "%{http_code}" "$BRIDGE_URL/events" 2>/dev/null | grep -q "200"; then
    check_pass "/events SSE endpoint is accessible"
  else
    check_warn "/events SSE endpoint may not be responding (this is OK if no events are queued)"
  fi

  # Calls endpoint
  CALLS=$(curl -sf --max-time 5 "$BRIDGE_URL/calls" 2>/dev/null || echo '')
  if [ -n "$CALLS" ]; then
    check_pass "/calls endpoint responds"
  else
    check_fail "/calls endpoint did not respond"
  fi

  # Meetings endpoint
  MEETINGS=$(curl -sf --max-time 5 "$BRIDGE_URL/meetings" 2>/dev/null || echo '')
  if [ -n "$MEETINGS" ]; then
    check_pass "/meetings endpoint responds"
  else
    check_fail "/meetings endpoint did not respond"
  fi

else
  check_fail "Bridge server is NOT running at $BRIDGE_URL"
  check_fail "  → Start it with: npm run dev:server"
fi

# ---------------------------------------------------------------------------
# 3. Next.js Dashboard
# ---------------------------------------------------------------------------

section "Next.js Dashboard ($DASHBOARD_URL)"

if curl -sf --max-time 5 "$DASHBOARD_URL" > /dev/null 2>&1; then
  check_pass "Dashboard is accessible"

  # Check key pages
  for page in "" "calls" "meetings" "demo" "integrations"; do
    PAGE_URL="$DASHBOARD_URL/$page"
    HTTP_CODE=$(curl -sf --max-time 5 -o /dev/null -w "%{http_code}" "$PAGE_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      check_pass "  /$page → 200 OK"
    else
      check_fail "  /$page → HTTP $HTTP_CODE"
    fi
  done
else
  check_fail "Dashboard is NOT running at $DASHBOARD_URL"
  check_fail "  → Start it with: npm run dev:web"
fi

# ---------------------------------------------------------------------------
# 4. Twilio Webhook Configuration
# ---------------------------------------------------------------------------

section "Twilio Webhook Configuration"

PUBLIC_URL="${PUBLIC_SERVER_URL:-}"

if [ -z "$PUBLIC_URL" ] || [[ "$PUBLIC_URL" == https://your-* ]]; then
  check_warn "PUBLIC_SERVER_URL is not configured — Twilio webhooks won't work"
  check_warn "  → Set up ngrok and update PUBLIC_SERVER_URL in .env"
else
  check_pass "PUBLIC_SERVER_URL is set to: $PUBLIC_URL"

  # Try to reach the public URL's TwiML endpoint
  TWIML_CODE=$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" "$PUBLIC_URL/twiml" 2>/dev/null || echo "000")
  if [ "$TWIML_CODE" = "200" ] || [ "$TWIML_CODE" = "405" ]; then
    check_pass "Public TwiML endpoint is reachable"
  else
    check_warn "Public TwiML endpoint returned HTTP $TWIML_CODE (may need POST)"
  fi

  # Verify Twilio phone number webhook via API (if credentials are set)
  TWILIO_SID="${TWILIO_ACCOUNT_SID:-}"
  TWILIO_TOKEN="${TWILIO_AUTH_TOKEN:-}"
  TWILIO_PHONE="${TWILIO_PHONE_NUMBER:-}"

  if [ -n "$TWILIO_SID" ] && [[ "$TWILIO_SID" != your_* ]] && [ -n "$TWILIO_TOKEN" ] && [[ "$TWILIO_TOKEN" != your_* ]] && [ -n "$TWILIO_PHONE" ] && [[ "$TWILIO_PHONE" != "+1234567890" ]]; then
    # URL-encode the phone number
    ENCODED_PHONE=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TWILIO_PHONE', safe=''))" 2>/dev/null || echo "")
    if [ -n "$ENCODED_PHONE" ]; then
      PHONE_INFO=$(curl -sf --max-time 10 \
        -u "$TWILIO_SID:$TWILIO_TOKEN" \
        "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/IncomingPhoneNumbers.json?PhoneNumber=$ENCODED_PHONE" 2>/dev/null || echo '{}')

      VOICE_URL=$(echo "$PHONE_INFO" | python3 -c "
import sys, json
data = json.load(sys.stdin)
numbers = data.get('incoming_phone_numbers', [])
if numbers:
    print(numbers[0].get('voice_url', ''))
else:
    print('')
" 2>/dev/null || echo "")

      if [ -n "$VOICE_URL" ]; then
        if [[ "$VOICE_URL" == *"$PUBLIC_URL"* ]]; then
          check_pass "Twilio voice webhook is correctly configured: $VOICE_URL"
        else
          check_warn "Twilio voice webhook points to: $VOICE_URL"
          check_warn "  Expected it to contain: $PUBLIC_URL"
        fi
      else
        check_warn "Could not read Twilio webhook URL (may need to configure in Twilio console)"
      fi
    fi
  else
    check_warn "Skipping Twilio API check (credentials not configured)"
  fi
fi

# ---------------------------------------------------------------------------
# 5. MCP Server
# ---------------------------------------------------------------------------

section "MCP Server"

if command -v npx &> /dev/null; then
  check_pass "npx is available"
else
  check_fail "npx is not installed"
fi

if [ -f "server/mcp/index.ts" ]; then
  check_pass "MCP server entry point exists (server/mcp/index.ts)"
else
  check_fail "MCP server entry point missing"
fi

if [ -f "mcp-config.json" ]; then
  check_pass "MCP config file exists (mcp-config.json)"
else
  check_warn "mcp-config.json not found"
fi

# ---------------------------------------------------------------------------
# 6. Build & Dependencies
# ---------------------------------------------------------------------------

section "Build & Dependencies"

if [ -d "node_modules" ]; then
  check_pass "node_modules exists"
else
  check_fail "node_modules missing — run: npm install"
fi

if [ -f ".env" ]; then
  check_pass ".env file exists"
else
  check_warn ".env file missing — copy from .env.example"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  Demo Readiness Summary${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}✓ Passed:${NC}   $PASS"
echo -e "  ${YELLOW}⚠ Warnings:${NC} $WARN"
echo -e "  ${RED}✗ Failed:${NC}   $FAIL"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}🎉 All systems GO — ready for demo!${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "  ${YELLOW}${BOLD}⚡ Mostly ready — review warnings above${NC}"
else
  echo -e "  ${RED}${BOLD}🔧 Issues found — fix failures above before demo${NC}"
fi

echo ""

# ---------------------------------------------------------------------------
# Demo Flow Quick Reference
# ---------------------------------------------------------------------------

echo -e "${BOLD}${BLUE}── Demo Flow Quick Reference ──${NC}"
echo ""
echo -e "${BOLD}Flow 1: Restaurant Reservation (Voice Call)${NC}"
echo "  1. Open dashboard: $DASHBOARD_URL/demo"
echo "  2. Click 'Start Demo Call' or call the Twilio number"
echo "  3. Say: 'Hi, I'd like to make a dinner reservation for tonight at 7pm'"
echo "  4. Watch: AI checks calendar → confirms availability → creates event"
echo "  5. Dashboard shows live tool calls and call status"
echo ""
echo -e "${BOLD}Flow 2: Meeting Assistant${NC}"
echo "  1. Open dashboard: $DASHBOARD_URL/demo"
echo "  2. Paste a Google Meet URL and click 'Join Meeting'"
echo "  3. Speak in the meeting — watch transcript stream live"
echo "  4. Ask the bot: 'Can you summarize what we discussed?'"
echo "  5. Bot speaks the summary; transcript shows bot response"
echo ""
echo -e "${BOLD}Flow 3: MCP Integration${NC}"
echo "  1. Open dashboard: $DASHBOARD_URL/demo"
echo "  2. View the MCP tool list (8 tools, 5 resources)"
echo "  3. Copy the config snippet into Claude Desktop / Claude Code"
echo "  4. Ask Claude to 'make a call' or 'check my calendar'"
echo "  5. Watch MCP tool invocations appear in the demo log"
echo ""

exit $FAIL
