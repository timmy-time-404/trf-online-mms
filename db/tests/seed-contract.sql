\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.users) = 7;
  ASSERT (SELECT count(DISTINCT role) FROM public.users
    WHERE role IN ('EMPLOYEE','ADMIN_DEPT','HOD','HR','PM','GA','SUPER_ADMIN')) = 7;
  ASSERT (SELECT count(*) FROM public.users WHERE is_active AND NOT must_change_password
    AND password_hash LIKE '$argon2id$%') = 7;
  ASSERT EXISTS (SELECT FROM public.users WHERE username='superadmin' AND role='SUPER_ADMIN');
  ASSERT EXISTS (SELECT FROM public.users WHERE username='adm_hrmd_01' AND role='ADMIN_DEPT');
  ASSERT (SELECT count(*) FROM public.users u JOIN public.employees e
    ON u.employee_id=e.id AND e.user_id=u.id) = 7;
  ASSERT (SELECT count(*) FROM public.trfs WHERE status='DRAFT') = 1;
  ASSERT NOT EXISTS (SELECT FROM public.users WHERE role IN ('HOD','ADMIN_DEPT')
    AND department IS DISTINCT FROM 'HRMD');
END $$;

DO $$
DECLARE
  employee_id uuid;
  hod_id uuid;
  unauthorized_id uuid;
  result_id uuid;
  result_status text;
  rejected boolean;
BEGIN
  SELECT u.employee_id, u.id INTO employee_id, unauthorized_id FROM public.users u WHERE role='EMPLOYEE';
  SELECT id INTO hod_id FROM public.users WHERE role='HOD';
  SELECT early_recall_id, recall_status INTO result_id, result_status
  FROM public.create_early_recall_request(hod_id, employee_id,
    current_date+14, current_date+27, current_date+20, 'Dummy recall');
  ASSERT result_id IS NOT NULL AND result_status = 'DRAFT';
  ASSERT EXISTS (SELECT FROM public.early_recall_requests WHERE id=result_id AND requested_by_user_id=hod_id);

  rejected := false;
  BEGIN
    PERFORM public.create_early_recall_request(unauthorized_id, employee_id,
      current_date+14, current_date+27, current_date+20, 'Unauthorized recall');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Role % tidak diizinkan membuat Early Recall.%' THEN rejected := true;
    ELSE RAISE; END IF;
  END;
  ASSERT rejected, 'EMPLOYEE must not create early recall';

  UPDATE public.users SET department='OTHER' WHERE id=hod_id;
  rejected := false;
  BEGIN
    PERFORM public.create_early_recall_request(hod_id, employee_id,
      current_date+14, current_date+27, current_date+20, 'Cross department recall');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'HOD hanya dapat membuat Early Recall untuk department sendiri.' THEN rejected := true;
    ELSE RAISE; END IF;
  END;
  ASSERT rejected, 'HOD must not create recall across departments';
  ASSERT (SELECT count(*) FROM public.early_recall_requests) = 1,
    'Failed requests must not create recall records';
END $$;
ROLLBACK;
\echo Seed relationships and early recall access checks passed.
