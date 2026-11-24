-- WP5: delivery state for the WhatsApp outbox worker.
ALTER TABLE public.notification_outbox
  ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN last_error text;
DROP INDEX IF EXISTS public.notification_outbox_pending_idx;
CREATE INDEX notification_outbox_due_idx ON public.notification_outbox(next_attempt_at, id) WHERE status = 'PENDING';

-- The worker claims due rows and records the outcome; it never deletes history.
GRANT SELECT ON public.notification_outbox TO trf_auth_runtime;
GRANT UPDATE (status, attempts, next_attempt_at, sent_at, last_error) ON public.notification_outbox TO trf_auth_runtime;
