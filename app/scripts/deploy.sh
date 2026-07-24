#!/bin/bash
# Cloudflare deployment convenience script
# Usage: bash scripts/deploy.sh [--env <env>] [--skip-build]
#
# This script is the foundation for later GitHub Actions automation.
# For now it's a single-user manual convenience; later it becomes
# the source for CI/CD (GitHub Actions will call similar steps).

set -e

# Defaults
ENV="${ENV:-production}"
SKIP_BUILD=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENV="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    *)
      echo "Usage: deploy.sh [--env <env>] [--skip-build]"
      exit 1
      ;;
  esac
done

echo "=== Dart Analytics Deployment ==="
echo "Environment: $ENV"
echo "Skip build: $SKIP_BUILD"
echo ""

cd "$APP_DIR"

# Phase 1: Validate prerequisites
echo "[1/4] Validating prerequisites..."
if ! bash scripts/validate-deployment-prerequisites.sh; then
  echo "✗ Prerequisites check failed. Fix issues above and retry."
  exit 1
fi
echo "✓ Prerequisites OK"
echo ""

# Phase 2: Build (optional)
if [ "$SKIP_BUILD" = false ]; then
  echo "[2/4] Building Astro project..."
  npm run build
  echo "✓ Build complete"
  echo ""
else
  echo "[2/4] Skipping build (--skip-build)"
  echo ""
fi

# Phase 3: Deploy to Wrangler
echo "[3/4] Deploying to Cloudflare Workers..."
wrangler deploy --env "$ENV"
echo "✓ Workers deploy complete"
echo ""

# Phase 4: Verify deployment
echo "[4/4] Verifying deployment..."
echo "Testing API endpoint..."
sleep 2  # Allow time for Cloudflare propagation
if curl -s -X GET "https://dart-analytics-api.workers.dev/api/sessions/active" \
  -H "Content-Type: application/json" | grep -q "UNAUTHORIZED"; then
  echo "✓ API endpoint responding (401 expected without JWT)"
else
  echo "⚠ API endpoint did not respond as expected; manual check recommended"
fi
echo ""

echo "=== Deployment Complete ==="
echo "Frontend: https://dart-analytics-api.pages.dev"
echo "API: https://dart-analytics-api.workers.dev/api"
echo ""
echo "Next: Monitor Neon + Cloudflare dashboards for any errors."
