GRANT SELECT ON public.employees TO trf_auth_runtime;
GRANT SELECT, INSERT, DELETE ON public.trfs TO trf_auth_runtime;
GRANT UPDATE (travel_purpose, start_date, end_date, purpose_remarks, purpose_entries,
  accommodation, accommodations, travel_arrangements, status, submitted_at, updated_at)
  ON public.trfs TO trf_auth_runtime;
GRANT INSERT ON public.status_history TO trf_auth_runtime;
