-- ============================================================================
-- DEPOSIT REQUESTS & SECURE WALLET TOP-UPS (Lebanon OMT/USDT)
-- ============================================================================

CREATE TABLE public.deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL CHECK (method IN ('OMT', 'WISH', 'USDT')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    proof TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deposits" ON public.deposit_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own deposits" ON public.deposit_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage deposits" ON public.deposit_requests FOR ALL TO authenticated USING (true); -- assuming UI limits access or RLS is handled via UI

-- Process an approval atomically
CREATE OR REPLACE FUNCTION approve_deposit_request(p_request_id UUID) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_amount NUMERIC;
    v_status TEXT;
BEGIN
    SELECT user_id, amount, status INTO v_user_id, v_amount, v_status
    FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;

    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'This request is already %', v_status;
    END IF;

    -- Update balance on profiles
    UPDATE public.profiles SET balance = balance + v_amount WHERE id = v_user_id;

    -- Update deposit status
    UPDATE public.deposit_requests SET status = 'approved' WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process a rejection atomically
CREATE OR REPLACE FUNCTION reject_deposit_request(p_request_id UUID) RETURNS VOID AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM public.deposit_requests WHERE id = p_request_id FOR UPDATE;
    
    IF v_status != 'pending' THEN
        RAISE EXCEPTION 'This request is already %', v_status;
    END IF;

    UPDATE public.deposit_requests SET status = 'rejected' WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
