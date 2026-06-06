
-- ============================================================
-- PROMO CODE REDEMPTION (wallet credit)
-- discount_percent acts as flat dollar credit amount
-- e.g. discount_percent = 10 → $10 wallet credit
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo record;
BEGIN
  SELECT * INTO v_promo
    FROM promo_codes
   WHERE code = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid promo code');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code has expired');
  END IF;

  IF v_promo.usage_limit IS NOT NULL AND v_promo.used_count >= v_promo.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This promo code has reached its usage limit');
  END IF;

  IF EXISTS (
    SELECT 1 FROM promo_code_usage
     WHERE promo_code_id = v_promo.id AND user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code');
  END IF;

  RETURN jsonb_build_object(
    'valid',            true,
    'credit_amount',    v_promo.discount_percent,
    'promo_id',         v_promo.id,
    'code',             v_promo.code
  );
END;
$$;

-- ============================================================
-- REDEEM PROMO CODE → add wallet credit atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo   record;
  v_uid     uuid := auth.uid();
  v_credit  numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock promo row to prevent race conditions
  SELECT * INTO v_promo
    FROM promo_codes
   WHERE code = upper(trim(p_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid promo code');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has expired');
  END IF;

  IF v_promo.usage_limit IS NOT NULL AND v_promo.used_count >= v_promo.usage_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has reached its usage limit');
  END IF;

  IF EXISTS (
    SELECT 1 FROM promo_code_usage
     WHERE promo_code_id = v_promo.id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  v_credit := v_promo.discount_percent; -- treat as flat $ credit

  -- Credit user wallet
  UPDATE users SET balance = balance + v_credit WHERE id = v_uid;

  -- Log transaction
  INSERT INTO transactions (user_id, amount, method, status, direction, description)
  VALUES (v_uid, v_credit, 'PROMO', 'completed', 'credit',
          'Promo code: ' || upper(trim(p_code)));

  -- Mark usage
  INSERT INTO promo_code_usage (promo_code_id, user_id)
  VALUES (v_promo.id, v_uid);

  -- Increment used_count
  UPDATE promo_codes SET used_count = used_count + 1 WHERE id = v_promo.id;

  -- Insert notification
  INSERT INTO notifications (user_id, type, message, status, read)
  VALUES (v_uid, 'topup',
          '+$' || v_credit || ' added via promo code ' || upper(trim(p_code)),
          'completed', false);

  RETURN jsonb_build_object(
    'success',       true,
    'credit_amount', v_credit,
    'message',       '$' || v_credit || ' added to your wallet!'
  );
END;
$$;

-- ============================================================
-- APPLY REFERRAL CODE (called by referred user after signup)
-- Referrer gets $2 wallet credit immediately
-- ============================================================
CREATE OR REPLACE FUNCTION public.apply_referral_code(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer  record;
  v_uid       uuid := auth.uid();
  v_reward    numeric := 2.00;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_referrer
    FROM users
   WHERE referral_code = upper(trim(p_referral_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  IF v_referrer.id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot use your own referral code');
  END IF;

  -- Check if current user already applied a referral
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used a referral code');
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE id = v_uid AND referred_by_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral already applied to your account');
  END IF;

  -- Link referred user to referrer
  UPDATE users SET referred_by_id = v_referrer.id WHERE id = v_uid;

  -- Record referral
  INSERT INTO referrals (referrer_id, referred_id, status, reward_amount)
  VALUES (v_referrer.id, v_uid, 'completed', v_reward)
  ON CONFLICT (referred_id) DO NOTHING;

  -- Credit referrer wallet
  UPDATE users SET balance = balance + v_reward WHERE id = v_referrer.id;

  -- Log referrer transaction
  INSERT INTO transactions (user_id, amount, method, status, direction, description)
  VALUES (v_referrer.id, v_reward, 'REFERRAL', 'completed', 'credit',
          'Referral reward — new user joined');

  -- Notify referrer
  INSERT INTO notifications (user_id, type, message, status, read)
  VALUES (v_referrer.id, 'topup',
          '+$' || v_reward || ' referral reward! Someone joined via your code.',
          'completed', false);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral applied! Your referrer just earned $' || v_reward || '.'
  );
END;
$$;

-- ============================================================
-- GET REFERRAL STATS for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_total_refs  int;
  v_total_earned numeric;
  v_code        text;
BEGIN
  SELECT referral_code INTO v_code FROM users WHERE id = v_uid;

  SELECT COUNT(*), COALESCE(SUM(reward_amount), 0)
    INTO v_total_refs, v_total_earned
    FROM referrals
   WHERE referrer_id = v_uid AND status = 'completed';

  RETURN jsonb_build_object(
    'referral_code',  v_code,
    'total_referrals', v_total_refs,
    'total_earned',    v_total_earned
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_stats()         TO authenticated;
