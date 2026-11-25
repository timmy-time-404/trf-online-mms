-- Production readiness (audit): TRF numbers used a random 3-digit suffix per business day
-- (900 values). With the UNIQUE constraint on trf_number, two TRFs on the same day collide
-- with a probability that grows quickly (about 38% per day at 30 TRFs) and the submit fails.
-- A sequence gives every new TRF a unique suffix. Existing numbers are not changed.
CREATE SEQUENCE IF NOT EXISTS public.trf_number_seq AS bigint START WITH 1000;
GRANT USAGE ON SEQUENCE public.trf_number_seq TO trf_auth_runtime;
CREATE OR REPLACE FUNCTION public.generate_trf_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.trf_number IS NULL THEN
        NEW.trf_number := 'TRF-' || TO_CHAR(public.business_date(), 'YYYYMMDD') || '-'
            || LPAD(nextval('public.trf_number_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$function$;
-- Login records the attempt as failed before the slow password check and marks it as
-- succeeded afterwards, so the API needs to update exactly these columns.
GRANT UPDATE (succeeded, failure_reason, user_id) ON public.app_login_attempts TO trf_auth_runtime;
