CREATE TABLE public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trf_id uuid NOT NULL REFERENCES public.trfs(id) ON DELETE CASCADE,
  recipient_phone text,
  template_key text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox(created_at, id) WHERE status = 'PENDING';
REVOKE ALL ON public.notification_outbox FROM PUBLIC;
GRANT INSERT ON public.notification_outbox TO trf_auth_runtime;
GRANT INSERT ON public.notifications TO trf_auth_runtime;
GRANT UPDATE (admin_dept_verify, parallel_approval, pm_approval, ga_process, ga_documents,
  lumpsum_amount, lumpsum_currency, lumpsum_note, lumpsum_input_by, lumpsum_input_at)
  ON public.trfs TO trf_auth_runtime;
