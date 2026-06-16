"""
TradeArena — FastAPI Backend
Provides REST endpoints + WebSocket price feed.
"""
import asyncio
import json
import os
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv

from db.database import get_db, init_db, Portfolio, Position, Order, Trade
from services.data_feed import (
    get_quote, get_history, get_forex_pairs, get_commodities,
    get_bonds, get_crypto, get_indices, search_symbol
)

load_dotenv()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ─── Lifespan (replaces deprecated startup event) ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="TradeArena API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── WebSocket connection manager ────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []
        self.subscriptions: dict[WebSocket, set] = {}

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        self.subscriptions[ws] = set()

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        self.subscriptions.pop(ws, None)

    def subscribe(self, ws: WebSocket, symbols: list[str]):
        self.subscriptions[ws].update(symbols)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws/prices")
async def ws_prices(websocket: WebSocket):
    """
    WebSocket endpoint — pushes live prices every 2 seconds.
    Client sends: {"subscribe": ["AAPL", "EURUSD=X", ...]}
    Server sends: {"type": "price", "data": {...}}
    """
    await manager.connect(websocket)
    try:
        # Default subscription on connect
        default_syms = ["AAPL", "TSLA", "EURUSD=X", "GC=F", "CL=F", "BTC-USD", "0700.HK"]
        manager.subscribe(websocket, default_syms)

        async def recv_loop():
            while True:
                try:
                    msg = await websocket.receive_json()
                    if "subscribe" in msg:
                        manager.subscribe(websocket, msg["subscribe"])
                except Exception:
                    break

        async def send_loop():
            while True:
                symbols = list(manager.subscriptions.get(websocket, set()))
                for sym in symbols:
                    try:
                        quote = await get_quote(sym)
                        await websocket.send_json({"type": "price", "data": quote})
                    except Exception:
                        pass
                await asyncio.sleep(2)

        await asyncio.gather(recv_loop(), send_loop())
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ─── Market Data Endpoints ───────────────────────────────────────────────────
@app.get("/api/market/quote/{symbol}")
async def quote(symbol: str):
    return await get_quote(symbol)


@app.get("/api/market/history/{symbol}")
async def history(
    symbol: str,
    period: str = Query("1y", description="1d 5d 1mo 3mo 6mo 1y 2y 5y 10y ytd max"),
    interval: str = Query("1d", description="1m 5m 15m 30m 60m 1d 1wk 1mo")
):
    data = await get_history(symbol, period, interval)
    return {"symbol": symbol, "period": period, "interval": interval, "candles": data}


@app.get("/api/market/forex")
async def forex():
    return await get_forex_pairs()


@app.get("/api/market/commodities")
async def commodities():
    return await get_commodities()


@app.get("/api/market/bonds")
async def bonds():
    return await get_bonds()


@app.get("/api/market/crypto")
async def crypto():
    return await get_crypto()


@app.get("/api/market/indices")
async def indices():
    return await get_indices()


@app.get("/api/market/search")
async def search(q: str = Query(..., min_length=1)):
    return await search_symbol(q)


# ─── Portfolio Endpoints ──────────────────────────────────────────────────────
@app.get("/api/portfolio")
def get_portfolio(db: Session = Depends(get_db)):
    portfolio = db.query(Portfolio).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "cash_balance": portfolio.cash_balance,
        "base_currency": portfolio.base_currency,
        "positions": [
            {
                "id": p.id,
                "symbol": p.symbol,
                "name": p.name,
                "asset_class": p.asset_class,
                "exchange": p.exchange,
                "quantity": p.quantity,
                "avg_cost": p.avg_cost,
                "currency": p.currency,
                "opened_at": p.opened_at.isoformat(),
            }
            for p in positions
        ],
    }


@app.get("/api/portfolio/performance")
async def portfolio_performance(db: Session = Depends(get_db)):
    """Calculate live P&L for all open positions."""
    portfolio = db.query(Portfolio).first()
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    trades = db.query(Trade).filter(Trade.portfolio_id == portfolio.id).all()

    total_market_value = 0.0
    total_cost = 0.0
    position_details = []

    for p in positions:
        quote = await get_quote(p.symbol)
        current_price = quote.get("price") or p.avg_cost
        market_value = p.quantity * current_price
        cost_basis = p.quantity * p.avg_cost
        unrealized_pnl = market_value - cost_basis

        total_market_value += market_value
        total_cost += cost_basis

        position_details.append({
            "symbol": p.symbol,
            "name": p.name,
            "asset_class": p.asset_class,
            "quantity": p.quantity,
            "avg_cost": p.avg_cost,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "unrealized_pnl_pct": round((unrealized_pnl / cost_basis * 100) if cost_basis else 0, 2),
            "currency": p.currency,
        })

    realized_pnl = sum(t.pnl or 0 for t in trades)
    total_equity = portfolio.cash_balance + total_market_value
    total_pnl = total_market_value - total_cost + realized_pnl

    return {
        "cash_balance": round(portfolio.cash_balance, 2),
        "total_market_value": round(total_market_value, 2),
        "total_equity": round(total_equity, 2),
        "total_cost": round(total_cost, 2),
        "unrealized_pnl": round(total_market_value - total_cost, 2),
        "realized_pnl": round(realized_pnl, 2),
        "total_pnl": round(total_pnl, 2),
        "positions": position_details,
    }


# ─── Order Endpoints ──────────────────────────────────────────────────────────
class OrderRequest(BaseModel):
    symbol: str
    name: str = ""
    asset_class: str = "stock"
    side: str                   # buy | sell
    order_type: str = "market"  # market | limit | stop
    quantity: float
    limit_price: Optional[float] = None
    stop_price: Optional[float] = None
    leverage: float = 1.0
    exchange: str = ""
    currency: str = "USD"


@app.post("/api/orders")
async def place_order(req: OrderRequest, db: Session = Depends(get_db)):
    """Execute a simulated order."""
    portfolio = db.query(Portfolio).first()

    # Get current price for market orders
    quote = await get_quote(req.symbol)
    current_price = quote.get("price")

    if current_price is None and req.order_type == "market":
        raise HTTPException(status_code=400, detail=f"Cannot fetch price for {req.symbol}")

    exec_price = current_price if req.order_type == "market" else req.limit_price
    total_cost = (exec_price or 0) * req.quantity * (1 / req.leverage)

    if req.side == "buy":
        if portfolio.cash_balance < total_cost:
            raise HTTPException(status_code=400, detail="Insufficient cash balance")
        portfolio.cash_balance -= total_cost

        # Update or create position
        position = db.query(Position).filter(
            Position.portfolio_id == portfolio.id,
            Position.symbol == req.symbol
        ).first()

        if position:
            new_qty = position.quantity + req.quantity
            position.avg_cost = (position.avg_cost * position.quantity + exec_price * req.quantity) / new_qty
            position.quantity = new_qty
        else:
            db.add(Position(
                portfolio_id=portfolio.id,
                symbol=req.symbol,
                name=req.name or req.symbol,
                asset_class=req.asset_class,
                exchange=req.exchange,
                quantity=req.quantity,
                avg_cost=exec_price,
                currency=req.currency,
            ))

    elif req.side == "sell":
        position = db.query(Position).filter(
            Position.portfolio_id == portfolio.id,
            Position.symbol == req.symbol
        ).first()

        if not position or position.quantity < req.quantity:
            raise HTTPException(status_code=400, detail="Insufficient position size")

        proceeds = exec_price * req.quantity
        pnl = (exec_price - position.avg_cost) * req.quantity
        portfolio.cash_balance += proceeds

        position.quantity -= req.quantity
        if position.quantity <= 0.0001:
            db.delete(position)

        # Record trade with P&L
        db.add(Trade(
            portfolio_id=portfolio.id,
            symbol=req.symbol,
            name=req.name or req.symbol,
            asset_class=req.asset_class,
            side="sell",
            quantity=req.quantity,
            price=exec_price,
            total_value=proceeds,
            pnl=round(pnl, 2),
            currency=req.currency,
            exchange=req.exchange,
        ))

    # Log order
    order = Order(
        portfolio_id=portfolio.id,
        symbol=req.symbol,
        asset_class=req.asset_class,
        side=req.side,
        order_type=req.order_type,
        quantity=req.quantity,
        limit_price=req.limit_price,
        filled_price=exec_price,
        status="filled" if req.order_type == "market" else "pending",
        leverage=req.leverage,
        filled_at=datetime.utcnow() if req.order_type == "market" else None,
    )
    db.add(order)

    # Log buy trade
    if req.side == "buy":
        db.add(Trade(
            portfolio_id=portfolio.id,
            symbol=req.symbol,
            name=req.name or req.symbol,
            asset_class=req.asset_class,
            side="buy",
            quantity=req.quantity,
            price=exec_price,
            total_value=total_cost,
            pnl=None,
            currency=req.currency,
            exchange=req.exchange,
        ))

    db.commit()
    return {
        "status": "filled" if req.order_type == "market" else "pending",
        "symbol": req.symbol,
        "side": req.side,
        "quantity": req.quantity,
        "price": exec_price,
        "total": round(total_cost if req.side == "buy" else exec_price * req.quantity, 2),
        "cash_balance": round(portfolio.cash_balance, 2),
    }


@app.get("/api/orders")
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(Order).order_by(Order.created_at.desc()).limit(100).all()
    return [
        {
            "id": o.id,
            "symbol": o.symbol,
            "asset_class": o.asset_class,
            "side": o.side,
            "order_type": o.order_type,
            "quantity": o.quantity,
            "limit_price": o.limit_price,
            "filled_price": o.filled_price,
            "status": o.status,
            "leverage": o.leverage,
            "created_at": o.created_at.isoformat(),
            "filled_at": o.filled_at.isoformat() if o.filled_at else None,
        }
        for o in orders
    ]


@app.get("/api/trades")
def get_trades(db: Session = Depends(get_db)):
    trades = db.query(Trade).order_by(Trade.executed_at.desc()).limit(200).all()
    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "name": t.name,
            "asset_class": t.asset_class,
            "side": t.side,
            "quantity": t.quantity,
            "price": t.price,
            "total_value": t.total_value,
            "pnl": t.pnl,
            "currency": t.currency,
            "exchange": t.exchange,
            "executed_at": t.executed_at.isoformat(),
        }
        for t in trades
    ]


@app.post("/api/portfolio/reset")
def reset_portfolio(db: Session = Depends(get_db)):
    """Reset portfolio to starting balance."""
    db.query(Position).delete()
    db.query(Order).delete()
    db.query(Trade).delete()
    portfolio = db.query(Portfolio).first()
    portfolio.cash_balance = 100000.0
    db.commit()
    return {"message": "Portfolio reset to $100,000"}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
