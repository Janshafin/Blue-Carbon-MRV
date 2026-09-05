-- ==============================================================================
-- BLUE CARBON MRV REGISTRY — SUPABASE DATABASE SCHEMA
-- ==============================================================================

-- 1. Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY,
    project_name TEXT NOT NULL,
    planting_date DATE NOT NULL,
    species TEXT NOT NULL,
    ngo_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    photo_url TEXT,
    photo_hash TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Verifications Table
CREATE TABLE IF NOT EXISTS public.verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id TEXT NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
    verification_status TEXT NOT NULL DEFAULT 'PROCESSING',
    score DOUBLE PRECISION,
    confidence TEXT,
    eligibility BOOLEAN NOT NULL DEFAULT FALSE,
    ndvi_before DOUBLE PRECISION,
    ndvi_after DOUBLE PRECISION,
    ndvi_change DOUBLE PRECISION,
    satellite_source TEXT DEFAULT 'Sentinel-2 L2A',
    is_simulated BOOLEAN DEFAULT TRUE,
    blockchain_status TEXT NOT NULL DEFAULT 'unregistered',
    transaction_hash TEXT,
    blockchain_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Fast Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_wallet ON public.submissions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_submissions_ngo ON public.submissions(ngo_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON public.submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_submission_id ON public.verifications(submission_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.verifications(verification_status);

-- 5. Public Registry View
CREATE OR REPLACE VIEW public.registry_view AS
SELECT 
    s.id AS submission_id,
    s.project_name,
    s.planting_date,
    s.species,
    s.ngo_id,
    s.wallet_address,
    s.latitude,
    s.longitude,
    s.photo_url,
    v.verification_status AS status,
    COALESCE(v.score, 0) AS verification_score,
    COALESCE(v.confidence, 'UNKNOWN') AS confidence,
    v.ndvi_before,
    v.ndvi_after,
    v.ndvi_change AS ndvi_improvement,
    v.blockchain_status,
    v.transaction_hash,
    CASE 
        WHEN v.verification_status IN ('VERIFIED', 'CREDITED') THEN 100
        ELSE 0
    END AS credit_amount,
    s.created_at
FROM public.submissions s
JOIN public.verifications v ON s.id = v.submission_id
WHERE v.verification_status IN ('VERIFIED', 'CREDITED', 'PROCESSING')
ORDER BY s.created_at DESC;

-- 6. Row Level Security (RLS)
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Allow public read access to submissions
CREATE POLICY "Public read submissions"
    ON public.submissions
    FOR SELECT
    USING (true);

-- Allow anonymous or authenticated insert for submissions
CREATE POLICY "Public insert submissions"
    ON public.submissions
    FOR INSERT
    WITH CHECK (true);

-- Allow public read access to verifications
CREATE POLICY "Public read verifications"
    ON public.verifications
    FOR SELECT
    USING (true);

-- Allow service role or backend insert/update to verifications
CREATE POLICY "Service role verifications write"
    ON public.verifications
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 7. Supabase Storage Bucket for Evidence Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for viewing evidence bucket photos publicly
CREATE POLICY "Evidence bucket public read"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'evidence');

-- Policy for uploading evidence photos
CREATE POLICY "Evidence bucket insert"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'evidence');
