#!/bin/bash
# Cloudflare deployment prerequisite checker
# Run before attempting any deployment: bash scripts/validate-deployment-prerequisites.sh

set -e

echo "=== Dart Analytics Deployment Prerequisites Check ==="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

# Check Node version
echo -n "Node.js (>=22.12.0): "
if command -v node &> /dev/null; then
  node_version=$(node --version | cut -d'v' -f2)
  echo -e "${GREEN}✓${NC} $node_version"
else
  echo -e "${RED}✗ Not installed${NC}"
  errors=$((errors + 1))
fi

# Check npm
echo -n "npm: "
if command -v npm &> /dev/null; then
  npm_version=$(npm --version)
  echo -e "${GREEN}✓${NC} $npm_version"
else
  echo -e "${RED}✗ Not installed${NC}"
  errors=$((errors + 1))
fi

# Check wrangler
echo -n "Wrangler CLI: "
if command -v wrangler &> /dev/null || npx wrangler --version &> /dev/null; then
  wrangler_version=$(wrangler --version 2>/dev/null || npx wrangler --version 2>/dev/null | head -1)
  echo -e "${GREEN}✓${NC} $wrangler_version"
else
  echo -e "${RED}✗ Not installed${NC}"
  echo "  Fix: npm install -g wrangler"
  errors=$((errors + 1))
fi

# Check neon CLI
echo -n "Neon CLI: "
if command -v neon &> /dev/null || npx neon --version &> /dev/null; then
  echo -e "${GREEN}✓ Installed${NC}"
else
  echo -e "${YELLOW}⚠ Optional (for local env setup)${NC}"
  warnings=$((warnings + 1))
fi

# Check wrangler.toml exists
echo -n "wrangler.toml exists: "
if [ -f "wrangler.toml" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ Not found in app/ directory${NC}"
  errors=$((errors + 1))
fi

# Check wrangler.toml account_id filled
echo -n "wrangler.toml account_id filled: "
if grep -q "account_id = \"[^Y]" wrangler.toml 2>/dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠ Still contains placeholder${NC}"
  warnings=$((warnings + 1))
fi

# Check .env.production exists
echo -n ".env.production exists: "
if [ -f ".env.production" ]; then
  echo -e "${GREEN}✓${NC}"
  # Check if it has values
  if grep -q "postgresql://" .env.production; then
    echo -e "  ${GREEN}✓ Contains database connection${NC}"
  else
    echo -e "  ${YELLOW}⚠ Missing values (expected after 'neon env main')${NC}"
    warnings=$((warnings + 1))
  fi
else
  echo -e "${YELLOW}⚠ Not found (expected after 'neon env main')${NC}"
  warnings=$((warnings + 1))
fi

# Check Git status
echo -n "Git repository clean: "
if [ -d "../.git" ]; then
  if git diff --quiet && git diff --cached --quiet; then
    echo -e "${GREEN}✓${NC}"
  else
    echo -e "${YELLOW}⚠ Uncommitted changes${NC}"
    warnings=$((warnings + 1))
  fi
else
  echo -e "${RED}✗ Not a git repository${NC}"
  errors=$((errors + 1))
fi

# Check Cloudflare auth
echo -n "Wrangler authentication: "
if wrangler whoami &> /dev/null || npx wrangler whoami &> /dev/null; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠ Run 'wrangler login' first${NC}"
  warnings=$((warnings + 1))
fi

echo ""
echo "=== Summary ==="
if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
  echo -e "${GREEN}✓ All prerequisites met. Ready to deploy.${NC}"
  exit 0
elif [ $errors -eq 0 ]; then
  echo -e "${YELLOW}⚠ $warnings warning(s). Deployment may succeed but verify above.${NC}"
  exit 0
else
  echo -e "${RED}✗ $errors error(s) found. Fix above before deploying.${NC}"
  exit 1
fi
