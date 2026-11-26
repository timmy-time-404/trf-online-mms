-- Run against a disposable database after all reviewed migrations.
-- Temporary permission probes are rolled back together with the validation role.
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  ASSERT current_setting('server_version_num')::int BETWEEN 170000 AND 179999,
    'Expected PostgreSQL 17';
  ASSERT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') = 23, -- +1 admin_audit in 0011
    'Unexpected table count';
  ASSERT (SELECT count(*) FROM pg_views WHERE schemaname = 'public') = 1,
    'Unexpected view count';
  ASSERT (SELECT count(*) FROM pg_sequences WHERE schemaname = 'public') = 3, -- +1 trf_number_seq in 0010
    'Unexpected sequence count';
  ASSERT (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') = 107, -- +9 in 0011
    'Unexpected index count';
  ASSERT (SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace) = 176, -- +3 in 0006/0007, +6 in 0011
    'Unexpected constraint count';
  ASSERT (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace) = 50, -- +3 in 0006, +1 in 0011
    'Unexpected routine count';
  ASSERT (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace AND NOT t.tgisinternal) = 14, -- +1 in 0006, +1 in 0011
    'Unexpected trigger count';
  ASSERT (SELECT confrelid = 'public.users'::regclass FROM pg_constraint
    WHERE conname = 'approval_hierarchy_user_id_fkey'), 'Unexpected hierarchy FK';
  -- 0011: a SECURITY DEFINER function owned by a superuser would hand that power to any
  -- injection bug inside it. New definer functions need ALTER FUNCTION ... OWNER TO trf_definer.
  ASSERT NOT EXISTS (SELECT FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef AND (r.rolsuper OR r.rolbypassrls)),
    'SECURITY DEFINER function owned by a superuser';
  ASSERT NOT EXISTS (SELECT FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND NOT convalidated),
    'Constraint left NOT VALID';
END $$;

-- Characterize a legacy business rule before changing its callers.
DO $$
BEGIN
  ASSERT public.trf_purpose_remarks_are_complete(NULL, 'Perjalanan uji');
  ASSERT NOT public.trf_purpose_remarks_are_complete(NULL, '  ');
  ASSERT public.trf_purpose_remarks_are_complete('[]'::jsonb, 'Legacy');
  ASSERT public.trf_purpose_remarks_are_complete(
    '[{"purposeRemarks":"Survei"},{"purposeRemarks":"Pelatihan"}]'::jsonb, NULL);
  ASSERT NOT public.trf_purpose_remarks_are_complete(
    '[{"purposeRemarks":"Survei"},{"purposeRemarks":"  "}]'::jsonb, 'Legacy');
END $$;

CREATE ROLE trf_schema_permission_probe NOLOGIN;
CREATE FUNCTION public.schema_default_permission_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT FROM pg_class WHERE relnamespace = 'public'::regnamespace
    AND relkind IN ('r', 'v') AND has_table_privilege('trf_schema_permission_probe', oid, 'SELECT')),
    'Unprivileged role can read application relations';
  ASSERT NOT EXISTS (SELECT FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND has_function_privilege('trf_schema_permission_probe', oid, 'EXECUTE')),
    'Unprivileged role can execute application routines';
END $$;

ROLLBACK;
\echo Baseline structure and default permissions verified.
