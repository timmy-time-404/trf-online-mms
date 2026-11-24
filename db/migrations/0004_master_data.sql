CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  total_rooms integer CHECK (total_rooms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hotels_name_key ON public.hotels(lower(btrim(name)));
REVOKE ALL ON public.hotels FROM PUBLIC;
GRANT SELECT, DELETE ON public.hotels TO trf_auth_runtime;
GRANT INSERT (name,total_rooms), UPDATE (name,total_rooms) ON public.hotels TO trf_auth_runtime;
GRANT SELECT ON public.reference_master,public.locations,public.notifications TO trf_auth_runtime;
GRANT UPDATE (is_read) ON public.notifications TO trf_auth_runtime;
GRANT INSERT (username,email,role,department,employee_id,is_active,must_change_password,password_hash),
  UPDATE (username,email,role,department,employee_id,is_active) ON public.users TO trf_auth_runtime;
GRANT INSERT (employee_code,employee_name,department,section,job_title,phone),
  UPDATE (employee_name,department,section,job_title,phone,is_active) ON public.employees TO trf_auth_runtime;
-- Existing users SELECT remains necessary for cookie authentication; management queries project safe columns.
