-- Explicit development fixture adjustment; not a general account policy migration.
\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  hashes_before text;
BEGIN
  IF (SELECT count(*) FROM public.users) <> 7 OR EXISTS (
    SELECT FROM public.users u
    WHERE NOT EXISTS (
      SELECT FROM (VALUES
        ('superadmin','SUPER_ADMIN'), ('adm_hrmd_01','ADMIN_DEPT'),
        ('employee_dummy','EMPLOYEE'), ('hod_dummy','HOD'),
        ('hr_dummy','HR'), ('pm_dummy','PM'), ('ga_dummy','GA')
      ) AS expected(username, role)
      WHERE expected.username=u.username AND expected.role=u.role
    ) OR u.email NOT LIKE '%@example.invalid'
  ) THEN
    RAISE EXCEPTION 'Expected only the seven development dummy accounts; no changes made.';
  END IF;

  SELECT md5(string_agg(coalesce(password_hash, ''), ',' ORDER BY username))
    INTO hashes_before FROM public.users;
  UPDATE public.users SET must_change_password=false WHERE must_change_password IS DISTINCT FROM false;
  IF (SELECT count(*) FROM public.users WHERE must_change_password=false) <> 7 OR
    (SELECT md5(string_agg(coalesce(password_hash, ''), ',' ORDER BY username)) FROM public.users)
      IS DISTINCT FROM hashes_before THEN
    RAISE EXCEPTION 'Dummy account verification failed.';
  END IF;
END $$;
COMMIT;
\echo Seven dummy accounts can skip password change; existing password hashes preserved.
