"""
SQLite database setup using SQLAlchemy.
Stores portfolio, positions, orders, and trade history locally.
"""
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Boolean, Text
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./tradearena.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Portfolio(Base):
    __tablename__ = "portfolio"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="My Portfolio")
    cash_balance = Column(Float, default=100000.0)   # USD
    base_currency = Column(String, default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    name = Column(String)
    asset_class = Column(String)   # stock | forex | commodity | bond | crypto
    exchange = Column(String)
    quantity = Column(Float)        # positive = long, negative = short
    avg_cost = Column(Float)        # average cost per unit
    currency = Column(String)       # native currency of asset
    opened_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    asset_class = Column(String)
    side = Column(String)           # buy | sell
    order_type = Column(String)     # market | limit | stop
    quantity = Column(Float)
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    filled_price = Column(Float, nullable=True)
    status = Column(String, default="pending")  # pending | filled | cancelled
    leverage = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    filled_at = Column(DateTime, nullable=True)


class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    name = Column(String)
    asset_class = Column(String)
    side = Column(String)           # buy | sell
    quantity = Column(Float)
    price = Column(Float)
    total_value = Column(Float)     # quantity * price (in USD)
    pnl = Column(Float, nullable=True)   # realized P&L on close
    currency = Column(String)
    exchange = Column(String)
    executed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    # Seed default portfolio if not exists
    db = SessionLocal()
    if db.query(Portfolio).count() == 0:
        db.add(Portfolio(name="My Portfolio", cash_balance=100000.0, base_currency="USD"))
        db.commit()
    db.close()
