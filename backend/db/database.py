"""
SQLite database setup using SQLAlchemy.
Compatible with SQLAlchemy 1.4+ and 2.0+
"""
from datetime import datetime
import os

# SQLAlchemy 1.4 / 2.0 compatible imports
try:
    from sqlalchemy.orm import declarative_base
except ImportError:
    from sqlalchemy.ext.declarative import declarative_base

from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "sqlite:///./tradearena.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Portfolio(Base):
    __tablename__ = "portfolio"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="My Portfolio")
    cash_balance = Column(Float, default=100000.0)
    base_currency = Column(String, default="USD")
    created_at = Column(DateTime, default=datetime.utcnow)


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    name = Column(String)
    asset_class = Column(String)
    exchange = Column(String)
    quantity = Column(Float)
    avg_cost = Column(Float)
    currency = Column(String)
    opened_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    asset_class = Column(String)
    side = Column(String)
    order_type = Column(String)
    quantity = Column(Float)
    limit_price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    filled_price = Column(Float, nullable=True)
    status = Column(String, default="pending")
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
    side = Column(String)
    quantity = Column(Float)
    price = Column(Float)
    total_value = Column(Float)
    pnl = Column(Float, nullable=True)
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
    db = SessionLocal()
    if db.query(Portfolio).count() == 0:
        db.add(Portfolio(name="My Portfolio", cash_balance=100000.0, base_currency="USD"))
        db.commit()
    db.close()
