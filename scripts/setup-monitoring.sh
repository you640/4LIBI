#!/bin/bash
# ============================================
# ForenzDetectiv — Automatic Monitoring Setup
# Nastavi Sentry DSN a PostHog API key do .env
# ============================================

set -euo pipefail

# Farby pre output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cesta k .env
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"

# Overenie ci existuje curl a jq
command -v curl >/dev/null 2>&1 || { echo -e "${RED}Error: curl is required. Install: brew install curl || sudo apt install curl${NC}"; exit 1; }
command -v jq >/dev/null 2>&1 || { echo -e "${RED}Error: jq is required. Install: brew install jq || sudo apt install jq${NC}"; exit 1; }

# ============================================
# 1. SENTRY SETUP
# ============================================
echo -e "${BLUE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SENTRY ERROR MONITORING SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Ziskaj Sentry Auth Token
read -p "  Zadaj Sentry Auth Token (z https://sentry.io/settings/account/api/auth-tokens/): " SENTRY_TOKEN
SENTRY_TOKEN=${SENTRY_TOKEN:-}

if [[ -z "$SENTRY_TOKEN" ]]; then
    echo -e "${YELLOW}  ⚠️  Sentry token nebol zadaný — preskakujem Sentry setup${NC}"
    SENTRY_DSN=""
else
    # Skus najprv ziskat existujuci projekt
    echo -n "  Hladam existujuci Sentry projekt 'forenzdetectiv'..."
    PROJECTS=$(curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
        "https://sentry.io/api/0/projects/" 2>/dev/null || echo "[]")
    EXISTING_PROJECT=$(echo "$PROJECTS" | jq -r '.[] | select(.name == "forenzdetectiv") | .slug' | head -1)

    if [[ -n "$EXISTING_PROJECT" ]]; then
        echo -e "${GREEN} ✅ Našiel existujúci projekt: $EXISTING_PROJECT${NC}"
        SENTRY_DSN=$(curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
            "https://sentry.io/api/0/projects/$EXISTING_PROJECT/" | jq -r '.dsnPublic // ""')
        if [[ -z "$SENTRY_DSN" ]]; then
            echo -e "${RED}  ❌  Nepodarilo sa ziskat DSN pre projekt $EXISTING_PROJECT${NC}"
            SENTRY_DSN=""
        fi
    else
        # Vytvor novy projekt
        echo -n "  Vytvaram novy Sentry projekt 'forenzdetectiv'..."
        ORG_RESPONSE=$(curl -s -H "Authorization: Bearer $SENTRY_TOKEN" \
            "https://sentry.io/api/0/organizations/" 2>/dev/null || echo "[]")
        FIRST_ORG=$(echo "$ORG_RESPONSE" | jq -r '.[0].slug // ""')
        
        if [[ -z "$FIRST_ORG" ]]; then
            echo -e "${RED}  ❌  Nenašiel sa žiadna organizacia${NC}"
            echo "  1. Vytvor organizaciu na https://sentry.io/organizations/new/"
            SENTRY_DSN=""
        else
            PROJECT_RESPONSE=$(curl -s -X POST \
                -H "Authorization: Bearer $SENTRY_TOKEN" \
                -H "Content-Type: application/json" \
                -d "{\"name\":\"forenzdetectiv\"}" \
                "https://sentry.io/api/0/organizations/$FIRST_ORG/projects/" 2>/dev/null || echo "{}")
            
            SENTRY_DSN=$(echo "$PROJECT_RESPONSE" | jq -r '.dsnPublic // ""')
            if [[ -n "$SENTRY_DSN" ]]; then
                echo -e "${GREEN} ✅ Sentry projekt vytvoreny! DSN: $SENTRY_DSN${NC}"
            else
                echo -e "${YELLOW}  ⚠️  Nepodarilo sa vytvorit projekt${NC}"
                echo "  Skontroluj token a opravnenia"
                SENTRY_DSN=""
            fi
        fi
    fi
fi

# ============================================
# 2. POSTHOG SETUP
# ============================================
echo -e "${BLUE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  POSTHOG ANALYTICS SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Ziskaj PostHog Personal API Key
read -p "  Zadaj PostHog Personal API Key (z https://eu.i.posthog.com/project/settings): " POSTHOG_API_KEY
POSTHOG_API_KEY=${POSTHOG_API_KEY:-}

if [[ -z "$POSTHOG_API_KEY" ]]; then
    echo -e "${YELLOW}  ⚠️  PostHog API key nebol zadaný — preskakujem PostHog setup${NC}"
    POSTHOG_KEY=""
else
    # Skus najprv ziskat existujuci projekt
    echo -n "  Hladam existujuci PostHog projekt 'forenzdetectiv'..."
    POSTHOG_PROJECTS=$(curl -s -H "Authorization: Bearer $POSTHOG_API_KEY" \
        "https://eu.i.posthog.com/api/projects/" 2>/dev/null || echo "{\"results\":[]}")
    EXISTING_POSTHOG=$(echo "$POSTHOG_PROJECTS" | jq -r '.results[] | select(.name == "forenzdetectiv") | .api_key' | head -1)

    if [[ -n "$EXISTING_POSTHOG" ]]; then
        echo -e "${GREEN} ✅ Našiel existujúci PostHog projekt! API Key: $EXISTING_POSTHOG${NC}"
        POSTHOG_KEY="$EXISTING_POSTHOG"
    else
        # Vytvor novy projekt
        echo -n "  Vytvaram novy PostHog projekt 'forenzdetectiv'..."
        POSTHOG_RESPONSE=$(curl -s -X POST \
            -H "Authorization: Bearer $POSTHOG_API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"name":"forenzdetectiv"}' \
            "https://eu.i.posthog.com/api/projects/" 2>/dev/null || echo "{}")
        
        POSTHOG_KEY=$(echo "$POSTHOG_RESPONSE" | jq -r '.api_key // ""')
        if [[ -n "$POSTHOG_KEY" ]]; then
            echo -e "${GREEN} ✅ PostHog projekt vytvoreny! API Key: $POSTHOG_KEY${NC}"
        else
            echo -e "${YELLOW}  ⚠️  Nepodarilo sa vytvorit PostHog projekt${NC}"
            echo "  Skontroluj API key a opravnenia"
            POSTHOG_KEY=""
        fi
    fi
fi

# ============================================
# 3. UPDATE .env
# ============================================
echo -e "${BLUE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  UPDATE .env FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Backup existujuceho .env
if [[ -f "$ENV_FILE" ]]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
    echo "  Backup .env created: ${ENV_FILE}.backup-*"
fi

# Nastav Sentry DSN
if [[ -n "$SENTRY_DSN" ]]; then
    if [[ -f "$ENV_FILE" ]] && grep -q "VITE_SENTRY_DSN=" "$ENV_FILE" 2>/dev/null; then
        # Windows sed workaround
        if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            # Use temp file approach for Windows
            TEMP_FILE="${ENV_FILE}.tmp"
            awk -v dsn="$SENTRY_DSN" 'BEGIN{} /^VITE_SENTRY_DSN=/ {print "VITE_SENTRY_DSN=\"" dsn "\""; next} {print}' "$ENV_FILE" > "$TEMP_FILE"
            mv "$TEMP_FILE" "$ENV_FILE"
        else
            sed -i.bak "s|VITE_SENTRY_DSN=.*|VITE_SENTRY_DSN=\"$SENTRY_DSN\"|" "$ENV_FILE"
            rm -f "${ENV_FILE}.bak"
        fi
    else
        echo "VITE_SENTRY_DSN=\"$SENTRY_DSN\"" >> "$ENV_FILE"
    fi
    echo -e "  ${GREEN}✅ Sentry DSN updated${NC}"
else
    echo -e "  ${YELLOW}⚠️  Sentry DSN not set (skipped)${NC}"
fi

# Nastav PostHog Key
if [[ -n "$POSTHOG_KEY" ]]; then
    if [[ -f "$ENV_FILE" ]] && grep -q "VITE_POSTHOG_KEY=" "$ENV_FILE" 2>/dev/null; then
        if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
            TEMP_FILE="${ENV_FILE}.tmp"
            awk -v key="$POSTHOG_KEY" 'BEGIN{} /^VITE_POSTHOG_KEY=/ {print "VITE_POSTHOG_KEY=\"" key "\""; next} {print}' "$ENV_FILE" > "$TEMP_FILE"
            mv "$TEMP_FILE" "$ENV_FILE"
        else
            sed -i.bak "s|VITE_POSTHOG_KEY=.*|VITE_POSTHOG_KEY=\"$POSTHOG_KEY\"|" "$ENV_FILE"
            rm -f "${ENV_FILE}.bak"
        fi
    else
        echo "VITE_POSTHOG_KEY=\"$POSTHOG_KEY\"" >> "$ENV_FILE"
    fi
    echo -e "  ${GREEN}✅ PostHog API Key updated${NC}"
else
    echo -e "  ${YELLOW}⚠️  PostHog API Key not set (skipped)${NC}"
fi

# ============================================
# 4. VALIDACIA
# ============================================
echo -e "${BLUE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ -f "$ENV_FILE" ]]; then
    echo "  .env file contents (relevant lines):"
    grep -E "VITE_SENTRY_DSN|VITE_POSTHOG" "$ENV_FILE" | sed 's/^/    /' || true
fi

if [[ -n "$SENTRY_DSN" && -n "$POSTHOG_KEY" ]]; then
    echo -e "${GREEN}
  ✅ VSETKO HOTOVO!
  Spusti 'npm run dev' a monitoring by mal fungovat${NC}"
elif [[ -n "$SENTRY_DSN" || -n "$POSTHOG_KEY" ]]; then
    echo -e "${YELLOW}
  ⚠️  Castiarne nastavenie — over manualne${NC}"
else
    echo -e "${RED}
  ❌ Nic nebolo nastavene — skontroluj tokeny${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
