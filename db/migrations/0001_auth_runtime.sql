DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='trf_auth_runtime') THEN
    CREATE ROLE trf_auth_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO trf_auth_runtime;
GRANT SELECT ON public.users TO trf_auth_runtime;
GRANT SELECT, INSERT, UPDATE ON public.app_sessions TO trf_auth_runtime;
GRANT SELECT, INSERT ON public.app_login_attempts TO trf_auth_runtime;
