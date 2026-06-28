#!/bin/bash
# ─────────────────────────────────────────────────────────
# TradeArena — Auto Setup Script
# Works on Mac, Linux, Windows (Git Bash)
# ─────────────────────────────────────────────────────────

set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  📈 TradeArena — Setup"
echo -e "${NC}"

# ── Check Node.js ─────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js not found.${NC}"
  echo "   Install from: https://nodejs.org (download LTS version)"
  exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# ── Check Python ──────────────────────────────────────────
PY=""
for cmd in python3.11 python3.10 python3.9 python3.12 python3 python; do
  if command -v $cmd &>/dev/null; then
    VER=$($cmd -c "import sys; print(sys.version_info[:2])")
    if [[ "$VER" != "(3, 13)" ]]; then
      PY=$cmd
      break
    fi
  fi
done

# If only Python 3.13 is available, use conda to create 3.11 env
if [ -z "$PY" ]; then
  if command -v conda &>/dev/null; then
    echo -e "${YELLOW}⚠  Python 3.13 detected. Creating Python 3.11 conda environment...${NC}"
    conda create -n tradearena python=3.11 -y 2>/dev/null || true
    PY="$(conda run -n tradearena which python)"
  else
    echo -e "${RED}❌ Compatible Python not found (need 3.9–3.12).${NC}"
    echo "   Install Python 3.11 from: https://python.org"
    exit 1
  fi
fi

echo -e "${GREEN}✓ Python: $($PY --version)${NC}"

# ── .env setup ────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠  Created .env from template. Add your API keys later (optional).${NC}"
fi

# ── Install backend deps ──────────────────────────────────
echo ""
echo "📦 Installing backend dependencies..."
if command -v conda &>/dev/null && conda env list | grep -q "tradearena"; then
  conda run -n tradearena pip install -r backend/requirements.txt -q
else
  $PY -m pip install -r backend/requirements.txt -q
fi
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# ── Install frontend deps ─────────────────────────────────
echo "📦 Installing frontend dependencies..."
cd frontend && npm install --silent && cd ..
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start TradeArena, run:"
echo -e "  ${CYAN}./start.sh${NC}"
echo ""
