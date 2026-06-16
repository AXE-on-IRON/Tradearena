#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# TradeArena — One-click start script
# Usage: ./scripts/start.sh
# ─────────────────────────────────────────────────────────────────

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ████████╗██████╗  █████╗ ██████╗ ███████╗"
echo "     ██╔══╝██╔══██╗██╔══██╗██╔══██╗██╔════╝"
echo "     ██║   ██████╔╝███████║██║  ██║█████╗  "
echo "     ██║   ██╔══██╗██╔══██║██║  ██║██╔══╝  "
echo "     ██║   ██║  ██║██║  ██║██████╔╝███████╗"
echo "     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝"
echo "          A R E N A   —   Trading Simulator"
echo -e "${NC}"

# Check .env
if [ ! -f .env ]; then
  echo -e "${YELLOW}⚠  No .env found — copying from .env.example${NC}"
  cp .env.example .env
  echo -e "${YELLOW}   Edit .env and add your API keys, then re-run.${NC}"
fi

# Check Python
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "❌  Python 3 not found. Install from https://python.org"
  exit 1
fi
PY=$(command -v python3 || command -v python)

# Check Node
if ! command -v node &>/dev/null; then
  echo "❌  Node.js not found. Install from https://nodejs.org"
  exit 1
fi

echo -e "${GREEN}✓ Python: $($PY --version)${NC}"
echo -e "${GREEN}✓ Node:   $(node --version)${NC}"
echo ""

# Install backend deps
echo "📦  Installing backend dependencies…"
cd backend && $PY -m pip install -r requirements.txt -q && cd ..

# Install frontend deps
if [ ! -d frontend/node_modules ]; then
  echo "📦  Installing frontend dependencies…"
  cd frontend && npm install --silent && cd ..
fi

echo ""
echo -e "${GREEN}🚀  Starting TradeArena…${NC}"
echo -e "    Backend  → ${CYAN}http://localhost:8000${NC}"
echo -e "    Frontend → ${CYAN}http://localhost:5173${NC}"
echo ""

# Start both
trap "echo ''; echo 'Shutting down…'; kill 0" SIGINT

cd backend && $PY app.py &
BACKEND_PID=$!
cd ..

cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

wait $BACKEND_PID $FRONTEND_PID
