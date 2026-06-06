-- Atomic reject_topup_request RPC.
-- Mirrors approve_topup_request: uses FOR UPDATE to prevent race conditions
-- between two admins acting on the same request simultaneously.
-- Also writes a 'rejected' transaction row for full audit trail.

CREATE OR REPLACE FUNCTION public.reject_topup_request(p_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.topup_requests%ROWTYPE;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Must be admin
  IF NOT public.is_admin_user() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Lock the row to prevent concurrent approve/reject race condition
  SELECT * INTO r
  FROM public.topup_requests
  WHERE id = p_topup_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Only reject if still pending (idempotency guard)
  IF r.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_processed');
  END IF;

  -- Update status atomically
  UPDATE public.topup_requests
  SET status = 'rejected'
  WHERE id = p_topup_id;

  -- Write rejection to transaction ledger for audit trail
  INSERT INTO public.transactions (
    user_id,
    amount,
    method,
    status,
    topup_id,
    description,
    reference
  )
  VALUES (
    r.user_id,
    r.amount,
    r.payment_method,
    'rejected',
    r.id,
    'Wallet top-up rejected by admin',
    'topup:' || r.id::text
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Restrict to authenticated users only (admin check is inside the function)
REVOKE ALL ON FUNCTION public.reject_topup_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_topup_request(uuid) TO authenticated;
