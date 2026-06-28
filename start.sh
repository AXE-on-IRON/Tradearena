#!/bin/bash
# ─────────────────────────────────────────────────────────
# TradeArena — Start Script
# ─────────────────────────────────────────────────────────

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}📈 Starting TradeArena...${NC}"
echo ""

# Detect Python (prefer conda env)
PY=""
if command -v conda &>/dev/null && conda env list | grep -q "tradearena"; then
  PY="$(conda run -n tradearena which python)"
else
  for cmd in python3.11 python3.10 python3.9 python3.12 python3 python; do
    if command -v $cmd &>/dev/null; then
      VER=$($cmd -c "import sys; print(sys.version_info[:2])")
      if [[ "$VER" != "(3, 13)" ]]; then
        PY=$cmd
        break
      fi
    fi
  done
fi

if [ -z "$PY" ]; then
  echo "❌ No compatible Python found. Run ./setup.sh first."
  exit 1
fi

trap "echo ''; echo 'Shutting down TradeArena...'; kill 0" SIGINT

# Start backend
echo -e "${GREEN}▶ Backend  → http://localhost:8000${NC}"
if command -v conda &>/dev/null && conda env list | grep -q "tradearena"; then
  conda run -n tradearena python backend/app.py &
else
  $PY backend/app.py &
fi

# Small delay so backend starts first
sleep 2

# Start frontend
echo -e "${GREEN}▶ Frontend → http://localhost:5173${NC}"
cd frontend && npm run dev &
cd ..

echo ""
echo -e "${CYAN}✅ TradeArena is running!${NC}"
echo -e "   Open ${CYAN}http://localhost:5173${NC} in your browser"
echo ""
echo "Press Ctrl+C to stop."

wait
