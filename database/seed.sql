-- Seed Data for Sky Exchange

-- Test user with starting balance
INSERT INTO users (username, balance) VALUES
    ('testuser', 10000.00);

-- Sample matches
INSERT INTO matches (sport, team_a, team_b, start_time, status) VALUES
    ('Cricket', 'India', 'Australia', NOW() + INTERVAL '1 hour', 'upcoming'),
    ('Football', 'Manchester United', 'Liverpool', NOW() + INTERVAL '2 hours', 'upcoming'),
    ('Cricket', 'England', 'South Africa', NOW() - INTERVAL '30 minutes', 'live'),
    ('Football', 'Arsenal', 'Chelsea', NOW() - INTERVAL '15 minutes', 'live');

-- Markets for each match
INSERT INTO markets (match_id, name, status) VALUES
    (1, 'Match Winner', 'open'),
    (2, 'Match Winner', 'open'),
    (3, 'Match Winner', 'open'),
    (4, 'Match Winner', 'open');

-- Odds for each market outcome
-- Match 1: India vs Australia
INSERT INTO odds (market_id, outcome, back_price, lay_price) VALUES
    (1, 'India', 1.85, 1.90),
    (1, 'Australia', 2.10, 2.15),
    (1, 'Draw', 3.50, 3.60);

-- Match 2: Man Utd vs Liverpool
INSERT INTO odds (market_id, outcome, back_price, lay_price) VALUES
    (2, 'Manchester United', 2.50, 2.55),
    (2, 'Liverpool', 1.75, 1.80),
    (2, 'Draw', 3.20, 3.30);

-- Match 3: England vs South Africa
INSERT INTO odds (market_id, outcome, back_price, lay_price) VALUES
    (3, 'England', 1.95, 2.00),
    (3, 'South Africa', 2.00, 2.05),
    (3, 'Draw', 3.40, 3.50);

-- Match 4: Arsenal vs Chelsea
INSERT INTO odds (market_id, outcome, back_price, lay_price) VALUES
    (4, 'Arsenal', 1.65, 1.70),
    (4, 'Chelsea', 2.80, 2.90),
    (4, 'Draw', 3.10, 3.20);
