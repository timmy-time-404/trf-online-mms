-- Production readiness, wave 3 (audit: database M1-M5, backend M3/M7).

-- M3. Referential integrity for TRFs. Checked on the dev data before writing this:
-- no orphaned rows, every role and status value is valid.
ALTER TABLE public.trfs ADD CONSTRAINT trfs_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.trfs VALIDATE CONSTRAINT trfs_employee_id_fkey;
ALTER TABLE public.trfs ADD CONSTRAINT trfs_lumpsum_input_by_fkey
  FOREIGN KEY (lumpsum_input_by) REFERENCES public.users(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.trfs VALIDATE CONSTRAINT trfs_lumpsum_input_by_fkey;
ALTER TABLE public.trfs VALIDATE CONSTRAINT trfs_status_check;
ALTER TABLE public.employees VALIDATE CONSTRAINT employees_employee_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN
  ('SUPER_ADMIN','EMPLOYEE','ADMIN_DEPT','HOD','HR','PM','GA'));

-- M4. Only drafts may be deleted. Deleting any other TRF would cascade away its status
-- history and notifications. Superusers (migrations, test cleanup) are exempt.
CREATE FUNCTION public.trfs_only_drafts_deletable() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION 'Hanya draft TRF yang boleh dihapus.' USING ERRCODE = '55000';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trfs_only_drafts_deletable BEFORE DELETE ON public.trfs
  FOR EACH ROW EXECUTE FUNCTION public.trfs_only_drafts_deletable();

-- M5. A retried or double-clicked submit carries the same Idempotency-Key and gets
-- the TRF the first request created instead of a duplicate.
ALTER TABLE public.trfs ADD COLUMN idempotency_key uuid;
CREATE UNIQUE INDEX trfs_employee_idempotency_key_idx ON public.trfs (employee_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- M2. Indexes for the list, queue and dashboard filters and for cascading foreign keys.
CREATE INDEX trfs_employee_created_idx ON public.trfs (employee_id, created_at DESC);
CREATE INDEX trfs_status_created_idx ON public.trfs (status, created_at DESC);
CREATE INDEX trfs_department_created_idx ON public.trfs (public.normalize_department(department), created_at DESC);
CREATE INDEX status_history_trf_changed_idx ON public.status_history (trf_id, changed_at);
CREATE INDEX notifications_trf_idx ON public.notifications (trf_id);
CREATE INDEX notification_outbox_trf_idx ON public.notification_outbox (trf_id) WHERE trf_id IS NOT NULL;

-- Backend M3. Append-only audit of user, employee and hotel administration. No FK on the
-- actor: the record must survive even if that account is later removed.
CREATE TABLE public.admin_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  entity text NOT NULL CONSTRAINT admin_audit_entity_check CHECK (entity IN ('USER','EMPLOYEE','HOTEL')),
  entity_id uuid NOT NULL,
  action text NOT NULL CONSTRAINT admin_audit_action_check
    CHECK (action IN ('CREATE','UPDATE','DEACTIVATE','ENABLE','DELETE')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_entity_idx ON public.admin_audit (entity, entity_id, created_at);
REVOKE ALL ON public.admin_audit FROM PUBLIC;
GRANT INSERT ON public.admin_audit TO trf_auth_runtime;

-- M1. SECURITY DEFINER functions ran as trf_owner, a superuser. They now run as
-- trf_definer: no superuser, no BYPASSRLS, only data privileges on the app schema.
-- deploy/verify-schema.sql fails if a later migration adds a definer function owned
-- by a superuser again.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'trf_definer') THEN
    CREATE ROLE trf_definer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO trf_definer;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO trf_definer;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO trf_definer;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO trf_definer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO trf_definer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO trf_definer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO trf_definer;
DO $$
DECLARE fn regprocedure;
BEGIN
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'extensions') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA extensions TO trf_definer';
  END IF;
  FOR fn IN SELECT oid::regprocedure FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND prosecdef LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO trf_definer', fn);
  END LOOP;
END $$;
