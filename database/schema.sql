-- Sky Exchange Database Schema

-- Users: accounts with a simulated wallet balance
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    balance DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    is_suspended BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Matches: sports events
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    sport VARCHAR(50) NOT NULL,
    team_a VARCHAR(100) NOT NULL,
    team_b VARCHAR(100) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming',  -- upcoming, live, completed
    winning_outcome VARCHAR(100),                      -- set on settlement
    is_visible BOOLEAN NOT NULL DEFAULT true,          -- admin can hide from users
    is_locked BOOLEAN NOT NULL DEFAULT false,           -- visible but no bets accepted
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Markets: what you can bet on within a match (e.g. "Match Winner")
CREATE TABLE markets (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL REFERENCES matches(id),
    name VARCHAR(100) NOT NULL,           -- e.g. "Match Winner"
    status VARCHAR(20) NOT NULL DEFAULT 'open',  -- open, suspended, closed
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Odds: current back/lay prices for each outcome in a market
CREATE TABLE odds (
    id SERIAL PRIMARY KEY,
    market_id INT NOT NULL REFERENCES markets(id),
    outcome VARCHAR(100) NOT NULL,        -- e.g. "India", "Australia", "Draw"
    back_price DECIMAL(8,2) NOT NULL,     -- price to buy (back)
    lay_price DECIMAL(8,2) NOT NULL,      -- price to sell (lay)
    is_locked BOOLEAN NOT NULL DEFAULT false,  -- admin-locked, skip API sync
    last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Orders: the order book — pending buy/sell orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    odds_id INT NOT NULL REFERENCES odds(id),
    side VARCHAR(4) NOT NULL,             -- 'back' or 'lay'
    price DECIMAL(8,2) NOT NULL,
    stake DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, matched, cancelled
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Trades: completed/matched trades
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    back_order_id INT NOT NULL REFERENCES orders(id),
    lay_order_id INT NOT NULL REFERENCES orders(id),
    odds_id INT NOT NULL REFERENCES odds(id),
    price DECIMAL(8,2) NOT NULL,
    stake DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_markets_match_id ON markets(match_id);
CREATE INDEX idx_odds_market_id ON odds(market_id);
CREATE INDEX idx_orders_odds_id ON orders(odds_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_trades_odds_id ON trades(odds_id);

-- Digit Bets: lottery-style last digit guessing game
CREATE TABLE digit_bets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id),
    match_id INT NOT NULL REFERENCES matches(id),
    team VARCHAR(1) NOT NULL,             -- 'A' or 'B'
    digit INT NOT NULL,                   -- 0-9
    stake DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, won, lost
    payout DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_digit_bets_match ON digit_bets(match_id);
CREATE INDEX idx_digit_bets_user ON digit_bets(user_id);
