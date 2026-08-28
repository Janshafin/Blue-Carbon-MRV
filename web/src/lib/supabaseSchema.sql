-- ============================================================
-- Blue Carbon MRV — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

-- Submissions table — the single source of truth
CREATE TABLE IF NOT EXISTS submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name    TEXT NOT NULL,
  region          TEXT,
  species         TEXT NOT NULL,
  ngo_id          TEXT NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  accuracy        DOUBLE PRECISION,
  planted_date    DATE NOT NULL,
  photo_url       TEXT,                              -- base64 data URI or IPFS hash

  -- Scoring
  score           INTEGER DEFAULT 0,
  ndvi_before     DOUBLE PRECISION,
  ndvi_after      DOUBLE PRECISION,
  confidence_band TEXT DEFAULT 'pending',             -- pending | low | medium | high
  flags           TEXT[] DEFAULT '{}',

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'pending',    -- pending | scored | approved | rejected | disputed
  on_chain_tx     TEXT,                               -- tx hash after blockchain write
  on_chain_block  INTEGER,                            -- block number
  submission_hash BYTEA,                              -- bytes32 used on-chain

  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewer_notes  TEXT,
  beneficiary     TEXT                                -- wallet address
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);

-- Activity / Audit log
CREATE TABLE IF NOT EXISTS activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL,          -- submit | approve | reject | flag | dispute
  text        TEXT NOT NULL,
  submission_id UUID REFERENCES submissions(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);

-- Enable Row-Level Security (allow all for demo — tighten in production)
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Public read/write for demo (use auth policies in production)
CREATE POLICY "Allow all on submissions" ON submissions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on activity_log" ON activity_log
  FOR ALL USING (true) WITH CHECK (true);
