#!/bin/bash
# =============================================================================
# Production deploy for FinanceManager — pulls latest code, rebuilds via Docker,
# and verifies the backend is actually healthy. Run this from the project root
# on the server (~/financemanager). FinanceManager lives on the SAME VPS as
# ReplyPilot (finance.pilotmessenger.com is a subdomain served by the shared
# host nginx), so this script only touches the finance containers — it never
# touches pilot_* services.
#
# Why this exists (same reasoning as ReplyPilot): the DB schema is applied on
# backend startup, so the container must always be built from the LATEST code.
# Rebuilding Docker on stale, un-pulled code silently reuses old schema
# expectations. "pull, then build" is one step so that mistake can't recur.
# =============================================================================
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "→ Checking for local changes that would block a pull..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo ""
  echo "  ERROR: You have uncommitted local changes. Resolve or stash them first:"
  git status --short
  exit 1
fi

echo "→ Pulling latest code..."
git pull origin main

echo "→ Rebuilding and restarting backend + frontend via Docker..."
docker compose up -d --build backend frontend

echo "→ Waiting for backend to report healthy..."
for i in $(seq 1 20); do
  # /health is the public liveness probe (no auth). curl is not installed in
  # the image, so probe with the standard library.
  if docker exec finance_backend python -c "import urllib.request,sys; urllib.request.urlopen('http://localhost:8001/health', timeout=3)" &>/dev/null; then
    echo "  Backend is up"
    break
  fi
  printf "."
  sleep 2
done

echo ""
echo "→ Confirm the schema/tables are present (should list companies, invoices, ...):"
docker exec finance_backend python -c "import sqlite3; print(sorted(r[0] for r in sqlite3.connect('/app/data/finance.db').execute(\"SELECT name FROM sqlite_master WHERE type='table'\")))"

echo ""
echo "→ Recent backend logs (check for errors below):"
docker logs --tail 30 finance_backend

echo ""
echo "✓ Deploy complete. finance.pilotmessenger.com should be served by nginx → backend:8001 / frontend:4001."
