CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  usuario VARCHAR(40) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  number VARCHAR(32) NOT NULL,
  holder VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('comum','estudante','vale')),
  linked_at BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','bloqueado'))
);
CREATE TABLE IF NOT EXISTS pass_catalog (
  id VARCHAR(60) PRIMARY KEY,
  kind VARCHAR(20) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_hours INTEGER NOT NULL,
  uses INTEGER
);
CREATE TABLE IF NOT EXISTS owned_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pass_id VARCHAR(60) NOT NULL REFERENCES pass_catalog(id),
  purchased_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  uses_left INTEGER,
  expiry_notified BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('recarga','passe','viagem')),
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(240) NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  ts BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  ts BIGINT NOT NULL,
  "read" BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS transit_stops (
  id VARCHAR(60) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  x NUMERIC(8,2) NOT NULL,
  y NUMERIC(8,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS transit_lines (
  id VARCHAR(60) PRIMARY KEY,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(160) NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('urbana','regional')),
  color VARCHAR(20) NOT NULL,
  fare NUMERIC(10,2) NOT NULL,
  stop_ids TEXT[] NOT NULL
);
CREATE TABLE IF NOT EXISTS transit_buses (
  id VARCHAR(60) PRIMARY KEY,
  line_id VARCHAR(60) NOT NULL REFERENCES transit_lines(id) ON DELETE CASCADE,
  dist NUMERIC(12,3) NOT NULL,
  dir SMALLINT NOT NULL CHECK (dir IN (-1,1)),
  speed NUMERIC(12,3) NOT NULL
);
CREATE TABLE IF NOT EXISTS favorite_lines (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  line_id VARCHAR(60) NOT NULL REFERENCES transit_lines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,line_id)
);
CREATE TABLE IF NOT EXISTS favorite_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_id VARCHAR(60) NOT NULL REFERENCES transit_stops(id),
  dest_id VARCHAR(60) NOT NULL REFERENCES transit_stops(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,origin_id,dest_id),
  CHECK(origin_id <> dest_id)
);
CREATE TABLE IF NOT EXISTS news (
  id VARCHAR(80) PRIMARY KEY,
  title VARCHAR(240) NOT NULL,
  author VARCHAR(160) NOT NULL DEFAULT 'Equipe Voyage',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  image TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS partners (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo TEXT,
  url TEXT
);
CREATE TABLE IF NOT EXISTS regions (
  id VARCHAR(80) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image TEXT
);
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_ts ON transactions(user_id,ts DESC);
CREATE INDEX IF NOT EXISTS idx_notices_user_ts ON notices(user_id,ts DESC);
CREATE INDEX IF NOT EXISTS idx_owned_passes_user_expiry ON owned_passes(user_id,expires_at DESC);
