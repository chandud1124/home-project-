-- Fix security warnings: Set explicit search_path for functions
-- This addresses Supabase linter warnings about mutable search_path

-- 1. Fix cleanup_expired_commands function
DROP FUNCTION IF EXISTS public.cleanup_expired_commands();
CREATE OR REPLACE FUNCTION public.cleanup_expired_commands()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM device_commands 
    WHERE expires_at < NOW();
END;
$$;

-- 2. Fix auto_expire_alerts function  
DROP FUNCTION IF EXISTS public.auto_expire_alerts();
CREATE OR REPLACE FUNCTION public.auto_expire_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE alerts 
    SET is_active = false, 
        resolved_at = NOW()
    WHERE is_active = true 
      AND (created_at + INTERVAL '24 hours') < NOW()
      AND severity IN ('LOW', 'MEDIUM');
END;
$$;

-- 3. Fix cleanup_old_heartbeats function
DROP FUNCTION IF EXISTS public.cleanup_old_heartbeats();
CREATE OR REPLACE FUNCTION public.cleanup_old_heartbeats()
RETURNS void
LANGUAGE plpgsql  
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM device_heartbeats 
    WHERE last_heartbeat < NOW() - INTERVAL '7 days';
END;
$$;

-- 4. Fix generate_hmac_signature function
DROP FUNCTION IF EXISTS public.generate_hmac_signature(text, text, bigint);
CREATE OR REPLACE FUNCTION public.generate_hmac_signature(
    p_device_id text,
    p_payload text,
    p_timestamp bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    hmac_secret text;
    message_to_sign text;
    signature text;
BEGIN
    -- Get HMAC secret for device
    SELECT d.hmac_secret INTO hmac_secret 
    FROM esp32_devices d 
    WHERE d.device_id = p_device_id;
    
    IF hmac_secret IS NULL THEN
        RAISE EXCEPTION 'Device not found or no HMAC secret configured';
    END IF;
    
    -- Construct message to sign: deviceId|payload|timestamp
    message_to_sign := p_device_id || '|' || p_payload || '|' || p_timestamp::text;
    
    -- Generate HMAC-SHA256 signature
    signature := encode(hmac(message_to_sign, hmac_secret, 'sha256'), 'hex');
    
    RETURN signature;
END;
$$;

-- 5. Fix verify_hmac_signature function
DROP FUNCTION IF EXISTS public.verify_hmac_signature(text, text, bigint, text);
CREATE OR REPLACE FUNCTION public.verify_hmac_signature(
    p_device_id text,
    p_payload text, 
    p_timestamp bigint,
    p_signature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    expected_signature text;
BEGIN
    expected_signature := generate_hmac_signature(p_device_id, p_payload, p_timestamp);
    RETURN expected_signature = p_signature;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_expired_commands() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.auto_expire_alerts() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_heartbeats() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_hmac_signature(text, text, bigint) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.verify_hmac_signature(text, text, bigint, text) TO authenticated, anon;

-- Add comment explaining the security fix
COMMENT ON FUNCTION public.cleanup_expired_commands() IS 'Removes expired device commands - search_path fixed for security';
COMMENT ON FUNCTION public.auto_expire_alerts() IS 'Auto-expires old alerts - search_path fixed for security';
COMMENT ON FUNCTION public.cleanup_old_heartbeats() IS 'Removes old device heartbeats - search_path fixed for security';
COMMENT ON FUNCTION public.generate_hmac_signature(text, text, bigint) IS 'Generates HMAC signature for device auth - search_path fixed for security';
COMMENT ON FUNCTION public.verify_hmac_signature(text, text, bigint, text) IS 'Verifies HMAC signature for device auth - search_path fixed for security';
