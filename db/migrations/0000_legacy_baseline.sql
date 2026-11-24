-- Schema-only baseline validated on PostgreSQL 17.12. Drizzle owns the transaction.
-- approval_hierarchy references the application users table; no hosted auth schema.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions, pg_catalog;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE SEQUENCE public."early_recall_number_seq" AS bigint;

CREATE SEQUENCE public."employee_os_number_seq" AS bigint;

CREATE TABLE public."app_login_attempts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "identifier_hash" text NOT NULL,
  "ip_hash" text,
  "user_id" uuid,
  "succeeded" boolean DEFAULT false NOT NULL,
  "failure_reason" text,
  "attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "user_agent" text,
  "request_id" uuid DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE public."app_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoke_reason" text,
  "user_agent" text,
  "ip_address" inet,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE public."approval_hierarchy" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "role" text NOT NULL,
  "department" text NOT NULL,
  "employee_level" text DEFAULT 'ALL'::text,
  "priority" integer NOT NULL,
  "user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."early_recall_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "recall_number" text DEFAULT ((('ER-'::text || to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text)) || '-'::text) || lpad((nextval('early_recall_number_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
  "employee_id" uuid NOT NULL,
  "department" text NOT NULL,
  "source_trf_id" uuid,
  "linked_trf_id" uuid,
  "requested_by_user_id" uuid NOT NULL,
  "request_source_role" text NOT NULL,
  "approved_leave_start" date NOT NULL,
  "approved_leave_end" date NOT NULL,
  "approved_leave_days" integer GENERATED ALWAYS AS (((approved_leave_end - approved_leave_start) + 1)) STORED,
  "proposed_return_date" date NOT NULL,
  "estimated_leave_days_used" integer GENERATED ALWAYS AS ((proposed_return_date - approved_leave_start)) STORED,
  "estimated_unused_leave_days" integer GENERATED ALWAYS AS (((approved_leave_end - proposed_return_date) + 1)) STORED,
  "actual_return_date" date,
  "actual_leave_days_used" integer GENERATED ALWAYS AS (
CASE
    WHEN (actual_return_date IS NULL) THEN NULL::integer
    ELSE (actual_return_date - approved_leave_start)
END) STORED,
  "unused_leave_days" integer GENERATED ALWAYS AS (
CASE
    WHEN (actual_return_date IS NULL) THEN NULL::integer
    ELSE GREATEST(((approved_leave_end - actual_return_date) + 1), 0)
END) STORED,
  "reason" text NOT NULL,
  "remarks" text,
  "status" text DEFAULT 'DRAFT'::text NOT NULL,
  "hr_validated_by_user_id" uuid,
  "hr_validated_at" timestamp with time zone,
  "hr_validation_remarks" text,
  "pm_approved_by_user_id" uuid,
  "pm_approved_at" timestamp with time zone,
  "pm_approval_remarks" text,
  "ga_processed_by_user_id" uuid,
  "ga_processing_started_at" timestamp with time zone,
  "travel_booked_at" timestamp with time zone,
  "ga_remarks" text,
  "employee_acknowledged_at" timestamp with time zone,
  "actual_return_confirmed_by_user_id" uuid,
  "actual_return_confirmed_at" timestamp with time zone,
  "os_generated_days" integer DEFAULT 0 NOT NULL,
  "os_generated_at" timestamp with time zone,
  "os_ledger_id" uuid,
  "rejected_by_user_id" uuid,
  "rejected_at" timestamp with time zone,
  "rejection_reason" text,
  "cancelled_by_user_id" uuid,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."early_recall_status_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "early_recall_id" uuid NOT NULL,
  "from_status" text,
  "to_status" text NOT NULL,
  "actor_type" text DEFAULT 'USER'::text NOT NULL,
  "changed_by_user_id" uuid,
  "changed_by_role" text,
  "remarks" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_management_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_key" text NOT NULL,
  "action" text NOT NULL,
  "employee_id" uuid,
  "employee_code_snapshot" text NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "before_data" jsonb,
  "after_data" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_os_ledger" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "os_number" text DEFAULT ((('OS-'::text || to_char((CURRENT_DATE)::timestamp with time zone, 'YYYY'::text)) || '-'::text) || lpad((nextval('employee_os_number_seq'::regclass))::text, 6, '0'::text)) NOT NULL,
  "employee_id" uuid NOT NULL,
  "source_type" text NOT NULL,
  "early_recall_id" uuid,
  "source_reference" text,
  "generated_date" date DEFAULT CURRENT_DATE NOT NULL,
  "original_days" integer NOT NULL,
  "remaining_days" integer NOT NULL,
  "expired_days" integer DEFAULT 0 NOT NULL,
  "cancelled_days" integer DEFAULT 0 NOT NULL,
  "used_days" integer GENERATED ALWAYS AS ((((original_days - remaining_days) - expired_days) - cancelled_days)) STORED,
  "cycle_number" smallint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'AVAILABLE'::text NOT NULL,
  "created_by_type" text DEFAULT 'SYSTEM'::text NOT NULL,
  "created_by_user_id" uuid,
  "remarks" text,
  "source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expired_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "earned_site_cycle_id" uuid
);

CREATE TABLE public."employee_os_operations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_key" text NOT NULL,
  "operation_type" text NOT NULL,
  "employee_id" uuid NOT NULL,
  "requested_days" integer DEFAULT 0 NOT NULL,
  "processed_days" integer DEFAULT 0 NOT NULL,
  "reference_type" text,
  "reference_id" uuid,
  "reference_number" text,
  "actor_type" text NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text,
  "remarks" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_os_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "operation_id" uuid NOT NULL,
  "os_ledger_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "transaction_type" text NOT NULL,
  "days" integer DEFAULT 0 NOT NULL,
  "cycle_before" smallint,
  "cycle_after" smallint,
  "remaining_before" integer NOT NULL,
  "remaining_after" integer NOT NULL,
  "status_before" text NOT NULL,
  "status_after" text NOT NULL,
  "actor_type" text NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text,
  "remarks" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_roster_assignments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "roster_pattern_id" uuid NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "source_type" text DEFAULT 'INITIAL_IMPORT'::text NOT NULL,
  "source_reference" text,
  "assigned_by_user_id" uuid,
  "remarks" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_site_cycle_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "site_cycle_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "from_status" text,
  "to_status" text,
  "event_date" date NOT NULL,
  "actor_type" text NOT NULL,
  "actor_user_id" uuid,
  "actor_role" text,
  "remarks" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employee_site_cycles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "roster_assignment_id" uuid NOT NULL,
  "site_location_id" uuid,
  "cycle_number" integer NOT NULL,
  "planned_site_in" date NOT NULL,
  "planned_site_out" date NOT NULL,
  "planned_site_days" integer GENERATED ALWAYS AS ((planned_site_out - planned_site_in)) STORED,
  "actual_site_in" date,
  "actual_site_out" date,
  "actual_site_days" integer GENERATED ALWAYS AS (
CASE
    WHEN ((actual_site_in IS NOT NULL) AND (actual_site_out IS NOT NULL)) THEN (actual_site_out - actual_site_in)
    ELSE NULL::integer
END) STORED,
  "planned_leave_start" date,
  "planned_leave_end" date,
  "planned_leave_days" integer GENERATED ALWAYS AS (
CASE
    WHEN ((planned_leave_start IS NOT NULL) AND (planned_leave_end IS NOT NULL)) THEN ((planned_leave_end - planned_leave_start) + 1)
    ELSE NULL::integer
END) STORED,
  "actual_leave_start" date,
  "actual_leave_end" date,
  "actual_leave_days" integer GENERATED ALWAYS AS (
CASE
    WHEN ((actual_leave_start IS NOT NULL) AND (actual_leave_end IS NOT NULL)) THEN ((actual_leave_end - actual_leave_start) + 1)
    ELSE NULL::integer
END) STORED,
  "site_in_trf_id" uuid,
  "site_out_trf_id" uuid,
  "status" text DEFAULT 'PLANNED'::text NOT NULL,
  "source_type" text DEFAULT 'BASELINE_MANIFEST'::text NOT NULL,
  "source_reference" text,
  "created_by_user_id" uuid,
  "remarks" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."employees" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "employee_code" text NOT NULL,
  "employee_name" text NOT NULL,
  "birth_date" date,
  "phone" text,
  "point_of_hire" text,
  "join_date" date,
  "department" text NOT NULL,
  "section" text,
  "job_title" text,
  "employee_level" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "employee_type" text DEFAULT 'EMPLOYEE'::text,
  "email" text
);

CREATE TABLE public."locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "province" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "code" text,
  "city" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "priority" integer DEFAULT 100 NOT NULL
);

CREATE TABLE public."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "trf_id" uuid,
  "trf_number" text,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."reference_master" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "category" text NOT NULL,
  "code" text,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."roster_patterns" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "site_weeks" smallint NOT NULL,
  "leave_weeks" smallint NOT NULL,
  "site_days" integer GENERATED ALWAYS AS ((site_weeks * 7)) STORED,
  "leave_days" integer GENERATED ALWAYS AS ((leave_weeks * 7)) STORED,
  "total_cycle_days" integer GENERATED ALWAYS AS (((site_weeks + leave_weeks) * 7)) STORED,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public."status_history" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "trf_id" uuid NOT NULL,
  "changed_by" text NOT NULL,
  "changed_by_name" text NOT NULL,
  "old_status" text,
  "new_status" text NOT NULL,
  "remarks" text DEFAULT 'System update'::text,
  "changed_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE public."trfs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "trf_number" text,
  "employee_id" uuid NOT NULL,
  "department" text NOT NULL,
  "travel_purpose" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "purpose_remarks" text,
  "status" text DEFAULT 'DRAFT'::text NOT NULL,
  "accommodation" jsonb,
  "travel_arrangements" jsonb DEFAULT '[]'::jsonb,
  "admin_dept_verify" jsonb,
  "parallel_approval" jsonb,
  "pm_approval" jsonb,
  "ga_process" jsonb,
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "ga_files" jsonb DEFAULT '[]'::jsonb,
  "ga_documents" jsonb,
  "lumpsum_amount" numeric,
  "lumpsum_currency" text DEFAULT 'IDR'::text,
  "lumpsum_note" text,
  "lumpsum_input_by" uuid,
  "lumpsum_input_at" timestamp without time zone,
  "purpose_entries" jsonb DEFAULT '[]'::jsonb,
  "accommodations" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE public."users" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "username" text NOT NULL,
  "email" text NOT NULL,
  "role" text NOT NULL,
  "department" text,
  "is_active" boolean DEFAULT true,
  "must_change_password" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "password_hash" text,
  "employee_id" uuid
);

ALTER TABLE public."app_login_attempts" ADD CONSTRAINT "app_login_attempts_failure_reason_check" CHECK (((failure_reason IS NULL) OR (failure_reason = ANY (ARRAY['INVALID_CREDENTIALS'::text, 'ACCOUNT_INACTIVE'::text, 'RATE_LIMITED'::text, 'SERVER_ERROR'::text]))));

ALTER TABLE public."app_login_attempts" ADD CONSTRAINT "app_login_attempts_identifier_hash_check" CHECK ((identifier_hash ~ '^[0-9a-f]{64}$'::text));

ALTER TABLE public."app_login_attempts" ADD CONSTRAINT "app_login_attempts_ip_hash_check" CHECK (((ip_hash IS NULL) OR (ip_hash ~ '^[0-9a-f]{64}$'::text)));

ALTER TABLE public."app_login_attempts" ADD CONSTRAINT "app_login_attempts_pkey" PRIMARY KEY (id);

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_expiry_after_creation_check" CHECK ((expires_at > created_at));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_expiry_check" CHECK ((expires_at > created_at));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_metadata_object_check" CHECK ((jsonb_typeof(metadata) = 'object'::text));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_pkey" PRIMARY KEY (id);

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_revoke_check" CHECK ((((revoked_at IS NULL) AND (revoke_reason IS NULL)) OR ((revoked_at IS NOT NULL) AND (revoke_reason IS NOT NULL) AND (TRIM(BOTH FROM revoke_reason) <> ''::text))));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_revoked_after_creation_check" CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at)));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_token_hash_check" CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_token_hash_format_check" CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text));

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_token_hash_key" UNIQUE (token_hash);

ALTER TABLE public."approval_hierarchy" ADD CONSTRAINT "approval_hierarchy_pkey" PRIMARY KEY (id);

ALTER TABLE public."approval_hierarchy" ADD CONSTRAINT "approval_hierarchy_role_department_employee_level_priority_key" UNIQUE (role, department, employee_level, priority);

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_actual_return_check" CHECK (((actual_return_date IS NULL) OR ((actual_return_date > approved_leave_start) AND (actual_return_date <= approved_leave_end))));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_generated_status_check" CHECK (((status <> 'OS_GENERATED'::text) OR ((actual_return_date IS NOT NULL) AND (os_generated_days > 0) AND (os_generated_at IS NOT NULL))));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_leave_date_check" CHECK ((approved_leave_end >= approved_leave_start));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_os_days_check" CHECK ((os_generated_days >= 0));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_os_exact_balance_check" CHECK (((status <> 'OS_GENERATED'::text) OR (os_generated_days = unused_leave_days)));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_os_ledger_required_check" CHECK (((status <> 'OS_GENERATED'::text) OR (os_ledger_id IS NOT NULL)));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_os_not_exceed_unused_check" CHECK (((actual_return_date IS NULL) OR (os_generated_days <= ((approved_leave_end - actual_return_date) + 1))));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_proposed_return_check" CHECK (((proposed_return_date > approved_leave_start) AND (proposed_return_date <= approved_leave_end)));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_request_role_check" CHECK ((request_source_role = ANY (ARRAY['HOD'::text, 'PM'::text, 'SUPER_ADMIN'::text])));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_requests_pkey" PRIMARY KEY (id);

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_requests_recall_number_key" UNIQUE (recall_number);

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_return_status_check" CHECK (((status <> ALL (ARRAY['RETURNED_TO_SITE'::text, 'OS_GENERATED'::text])) OR (actual_return_date IS NOT NULL)));

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_status_check" CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_HR_VALIDATION'::text, 'NEEDS_REVISION'::text, 'HR_VALIDATED'::text, 'PENDING_PM_APPROVAL'::text, 'PM_APPROVED'::text, 'GA_PROCESSING'::text, 'TRAVEL_BOOKED'::text, 'RETURNED_TO_SITE'::text, 'OS_GENERATED'::text, 'REJECTED'::text, 'CANCELLED'::text])));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_actor_check" CHECK ((((actor_type = 'USER'::text) AND (changed_by_user_id IS NOT NULL) AND (changed_by_role IS NOT NULL) AND (changed_by_role <> 'SYSTEM'::text)) OR ((actor_type = 'SYSTEM'::text) AND (changed_by_user_id IS NULL) AND ((changed_by_role IS NULL) OR (changed_by_role = 'SYSTEM'::text)))));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_actor_type_check" CHECK ((actor_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text])));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_from_status_check" CHECK (((from_status IS NULL) OR (from_status = ANY (ARRAY['DRAFT'::text, 'PENDING_HR_VALIDATION'::text, 'NEEDS_REVISION'::text, 'HR_VALIDATED'::text, 'PENDING_PM_APPROVAL'::text, 'PM_APPROVED'::text, 'GA_PROCESSING'::text, 'TRAVEL_BOOKED'::text, 'RETURNED_TO_SITE'::text, 'OS_GENERATED'::text, 'REJECTED'::text, 'CANCELLED'::text]))));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_role_check" CHECK (((changed_by_role IS NULL) OR (changed_by_role = ANY (ARRAY['EMPLOYEE'::text, 'ADMIN_DEPT'::text, 'HOD'::text, 'HR'::text, 'PM'::text, 'GA'::text, 'SUPER_ADMIN'::text, 'SYSTEM'::text]))));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_to_status_check" CHECK ((to_status = ANY (ARRAY['DRAFT'::text, 'PENDING_HR_VALIDATION'::text, 'NEEDS_REVISION'::text, 'HR_VALIDATED'::text, 'PENDING_PM_APPROVAL'::text, 'PM_APPROVED'::text, 'GA_PROCESSING'::text, 'TRAVEL_BOOKED'::text, 'RETURNED_TO_SITE'::text, 'OS_GENERATED'::text, 'REJECTED'::text, 'CANCELLED'::text])));

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_status_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_management_audit" ADD CONSTRAINT "employee_management_audit_action_check" CHECK ((action = ANY (ARRAY['CREATE'::text, 'UPDATE'::text, 'SET_ACTIVE'::text, 'RESET_PASSWORD'::text])));

ALTER TABLE public."employee_management_audit" ADD CONSTRAINT "employee_management_audit_operation_key_key" UNIQUE (operation_key);

ALTER TABLE public."employee_management_audit" ADD CONSTRAINT "employee_management_audit_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_balance_total_check" CHECK ((((remaining_days + expired_days) + cancelled_days) <= original_days));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_cancel_timestamp_check" CHECK ((((status = 'CANCELLED'::text) AND (cancelled_at IS NOT NULL) AND (cancellation_reason IS NOT NULL) AND (TRIM(BOTH FROM cancellation_reason) <> ''::text)) OR ((status <> 'CANCELLED'::text) AND (cancelled_at IS NULL) AND (cancellation_reason IS NULL))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_cancelled_days_check" CHECK ((cancelled_days >= 0));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_created_by_check" CHECK ((((created_by_type = 'USER'::text) AND (created_by_user_id IS NOT NULL)) OR ((created_by_type = 'SYSTEM'::text) AND (created_by_user_id IS NULL))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_created_by_type_check" CHECK ((created_by_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_cycle_check" CHECK (((cycle_number >= 0) AND (cycle_number <= 4)));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_expired_days_check" CHECK ((expired_days >= 0));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_expiry_timestamp_check" CHECK ((((status = 'EXPIRED'::text) AND (expired_at IS NOT NULL)) OR ((status <> 'EXPIRED'::text) AND (expired_at IS NULL))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_ledger_os_number_key" UNIQUE (os_number);

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_ledger_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_manual_actor_check" CHECK (((source_type <> 'MANUAL_ADJUSTMENT'::text) OR ((created_by_type = 'USER'::text) AND (created_by_user_id IS NOT NULL))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_metadata_check" CHECK ((jsonb_typeof(source_metadata) = 'object'::text));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_original_days_check" CHECK ((original_days > 0));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_remaining_days_check" CHECK ((remaining_days >= 0));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_source_relation_check" CHECK ((((source_type = 'EARLY_RECALL'::text) AND (early_recall_id IS NOT NULL)) OR ((source_type = 'OVERSTAY'::text) AND (early_recall_id IS NULL) AND (source_reference IS NOT NULL) AND (TRIM(BOTH FROM source_reference) <> ''::text)) OR ((source_type = 'MANUAL_ADJUSTMENT'::text) AND (early_recall_id IS NULL) AND (source_reference IS NOT NULL) AND (TRIM(BOTH FROM source_reference) <> ''::text) AND (remarks IS NOT NULL) AND (TRIM(BOTH FROM remarks) <> ''::text))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_source_type_check" CHECK ((source_type = ANY (ARRAY['EARLY_RECALL'::text, 'OVERSTAY'::text, 'MANUAL_ADJUSTMENT'::text])));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_status_balance_check" CHECK ((((status = 'AVAILABLE'::text) AND ((cycle_number >= 0) AND (cycle_number <= 3)) AND (remaining_days = original_days) AND (expired_days = 0) AND (cancelled_days = 0)) OR ((status = 'PARTIALLY_USED'::text) AND ((cycle_number >= 0) AND (cycle_number <= 3)) AND (remaining_days > 0) AND (remaining_days < original_days) AND (expired_days = 0) AND (cancelled_days = 0)) OR ((status = 'USED'::text) AND ((cycle_number >= 0) AND (cycle_number <= 3)) AND (remaining_days = 0) AND (expired_days = 0) AND (cancelled_days = 0)) OR ((status = 'EXPIRED'::text) AND (cycle_number = 4) AND (remaining_days = 0) AND (expired_days > 0) AND (cancelled_days = 0)) OR ((status = 'CANCELLED'::text) AND ((cycle_number >= 0) AND (cycle_number <= 3)) AND (remaining_days = 0) AND (expired_days = 0) AND (cancelled_days > 0))));

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_status_check" CHECK ((status = ANY (ARRAY['AVAILABLE'::text, 'PARTIALLY_USED'::text, 'USED'::text, 'EXPIRED'::text, 'CANCELLED'::text])));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_actor_check" CHECK ((((actor_type = 'USER'::text) AND (actor_user_id IS NOT NULL) AND (actor_role IS NOT NULL) AND (TRIM(BOTH FROM actor_role) <> ''::text)) OR ((actor_type = 'SYSTEM'::text) AND (actor_user_id IS NULL))));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_actor_type_check" CHECK ((actor_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_key_check" CHECK ((TRIM(BOTH FROM operation_key) <> ''::text));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_operation_key_key" UNIQUE (operation_key);

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_processed_days_check" CHECK (((processed_days >= 0) AND (processed_days <= requested_days)));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_requested_days_check" CHECK ((requested_days >= 0));

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_type_check" CHECK ((operation_type = ANY (ARRAY['GENERATE_OVERSTAY'::text, 'GENERATE_EARLY_RECALL'::text, 'CONSUME_FIFO'::text, 'AGE_ON_RETURN'::text, 'MANUAL_ADJUSTMENT'::text, 'CANCEL'::text])));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_actor_check" CHECK ((((actor_type = 'USER'::text) AND (actor_user_id IS NOT NULL) AND (actor_role IS NOT NULL) AND (TRIM(BOTH FROM actor_role) <> ''::text)) OR ((actor_type = 'SYSTEM'::text) AND (actor_user_id IS NULL))));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_actor_type_check" CHECK ((actor_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_cycle_after_check" CHECK (((cycle_after IS NULL) OR ((cycle_after >= 0) AND (cycle_after <= 4))));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_cycle_before_check" CHECK (((cycle_before IS NULL) OR ((cycle_before >= 0) AND (cycle_before <= 4))));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_days_check" CHECK ((days >= 0));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_remaining_check" CHECK (((remaining_before >= 0) AND (remaining_after >= 0)));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_status_after_check" CHECK ((status_after = ANY (ARRAY['AVAILABLE'::text, 'PARTIALLY_USED'::text, 'USED'::text, 'EXPIRED'::text, 'CANCELLED'::text])));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_status_before_check" CHECK ((status_before = ANY (ARRAY['NOT_CREATED'::text, 'AVAILABLE'::text, 'PARTIALLY_USED'::text, 'USED'::text, 'EXPIRED'::text, 'CANCELLED'::text])));

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_type_check" CHECK ((transaction_type = ANY (ARRAY['GENERATED'::text, 'CONSUMED'::text, 'CYCLE_ADVANCED'::text, 'EXPIRED'::text, 'CANCELLED'::text, 'MANUAL_ADJUSTED'::text])));

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_id_employee_unique" UNIQUE (id, employee_id);

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_period_check" CHECK (((effective_to IS NULL) OR (effective_to >= effective_from)));

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_source_check" CHECK ((source_type = ANY (ARRAY['INITIAL_IMPORT'::text, 'MANIFEST'::text, 'HR_MANUAL'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignments_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_actor_check" CHECK ((((actor_type = 'USER'::text) AND (actor_user_id IS NOT NULL) AND (actor_role IS NOT NULL) AND (TRIM(BOTH FROM actor_role) <> ''::text)) OR ((actor_type = 'SYSTEM'::text) AND (actor_user_id IS NULL))));

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_actor_type_check" CHECK ((actor_type = ANY (ARRAY['USER'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_event_type_check" CHECK ((event_type = ANY (ARRAY['ACTUAL_SITE_OUT_CONFIRMED'::text, 'LEAVE_START_CONFIRMED'::text, 'RETURN_TO_SITE_CONFIRMED'::text, 'SUCCESSOR_CREATED'::text, 'STATUS_CORRECTED'::text, 'MANUAL_CORRECTION'::text])));

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_from_status_check" CHECK (((from_status IS NULL) OR (from_status = ANY (ARRAY['PLANNED'::text, 'ON_SITE'::text, 'TRAVEL_OUT_PENDING'::text, 'ON_LEAVE'::text, 'COMPLETED'::text, 'CANCELLED'::text]))));

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_metadata_check" CHECK ((jsonb_typeof(metadata) = 'object'::text));

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_to_status_check" CHECK (((to_status IS NULL) OR (to_status = ANY (ARRAY['PLANNED'::text, 'ON_SITE'::text, 'TRAVEL_OUT_PENDING'::text, 'ON_LEAVE'::text, 'COMPLETED'::text, 'CANCELLED'::text]))));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_actual_leave_period_check" CHECK ((((actual_leave_start IS NULL) AND (actual_leave_end IS NULL)) OR ((actual_leave_start IS NOT NULL) AND ((actual_leave_end IS NULL) OR (actual_leave_end >= actual_leave_start)))));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_actual_site_period_check" CHECK (((actual_site_out IS NULL) OR ((actual_site_in IS NOT NULL) AND (actual_site_out > actual_site_in))));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_number_check" CHECK ((cycle_number > 0));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_planned_leave_period_check" CHECK ((((planned_leave_start IS NULL) AND (planned_leave_end IS NULL)) OR ((planned_leave_start IS NOT NULL) AND (planned_leave_end IS NOT NULL) AND (planned_leave_end >= planned_leave_start))));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_planned_site_period_check" CHECK ((planned_site_out > planned_site_in));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_source_check" CHECK ((source_type = ANY (ARRAY['BASELINE_MANIFEST'::text, 'TRF_AUTO'::text, 'HR_MANUAL'::text, 'SYSTEM'::text])));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_status_check" CHECK ((status = ANY (ARRAY['PLANNED'::text, 'ON_SITE'::text, 'TRAVEL_OUT_PENDING'::text, 'ON_LEAVE'::text, 'COMPLETED'::text, 'CANCELLED'::text])));

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_unique" UNIQUE (employee_id, cycle_number);

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycles_pkey" PRIMARY KEY (id);

ALTER TABLE public."employees" ADD CONSTRAINT "employees_employee_code_key" UNIQUE (employee_code);

ALTER TABLE public."employees" ADD CONSTRAINT "employees_employee_type_check" CHECK ((employee_type = ANY (ARRAY['EMPLOYEE'::text, 'VISITOR'::text]))) NOT VALID;

ALTER TABLE public."employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);

ALTER TABLE public."employees" ADD CONSTRAINT "employees_user_id_key" UNIQUE (user_id);

ALTER TABLE public."locations" ADD CONSTRAINT "locations_pkey" PRIMARY KEY (id);

ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_pkey" PRIMARY KEY (id);

ALTER TABLE public."reference_master" ADD CONSTRAINT "reference_master_pkey" PRIMARY KEY (id);

ALTER TABLE public."roster_patterns" ADD CONSTRAINT "roster_patterns_code_check" CHECK ((code ~ '^[0-9]+:[0-9]+$'::text));

ALTER TABLE public."roster_patterns" ADD CONSTRAINT "roster_patterns_code_key" UNIQUE (code);

ALTER TABLE public."roster_patterns" ADD CONSTRAINT "roster_patterns_leave_weeks_check" CHECK ((leave_weeks > 0));

ALTER TABLE public."roster_patterns" ADD CONSTRAINT "roster_patterns_pkey" PRIMARY KEY (id);

ALTER TABLE public."roster_patterns" ADD CONSTRAINT "roster_patterns_site_weeks_check" CHECK ((site_weeks > 0));

ALTER TABLE public."status_history" ADD CONSTRAINT "status_history_pkey" PRIMARY KEY (id);

ALTER TABLE public."trfs" ADD CONSTRAINT "trfs_pkey" PRIMARY KEY (id);

ALTER TABLE public."trfs" ADD CONSTRAINT "trfs_trf_number_key" UNIQUE (trf_number);

ALTER TABLE public."users" ADD CONSTRAINT "users_email_key" UNIQUE (email);

ALTER TABLE public."users" ADD CONSTRAINT "users_pkey" PRIMARY KEY (id);

ALTER TABLE public."users" ADD CONSTRAINT "users_username_key" UNIQUE (username);

ALTER TABLE public."app_login_attempts" ADD CONSTRAINT "app_login_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."app_sessions" ADD CONSTRAINT "app_sessions_user_fk" FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public."approval_hierarchy" ADD CONSTRAINT "approval_hierarchy_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_cancelled_by_fk" FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_employee_fk" FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_ga_processor_fk" FOREIGN KEY (ga_processed_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_hr_validator_fk" FOREIGN KEY (hr_validated_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_linked_trf_fk" FOREIGN KEY (linked_trf_id) REFERENCES trfs(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_os_ledger_fk" FOREIGN KEY (os_ledger_id) REFERENCES employee_os_ledger(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_pm_approver_fk" FOREIGN KEY (pm_approved_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_rejected_by_fk" FOREIGN KEY (rejected_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_requested_by_fk" FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_return_confirmer_fk" FOREIGN KEY (actual_return_confirmed_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."early_recall_requests" ADD CONSTRAINT "early_recall_source_trf_fk" FOREIGN KEY (source_trf_id) REFERENCES trfs(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_request_fk" FOREIGN KEY (early_recall_id) REFERENCES early_recall_requests(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public."early_recall_status_history" ADD CONSTRAINT "early_recall_history_user_fk" FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_management_audit" ADD CONSTRAINT "employee_management_audit_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_management_audit" ADD CONSTRAINT "employee_management_audit_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_created_by_fk" FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_early_recall_fk" FOREIGN KEY (early_recall_id) REFERENCES early_recall_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_earned_site_cycle_fk" FOREIGN KEY (earned_site_cycle_id) REFERENCES employee_site_cycles(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_ledger" ADD CONSTRAINT "employee_os_employee_fk" FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_operations" ADD CONSTRAINT "employee_os_operations_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_operation_id_fkey" FOREIGN KEY (operation_id) REFERENCES employee_os_operations(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_os_transactions" ADD CONSTRAINT "employee_os_transactions_os_ledger_id_fkey" FOREIGN KEY (os_ledger_id) REFERENCES employee_os_ledger(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_actor_fk" FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_employee_fk" FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_roster_assignments" ADD CONSTRAINT "employee_roster_assignment_pattern_fk" FOREIGN KEY (roster_pattern_id) REFERENCES roster_patterns(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_actor_user_id_fkey" FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycle_history" ADD CONSTRAINT "employee_site_cycle_history_site_cycle_id_fkey" FOREIGN KEY (site_cycle_id) REFERENCES employee_site_cycles(id) ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_assignment_employee_fk" FOREIGN KEY (roster_assignment_id, employee_id) REFERENCES employee_roster_assignments(id, employee_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_created_by_fk" FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_site_in_trf_fk" FOREIGN KEY (site_in_trf_id) REFERENCES trfs(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_site_location_fk" FOREIGN KEY (site_location_id) REFERENCES locations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE public."employee_site_cycles" ADD CONSTRAINT "employee_site_cycle_site_out_trf_fk" FOREIGN KEY (site_out_trf_id) REFERENCES trfs(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public."employees" ADD CONSTRAINT "fk_employee_user" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_trf_id_fkey" FOREIGN KEY (trf_id) REFERENCES trfs(id) ON DELETE CASCADE;

ALTER TABLE public."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE public."status_history" ADD CONSTRAINT "status_history_trf_id_fkey" FOREIGN KEY (trf_id) REFERENCES trfs(id) ON DELETE CASCADE;

ALTER TABLE public."users" ADD CONSTRAINT "fk_users_employee" FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX app_login_attempts_attempted_at_idx ON public.app_login_attempts USING btree (attempted_at);

CREATE INDEX app_login_attempts_identifier_time_idx ON public.app_login_attempts USING btree (identifier_hash, attempted_at DESC);

CREATE INDEX app_login_attempts_ip_time_idx ON public.app_login_attempts USING btree (ip_hash, attempted_at DESC) WHERE (ip_hash IS NOT NULL);

CREATE INDEX app_login_attempts_user_time_idx ON public.app_login_attempts USING btree (user_id, attempted_at DESC) WHERE (user_id IS NOT NULL);

CREATE INDEX app_sessions_active_lookup_idx ON public.app_sessions USING btree (token_hash, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX app_sessions_active_user_idx ON public.app_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);

CREATE INDEX app_sessions_expires_at_idx ON public.app_sessions USING btree (expires_at);

CREATE INDEX app_sessions_expiry_idx ON public.app_sessions USING btree (expires_at);

CREATE INDEX app_sessions_last_used_at_idx ON public.app_sessions USING btree (last_used_at);

CREATE UNIQUE INDEX app_sessions_token_hash_unique_idx ON public.app_sessions USING btree (token_hash);

CREATE INDEX app_sessions_user_id_idx ON public.app_sessions USING btree (user_id);

CREATE INDEX app_sessions_user_idx ON public.app_sessions USING btree (user_id, created_at DESC);

CREATE INDEX early_recall_created_at_idx ON public.early_recall_requests USING btree (created_at DESC);

CREATE INDEX early_recall_department_idx ON public.early_recall_requests USING btree (department);

CREATE INDEX early_recall_employee_idx ON public.early_recall_requests USING btree (employee_id);

CREATE UNIQUE INDEX early_recall_linked_trf_unique_idx ON public.early_recall_requests USING btree (linked_trf_id) WHERE (linked_trf_id IS NOT NULL);

CREATE UNIQUE INDEX early_recall_one_active_employee_idx ON public.early_recall_requests USING btree (employee_id) WHERE (status <> ALL (ARRAY['OS_GENERATED'::text, 'REJECTED'::text, 'CANCELLED'::text]));

CREATE UNIQUE INDEX early_recall_one_active_source_trf_idx ON public.early_recall_requests USING btree (source_trf_id) WHERE ((source_trf_id IS NOT NULL) AND (status <> ALL (ARRAY['OS_GENERATED'::text, 'REJECTED'::text, 'CANCELLED'::text])));

CREATE UNIQUE INDEX early_recall_os_ledger_unique_idx ON public.early_recall_requests USING btree (os_ledger_id) WHERE (os_ledger_id IS NOT NULL);

CREATE INDEX early_recall_source_trf_idx ON public.early_recall_requests USING btree (source_trf_id);

CREATE INDEX early_recall_status_idx ON public.early_recall_requests USING btree (status);

CREATE INDEX early_recall_history_actor_idx ON public.early_recall_status_history USING btree (changed_by_user_id) WHERE (changed_by_user_id IS NOT NULL);

CREATE INDEX early_recall_history_created_at_idx ON public.early_recall_status_history USING btree (created_at DESC);

CREATE INDEX early_recall_history_request_idx ON public.early_recall_status_history USING btree (early_recall_id, created_at);

CREATE INDEX early_recall_history_status_idx ON public.early_recall_status_history USING btree (to_status);

CREATE INDEX idx_employee_management_audit_actor ON public.employee_management_audit USING btree (actor_user_id, created_at DESC);

CREATE INDEX idx_employee_management_audit_employee ON public.employee_management_audit USING btree (employee_id, created_at DESC);

CREATE UNIQUE INDEX employee_os_early_recall_unique_idx ON public.employee_os_ledger USING btree (early_recall_id) WHERE (early_recall_id IS NOT NULL);

CREATE INDEX employee_os_earned_site_cycle_idx ON public.employee_os_ledger USING btree (earned_site_cycle_id);

CREATE INDEX employee_os_employee_cycle_idx ON public.employee_os_ledger USING btree (employee_id, cycle_number DESC, generated_date);

CREATE INDEX employee_os_employee_idx ON public.employee_os_ledger USING btree (employee_id);

CREATE INDEX employee_os_employee_status_idx ON public.employee_os_ledger USING btree (employee_id, status);

CREATE INDEX employee_os_generated_date_idx ON public.employee_os_ledger USING btree (generated_date DESC);

CREATE UNIQUE INDEX employee_os_overstay_site_cycle_unique_idx ON public.employee_os_ledger USING btree (((source_metadata ->> 'site_cycle_id'::text))) WHERE ((source_type = 'OVERSTAY'::text) AND (source_metadata ? 'site_cycle_id'::text));

CREATE INDEX employee_os_source_type_idx ON public.employee_os_ledger USING btree (source_type);

CREATE INDEX employee_os_operations_employee_idx ON public.employee_os_operations USING btree (employee_id, created_at DESC);

CREATE INDEX employee_os_operations_reference_idx ON public.employee_os_operations USING btree (reference_type, reference_id);

CREATE INDEX employee_os_operations_type_idx ON public.employee_os_operations USING btree (operation_type, created_at DESC);

CREATE INDEX employee_os_transactions_employee_idx ON public.employee_os_transactions USING btree (employee_id, created_at DESC);

CREATE INDEX employee_os_transactions_ledger_idx ON public.employee_os_transactions USING btree (os_ledger_id, created_at DESC);

CREATE INDEX employee_os_transactions_operation_idx ON public.employee_os_transactions USING btree (operation_id, created_at);

CREATE INDEX employee_roster_assignment_employee_period_idx ON public.employee_roster_assignments USING btree (employee_id, effective_from DESC, effective_to);

CREATE INDEX employee_roster_assignment_pattern_idx ON public.employee_roster_assignments USING btree (roster_pattern_id);

CREATE UNIQUE INDEX employee_roster_one_open_assignment_idx ON public.employee_roster_assignments USING btree (employee_id) WHERE (effective_to IS NULL);

CREATE INDEX employee_site_cycle_history_cycle_idx ON public.employee_site_cycle_history USING btree (site_cycle_id, created_at DESC);

CREATE INDEX employee_site_cycle_history_employee_idx ON public.employee_site_cycle_history USING btree (employee_id, created_at DESC);

CREATE INDEX employee_site_cycle_history_event_idx ON public.employee_site_cycle_history USING btree (event_type, event_date DESC);

CREATE INDEX employee_site_cycle_assignment_idx ON public.employee_site_cycles USING btree (roster_assignment_id, cycle_number);

CREATE INDEX employee_site_cycle_employee_date_idx ON public.employee_site_cycles USING btree (employee_id, planned_site_in DESC);

CREATE UNIQUE INDEX employee_site_cycle_one_on_site_idx ON public.employee_site_cycles USING btree (employee_id) WHERE (status = ANY (ARRAY['ON_SITE'::text, 'TRAVEL_OUT_PENDING'::text]));

CREATE INDEX employee_site_cycle_site_idx ON public.employee_site_cycles USING btree (site_location_id, status);

CREATE INDEX employee_site_cycle_status_idx ON public.employee_site_cycles USING btree (status, planned_site_out);

CREATE INDEX idx_employees_email_lower_lookup ON public.employees USING btree (lower(email)) WHERE (email IS NOT NULL);

CREATE INDEX idx_employees_employee_code_lookup ON public.employees USING btree (employee_code);

CREATE INDEX idx_employees_user_id_lookup ON public.employees USING btree (user_id);

CREATE UNIQUE INDEX ux_locations_airport_code ON public.locations USING btree (upper(TRIM(BOTH FROM code))) WHERE ((type = 'AIRPORT'::text) AND (code IS NOT NULL));

CREATE UNIQUE INDEX ux_locations_name_type ON public.locations USING btree (lower(TRIM(BOTH FROM name)), type);

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);

CREATE INDEX notifications_user_id_is_read_idx ON public.notifications USING btree (user_id, is_read);

CREATE VIEW public."employee_roster_site_summary" AS
 SELECT employee.id AS employee_id,
    employee.employee_code,
    employee.employee_name,
    employee.department,
    employee.job_title,
    assignment.id AS roster_assignment_id,
    pattern.id AS roster_pattern_id,
    pattern.code AS roster_code,
    pattern.site_days AS roster_site_days,
    pattern.leave_days AS roster_leave_days,
    assignment.effective_from AS roster_effective_from,
    assignment.effective_to AS roster_effective_to,
    cycle.id AS site_cycle_id,
    cycle.site_location_id,
    site_location.name AS site_name,
    site_location.city AS site_city,
    site_location.province AS site_province,
    cycle.cycle_number AS roster_cycle_number,
    cycle.status AS cycle_status,
    cycle.planned_site_in,
    cycle.planned_site_out,
    cycle.actual_site_in,
    cycle.actual_site_out,
    cycle.planned_leave_start,
    cycle.planned_leave_end,
    cycle.actual_leave_start,
    cycle.actual_leave_end,
        CASE
            WHEN (cycle.id IS NULL) THEN 'NO_BASELINE'::text
            WHEN (cycle.status = 'CANCELLED'::text) THEN 'CANCELLED'::text
            WHEN ((cycle.actual_site_in IS NOT NULL) AND (cycle.actual_site_out IS NULL) AND (CURRENT_DATE >= cycle.actual_site_in)) THEN 'ON_SITE'::text
            WHEN (cycle.status = 'ON_LEAVE'::text) THEN 'ON_LEAVE'::text
            WHEN (CURRENT_DATE < cycle.planned_site_in) THEN 'PLANNED_SITE_IN'::text
            WHEN (cycle.actual_site_out IS NOT NULL) THEN 'OFF_SITE'::text
            ELSE cycle.status
        END AS current_presence,
        CASE
            WHEN ((cycle.actual_site_in IS NOT NULL) AND (cycle.actual_site_out IS NULL) AND (CURRENT_DATE >= cycle.actual_site_in)) THEN ((CURRENT_DATE - cycle.actual_site_in) + 1)
            WHEN ((cycle.actual_site_in IS NOT NULL) AND (cycle.actual_site_out IS NOT NULL)) THEN (cycle.actual_site_out - cycle.actual_site_in)
            ELSE NULL::integer
        END AS days_at_site,
        CASE
            WHEN ((cycle.actual_site_in IS NOT NULL) AND (cycle.actual_site_out IS NULL)) THEN (cycle.planned_site_out - CURRENT_DATE)
            ELSE NULL::integer
        END AS days_until_planned_travel_out,
        CASE
            WHEN ((cycle.actual_site_in IS NOT NULL) AND (cycle.actual_site_out IS NULL) AND (CURRENT_DATE >= cycle.planned_site_out)) THEN ((CURRENT_DATE - cycle.planned_site_out) + 1)
            ELSE 0
        END AS overdue_site_days,
    cycle.site_in_trf_id,
    cycle.site_out_trf_id,
    cycle.source_type AS cycle_source_type,
    cycle.source_reference AS cycle_source_reference
   FROM ((((employees employee
     LEFT JOIN LATERAL ( SELECT roster_assignment.id,
            roster_assignment.employee_id,
            roster_assignment.roster_pattern_id,
            roster_assignment.effective_from,
            roster_assignment.effective_to,
            roster_assignment.source_type,
            roster_assignment.source_reference,
            roster_assignment.assigned_by_user_id,
            roster_assignment.remarks,
            roster_assignment.created_at,
            roster_assignment.updated_at
           FROM employee_roster_assignments roster_assignment
          WHERE ((roster_assignment.employee_id = employee.id) AND (roster_assignment.effective_from <= CURRENT_DATE) AND ((roster_assignment.effective_to IS NULL) OR (roster_assignment.effective_to >= CURRENT_DATE)))
          ORDER BY roster_assignment.effective_from DESC, roster_assignment.created_at DESC
         LIMIT 1) assignment ON (true))
     LEFT JOIN roster_patterns pattern ON ((pattern.id = assignment.roster_pattern_id)))
     LEFT JOIN LATERAL ( SELECT site_cycle.id,
            site_cycle.employee_id,
            site_cycle.roster_assignment_id,
            site_cycle.site_location_id,
            site_cycle.cycle_number,
            site_cycle.planned_site_in,
            site_cycle.planned_site_out,
            site_cycle.planned_site_days,
            site_cycle.actual_site_in,
            site_cycle.actual_site_out,
            site_cycle.actual_site_days,
            site_cycle.planned_leave_start,
            site_cycle.planned_leave_end,
            site_cycle.planned_leave_days,
            site_cycle.actual_leave_start,
            site_cycle.actual_leave_end,
            site_cycle.actual_leave_days,
            site_cycle.site_in_trf_id,
            site_cycle.site_out_trf_id,
            site_cycle.status,
            site_cycle.source_type,
            site_cycle.source_reference,
            site_cycle.created_by_user_id,
            site_cycle.remarks,
            site_cycle.created_at,
            site_cycle.updated_at
           FROM employee_site_cycles site_cycle
          WHERE ((site_cycle.employee_id = employee.id) AND (site_cycle.roster_assignment_id = assignment.id) AND (site_cycle.status <> 'CANCELLED'::text))
          ORDER BY
                CASE
                    WHEN ((site_cycle.actual_site_in IS NOT NULL) AND (site_cycle.actual_site_out IS NULL)) THEN 1
                    WHEN (site_cycle.status = 'ON_LEAVE'::text) THEN 2
                    WHEN (site_cycle.status = 'PLANNED'::text) THEN 3
                    ELSE 4
                END, COALESCE(site_cycle.actual_site_in, site_cycle.planned_site_in) DESC, site_cycle.cycle_number DESC
         LIMIT 1) cycle ON (true))
     LEFT JOIN locations site_location ON ((site_location.id = cycle.site_location_id)))
  WHERE (COALESCE(employee.is_active, true) = true);

CREATE OR REPLACE FUNCTION public.acknowledge_early_recall(p_actor_user_id uuid, p_early_recall_id uuid)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, acknowledged_at timestamp with time zone, already_acknowledged boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role <> 'EMPLOYEE' then
        raise exception
            'Hanya personal EMPLOYEE account yang dapat melakukan acknowledgment.';
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_actor.employee_id is null
       or v_actor.employee_id <> v_recall.employee_id then
        raise exception
            'Employee hanya dapat acknowledge Early Recall miliknya sendiri.';
    end if;

    if v_recall.status not in (
        'PM_APPROVED',
        'GA_PROCESSING',
        'TRAVEL_BOOKED',
        'RETURNED_TO_SITE',
        'OS_GENERATED'
    ) then
        raise exception
            'Early Recall berstatus % belum dapat di-acknowledge.',
            v_recall.status;
    end if;

    if v_recall.employee_acknowledged_at is not null then
        return query
        select
            v_recall.id,
            v_recall.recall_number,
            v_recall.status,
            v_recall.employee_acknowledged_at,
            true;
        return;
    end if;

    update public.early_recall_requests er
    set employee_acknowledged_at = now()
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_recall.status,
        v_recall.status,
        'USER',
        v_actor.id,
        v_actor.role,
        'Employee acknowledged the Early Recall notification.',
        jsonb_build_object(
            'event', 'EMPLOYEE_ACKNOWLEDGED',
            'acknowledged_at', v_recall.employee_acknowledged_at
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_recall.employee_acknowledged_at,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_employee_os(p_actor_user_id uuid, p_operation_key text, p_adjustment_type text, p_employee_id uuid DEFAULT NULL::uuid, p_os_ledger_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT NULL::integer, p_new_remaining_days integer DEFAULT NULL::integer, p_new_cycle_number integer DEFAULT NULL::integer, p_earned_site_cycle_id uuid DEFAULT NULL::uuid, p_generated_date date DEFAULT CURRENT_DATE, p_reference_number text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(operation_id uuid, os_ledger_id uuid, employee_id uuid, adjustment_type text, original_days integer, remaining_days integer, current_cycle_number integer, current_status text, earned_site_cycle_id uuid, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;

    v_adjustment_type text;
    v_operation_key text;
    v_reference_number text;
    v_remarks text;
    v_request_fingerprint text;

    v_existing_operation
        public.employee_os_operations%rowtype;

    v_ledger
        public.employee_os_ledger%rowtype;

    v_origin_cycle
        public.employee_site_cycles%rowtype;

    v_operation_id uuid;
    v_ledger_id uuid;
    v_employee_id uuid;

    v_operation_type text;
    v_transaction_type text;

    v_requested_days integer := 0;

    v_before_remaining integer;
    v_after_remaining integer;

    v_before_cycle smallint;
    v_after_cycle smallint;

    v_before_status text;
    v_after_status text;

    v_before_expired integer;
    v_after_expired integer;

    v_before_cancelled integer;
    v_after_cancelled integer;

    v_before_origin_cycle_id uuid;
    v_after_origin_cycle_id uuid;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    ) actor;

    v_operation_key :=
        nullif(trim(p_operation_key), '');

    v_adjustment_type :=
        upper(
            coalesce(
                nullif(trim(p_adjustment_type), ''),
                ''
            )
        );

    v_reference_number :=
        nullif(trim(p_reference_number), '');

    v_remarks :=
        nullif(trim(p_remarks), '');

    if v_operation_key is null then
        raise exception
            'Operation key wajib diisi.'
        using errcode = '22023';
    end if;

    if v_adjustment_type not in (
        'ADD_BUCKET',
        'SET_REMAINING',
        'SET_CURRENT_CYCLE',
        'SET_ORIGIN_CYCLE',
        'CANCEL_BUCKET'
    ) then
        raise exception
            'Adjustment type % tidak didukung.',
            v_adjustment_type
        using errcode = '22023';
    end if;

    if v_reference_number is null then
        raise exception
            'Supporting reference wajib diisi.'
        using errcode = '22023';
    end if;

    if v_remarks is null
       or length(v_remarks) < 3 then
        raise exception
            'Reason/remarks wajib diisi minimal 3 karakter.'
        using errcode = '22023';
    end if;

    v_request_fingerprint :=
        md5(
            concat_ws(
                '|',
                v_adjustment_type,
                coalesce(p_employee_id::text, ''),
                coalesce(p_os_ledger_id::text, ''),
                coalesce(p_days::text, ''),
                coalesce(
                    p_new_remaining_days::text,
                    ''
                ),
                coalesce(
                    p_new_cycle_number::text,
                    ''
                ),
                coalesce(
                    p_earned_site_cycle_id::text,
                    ''
                ),
                coalesce(
                    p_generated_date::text,
                    ''
                ),
                v_reference_number,
                v_remarks
            )
        );

    perform pg_advisory_xact_lock(
        hashtextextended(
            'ADJUST_EMPLOYEE_OS:'
            || v_operation_key,
            0
        )
    );

    select op.*
    into v_existing_operation
    from public.employee_os_operations op
    where op.operation_key = v_operation_key;

    if found then
        if (
            v_existing_operation.metadata
            ->> 'request_fingerprint'
        ) is distinct from v_request_fingerprint then
            raise exception
                'Operation key sudah digunakan untuk payload berbeda.'
            using errcode = '23505';
        end if;

        v_ledger_id :=
            (
                v_existing_operation.metadata
                ->> 'result_os_ledger_id'
            )::uuid;

        select os.*
        into strict v_ledger
        from public.employee_os_ledger os
        where os.id = v_ledger_id;

        return query
        select
            v_existing_operation.id,
            v_ledger.id,
            v_ledger.employee_id,
            v_adjustment_type,
            v_ledger.original_days,
            v_ledger.remaining_days,
            v_ledger.cycle_number::integer,
            v_ledger.status,
            v_ledger.earned_site_cycle_id,
            true;

        return;
    end if;

    if v_adjustment_type = 'ADD_BUCKET' then
        if p_employee_id is null then
            raise exception
                'Employee ID wajib diisi untuk Add OS.'
            using errcode = '22023';
        end if;

        if p_days is null
           or p_days <= 0 then
            raise exception
                'Jumlah OS harus lebih dari 0.'
            using errcode = '22023';
        end if;

        if p_new_cycle_number is null
           or p_new_cycle_number not between 0 and 3 then
            raise exception
                'Current OS Cycle untuk Add OS harus 0 sampai 3.'
            using errcode = '22023';
        end if;

        if p_earned_site_cycle_id is null then
            raise exception
                'Earned From Site Cycle wajib dipilih.'
            using errcode = '22023';
        end if;

        if p_generated_date is null then
            raise exception
                'Generated Date wajib diisi.'
            using errcode = '22023';
        end if;

        if not exists (
            select 1
            from public.employees e
            where e.id = p_employee_id
        ) then
            raise exception
                'Employee tidak ditemukan.'
            using errcode = 'P0002';
        end if;

        select c.*
        into strict v_origin_cycle
        from public.employee_site_cycles c
        where c.id = p_earned_site_cycle_id
          and c.employee_id = p_employee_id;

        v_employee_id := p_employee_id;
        v_ledger_id := gen_random_uuid();

        v_operation_type := 'MANUAL_ADJUSTMENT';
        v_transaction_type := 'MANUAL_ADJUSTED';
        v_requested_days := p_days;

        v_before_remaining := 0;
        v_after_remaining := p_days;

        v_before_cycle := null;
        v_after_cycle := p_new_cycle_number::smallint;

        v_before_status := 'NOT_CREATED';
        v_after_status := 'AVAILABLE';

        v_before_expired := 0;
        v_after_expired := 0;

        v_before_cancelled := 0;
        v_after_cancelled := 0;

        v_before_origin_cycle_id := null;
        v_after_origin_cycle_id :=
            p_earned_site_cycle_id;

        insert into public.employee_os_operations (
            operation_key,
            operation_type,
            employee_id,
            requested_days,
            processed_days,
            reference_type,
            reference_id,
            reference_number,
            actor_type,
            actor_user_id,
            actor_role,
            remarks,
            metadata
        )
        values (
            v_operation_key,
            v_operation_type,
            v_employee_id,
            v_requested_days,
            v_requested_days,
            'OS_LEDGER',
            v_ledger_id,
            v_reference_number,
            'USER',
            p_actor_user_id,
            v_actor_role,
            v_remarks,
            jsonb_build_object(
                'adjustment_type',
                    v_adjustment_type,
                'request_fingerprint',
                    v_request_fingerprint,
                'result_os_ledger_id',
                    v_ledger_id,
                'generated_date',
                    p_generated_date,
                'earned_site_cycle_id',
                    p_earned_site_cycle_id,
                'earned_site_cycle_number',
                    v_origin_cycle.cycle_number,
                'current_os_cycle',
                    p_new_cycle_number
            )
        )
        returning id
        into v_operation_id;

        insert into public.employee_os_ledger (
            id,
            employee_id,
            source_type,
            early_recall_id,
            source_reference,
            generated_date,
            original_days,
            remaining_days,
            cycle_number,
            status,
            created_by_type,
            created_by_user_id,
            remarks,
            source_metadata,
            earned_site_cycle_id
        )
        values (
            v_ledger_id,
            v_employee_id,
            'MANUAL_ADJUSTMENT',
            null,
            v_reference_number,
            p_generated_date,
            p_days,
            p_days,
            p_new_cycle_number,
            'AVAILABLE',
            'USER',
            p_actor_user_id,
            v_remarks,
            jsonb_build_object(
                'operation_id',
                    v_operation_id,
                'adjustment_type',
                    v_adjustment_type,
                'earned_site_cycle_id',
                    p_earned_site_cycle_id,
                'earned_site_cycle_number',
                    v_origin_cycle.cycle_number,
                'supporting_reference',
                    v_reference_number
            ),
            p_earned_site_cycle_id
        );

        insert into public.employee_os_transactions (
            operation_id,
            os_ledger_id,
            employee_id,
            transaction_type,
            days,
            cycle_before,
            cycle_after,
            remaining_before,
            remaining_after,
            status_before,
            status_after,
            actor_type,
            actor_user_id,
            actor_role,
            remarks,
            metadata
        )
        values (
            v_operation_id,
            v_ledger_id,
            v_employee_id,
            v_transaction_type,
            p_days,
            null,
            p_new_cycle_number,
            0,
            p_days,
            'NOT_CREATED',
            'AVAILABLE',
            'USER',
            p_actor_user_id,
            v_actor_role,
            v_remarks,
            jsonb_build_object(
                'adjustment_type',
                    v_adjustment_type,
                'supporting_reference',
                    v_reference_number,
                'earned_site_cycle_id',
                    p_earned_site_cycle_id
            )
        );

        select os.*
        into strict v_ledger
        from public.employee_os_ledger os
        where os.id = v_ledger_id;

        return query
        select
            v_operation_id,
            v_ledger.id,
            v_ledger.employee_id,
            v_adjustment_type,
            v_ledger.original_days,
            v_ledger.remaining_days,
            v_ledger.cycle_number::integer,
            v_ledger.status,
            v_ledger.earned_site_cycle_id,
            false;

        return;
    end if;

    if p_os_ledger_id is null then
        raise exception
            'OS Ledger ID wajib diisi.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'OS_LEDGER:'
            || p_os_ledger_id::text,
            0
        )
    );

    select os.*
    into strict v_ledger
    from public.employee_os_ledger os
    where os.id = p_os_ledger_id
    for update;

    if p_employee_id is not null
       and p_employee_id <> v_ledger.employee_id then
        raise exception
            'Employee ID tidak cocok dengan OS bucket.'
        using errcode = '23514';
    end if;

    v_employee_id := v_ledger.employee_id;
    v_ledger_id := v_ledger.id;

    v_before_remaining :=
        v_ledger.remaining_days;

    v_before_cycle :=
        v_ledger.cycle_number;

    v_before_status :=
        v_ledger.status;

    v_before_expired :=
        v_ledger.expired_days;

    v_before_cancelled :=
        v_ledger.cancelled_days;

    v_before_origin_cycle_id :=
        v_ledger.earned_site_cycle_id;

    v_after_remaining :=
        v_before_remaining;

    v_after_cycle :=
        v_before_cycle;

    v_after_status :=
        v_before_status;

    v_after_expired :=
        v_before_expired;

    v_after_cancelled :=
        v_before_cancelled;

    v_after_origin_cycle_id :=
        v_before_origin_cycle_id;

    if v_adjustment_type = 'SET_REMAINING' then
        if v_ledger.status in (
            'EXPIRED',
            'CANCELLED'
        ) then
            raise exception
                'Saldo bucket EXPIRED/CANCELLED tidak dapat diaktifkan melalui Set Remaining.'
            using errcode = '55000';
        end if;

        if p_new_remaining_days is null
           or p_new_remaining_days < 0
           or p_new_remaining_days >
               v_ledger.original_days then
            raise exception
                'New Remaining harus 0 sampai Original Days (%).',
                v_ledger.original_days
            using errcode = '22023';
        end if;

        v_after_remaining :=
            p_new_remaining_days;

        v_after_status :=
            case
                when v_after_remaining = 0
                    then 'USED'
                when v_after_remaining =
                    v_ledger.original_days
                    then 'AVAILABLE'
                else 'PARTIALLY_USED'
            end;

        v_requested_days :=
            abs(
                v_before_remaining
                - v_after_remaining
            );

        v_operation_type :=
            'MANUAL_ADJUSTMENT';

        v_transaction_type :=
            'MANUAL_ADJUSTED';

    elsif v_adjustment_type =
        'SET_CURRENT_CYCLE' then

        if v_ledger.status in (
            'EXPIRED',
            'CANCELLED'
        ) then
            raise exception
                'Cycle bucket EXPIRED/CANCELLED tidak dapat dikoreksi melalui action ini.'
            using errcode = '55000';
        end if;

        if p_new_cycle_number is null
           or p_new_cycle_number not between 0 and 4 then
            raise exception
                'New Current OS Cycle harus 0 sampai 4.'
            using errcode = '22023';
        end if;

        if p_new_cycle_number = 4 then
            if v_ledger.remaining_days <= 0 then
                raise exception
                    'Bucket tanpa remaining balance tidak dapat di-expire.'
                using errcode = '55000';
            end if;

            v_after_cycle := 4;
            v_after_status := 'EXPIRED';
            v_after_expired :=
                v_ledger.expired_days
                + v_ledger.remaining_days;
            v_after_remaining := 0;

            v_requested_days :=
                v_ledger.remaining_days;

            v_transaction_type := 'EXPIRED';
        else
            v_after_cycle :=
                p_new_cycle_number::smallint;

            v_requested_days := 0;
            v_transaction_type :=
                'MANUAL_ADJUSTED';
        end if;

        v_operation_type :=
            'MANUAL_ADJUSTMENT';

    elsif v_adjustment_type =
        'SET_ORIGIN_CYCLE' then

        if p_earned_site_cycle_id is null then
            raise exception
                'New Earned From Site Cycle wajib dipilih.'
            using errcode = '22023';
        end if;

        select c.*
        into strict v_origin_cycle
        from public.employee_site_cycles c
        where c.id = p_earned_site_cycle_id
          and c.employee_id =
              v_ledger.employee_id;

        v_after_origin_cycle_id :=
            p_earned_site_cycle_id;

        v_requested_days := 0;
        v_operation_type :=
            'MANUAL_ADJUSTMENT';
        v_transaction_type :=
            'MANUAL_ADJUSTED';

    elsif v_adjustment_type =
        'CANCEL_BUCKET' then

        if v_ledger.status in (
            'EXPIRED',
            'CANCELLED'
        ) then
            raise exception
                'Bucket sudah EXPIRED/CANCELLED.'
            using errcode = '55000';
        end if;

        if v_ledger.remaining_days <= 0 then
            raise exception
                'Bucket tanpa remaining balance tidak dapat dibatalkan.'
            using errcode = '55000';
        end if;

        v_after_remaining := 0;
        v_after_status := 'CANCELLED';
        v_after_cancelled :=
            v_ledger.cancelled_days
            + v_ledger.remaining_days;

        v_requested_days :=
            v_ledger.remaining_days;

        v_operation_type := 'CANCEL';
        v_transaction_type := 'CANCELLED';
    end if;

    insert into public.employee_os_operations (
        operation_key,
        operation_type,
        employee_id,
        requested_days,
        processed_days,
        reference_type,
        reference_id,
        reference_number,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        v_operation_key,
        v_operation_type,
        v_employee_id,
        v_requested_days,
        v_requested_days,
        'OS_LEDGER',
        v_ledger_id,
        v_reference_number,
        'USER',
        p_actor_user_id,
        v_actor_role,
        v_remarks,
        jsonb_build_object(
            'adjustment_type',
                v_adjustment_type,
            'request_fingerprint',
                v_request_fingerprint,
            'result_os_ledger_id',
                v_ledger_id,

            'before_remaining',
                v_before_remaining,
            'after_remaining',
                v_after_remaining,

            'before_cycle',
                v_before_cycle,
            'after_cycle',
                v_after_cycle,

            'before_status',
                v_before_status,
            'after_status',
                v_after_status,

            'before_origin_cycle_id',
                v_before_origin_cycle_id,
            'after_origin_cycle_id',
                v_after_origin_cycle_id,

            'supporting_reference',
                v_reference_number
        )
    )
    returning id
    into v_operation_id;

    if v_adjustment_type = 'SET_REMAINING' then
        update public.employee_os_ledger
        set
            remaining_days =
                v_after_remaining,
            status =
                v_after_status,
            updated_at =
                clock_timestamp()
        where id = v_ledger_id;

    elsif v_adjustment_type =
        'SET_CURRENT_CYCLE'
        and v_after_cycle = 4 then

        update public.employee_os_ledger
        set
            cycle_number = 4,
            remaining_days = 0,
            expired_days =
                v_after_expired,
            status = 'EXPIRED',
            expired_at =
                clock_timestamp(),
            updated_at =
                clock_timestamp()
        where id = v_ledger_id;

    elsif v_adjustment_type =
        'SET_CURRENT_CYCLE' then

        update public.employee_os_ledger
        set
            cycle_number =
                v_after_cycle,
            updated_at =
                clock_timestamp()
        where id = v_ledger_id;

    elsif v_adjustment_type =
        'SET_ORIGIN_CYCLE' then

        update public.employee_os_ledger
        set
            earned_site_cycle_id =
                v_after_origin_cycle_id,
            source_metadata =
                source_metadata
                || jsonb_build_object(
                    'earned_site_cycle_id',
                        v_after_origin_cycle_id,
                    'earned_site_cycle_number',
                        v_origin_cycle.cycle_number
                ),
            updated_at =
                clock_timestamp()
        where id = v_ledger_id;

    elsif v_adjustment_type =
        'CANCEL_BUCKET' then

        update public.employee_os_ledger
        set
            remaining_days = 0,
            cancelled_days =
                v_after_cancelled,
            status = 'CANCELLED',
            cancelled_at =
                clock_timestamp(),
            cancellation_reason =
                v_remarks,
            updated_at =
                clock_timestamp()
        where id = v_ledger_id;
    end if;

    insert into public.employee_os_transactions (
        operation_id,
        os_ledger_id,
        employee_id,
        transaction_type,
        days,
        cycle_before,
        cycle_after,
        remaining_before,
        remaining_after,
        status_before,
        status_after,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        v_operation_id,
        v_ledger_id,
        v_employee_id,
        v_transaction_type,
        v_requested_days,
        v_before_cycle,
        v_after_cycle,
        v_before_remaining,
        v_after_remaining,
        v_before_status,
        v_after_status,
        'USER',
        p_actor_user_id,
        v_actor_role,
        v_remarks,
        jsonb_build_object(
            'adjustment_type',
                v_adjustment_type,
            'supporting_reference',
                v_reference_number,
            'before_origin_cycle_id',
                v_before_origin_cycle_id,
            'after_origin_cycle_id',
                v_after_origin_cycle_id,
            'before_expired_days',
                v_before_expired,
            'after_expired_days',
                v_after_expired,
            'before_cancelled_days',
                v_before_cancelled,
            'after_cancelled_days',
                v_after_cancelled
        )
    );

    select os.*
    into strict v_ledger
    from public.employee_os_ledger os
    where os.id = v_ledger_id;

    return query
    select
        v_operation_id,
        v_ledger.id,
        v_ledger.employee_id,
        v_adjustment_type,
        v_ledger.original_days,
        v_ledger.remaining_days,
        v_ledger.cycle_number::integer,
        v_ledger.status,
        v_ledger.earned_site_cycle_id,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_overstay_os_days(p_roster_code text, p_extra_site_days integer)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_result integer;
begin
    if p_roster_code is null
       or trim(p_roster_code) = '' then
        raise exception
            'Roster code wajib diisi.'
        using errcode = '22023';
    end if;

    if p_extra_site_days is null
       or p_extra_site_days < 0 then
        raise exception
            'Extra site days harus bernilai 0 atau lebih.'
        using errcode = '22023';
    end if;

    case trim(p_roster_code)
        when '4:2' then
            v_result :=
                p_extra_site_days / 2;

        when '5:2' then
            v_result :=
                floor(
                    p_extra_site_days * 2.0 / 5.0
                )::integer;

        when '6:2' then
            v_result :=
                (p_extra_site_days / 3)
                +
                case
                    when mod(p_extra_site_days, 3) * 2 > 3
                        then 1
                    else 0
                end;

        when '8:2' then
            v_result :=
                (p_extra_site_days / 4)
                +
                case
                    when mod(p_extra_site_days, 4) * 2 > 4
                        then 1
                    else 0
                end;

        when '10:2' then
            v_result :=
                (p_extra_site_days / 5)
                +
                case
                    when mod(p_extra_site_days, 5) * 2 > 5
                        then 1
                    else 0
                end;

        else
            raise exception
                'Roster code % belum didukung oleh OS engine.',
                p_roster_code
            using errcode = '22023';
    end case;

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_roster_planned_leave_end(p_roster_pattern_id uuid, p_site_out date)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    select
        p_site_out
        + pattern.leave_days
        - 1
    from public.roster_patterns pattern
    where pattern.id =
        p_roster_pattern_id
      and pattern.is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_roster_planned_site_out(p_roster_pattern_id uuid, p_site_in date)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
    select
        p_site_in + pattern.site_days
    from public.roster_patterns pattern
    where pattern.id =
        p_roster_pattern_id
      and pattern.is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_cancellation_reason text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_linked_trf public.trfs%rowtype;
    v_from_status text;
begin
    if p_cancellation_reason is null
       or trim(p_cancellation_reason) = '' then
        raise exception 'Cancellation reason wajib diisi.';
    end if;

    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('HOD', 'HR', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan cancel Early Recall.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status in (
        'RETURNED_TO_SITE',
        'OS_GENERATED',
        'REJECTED',
        'CANCELLED'
    ) then
        raise exception
            'Early Recall berstatus % tidak dapat dibatalkan.',
            v_recall.status;
    end if;

    if (
        v_actor.role = 'HOD'
        and (
            v_actor.department is null
            or v_actor.department <> v_recall.department
        )
    ) then
        raise exception
            'HOD hanya dapat cancel Early Recall department sendiri.';
    end if;

    if (
        v_recall.status in (
            'PENDING_PM_APPROVAL',
            'PM_APPROVED',
            'GA_PROCESSING',
            'TRAVEL_BOOKED'
        )
        and v_actor.role not in ('PM', 'SUPER_ADMIN')
    ) then
        raise exception
            'Setelah masuk tahap PM, cancellation hanya dapat dilakukan PM/SUPER_ADMIN.';
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set
        status = 'CANCELLED',
        cancelled_by_user_id = v_actor.id,
        cancelled_at = now(),
        cancellation_reason = trim(p_cancellation_reason)
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    -- Jika linked TRF belum selesai diproses GA, tutup sebagai REJECTED.
    if v_recall.linked_trf_id is not null then
        select t.*
        into v_linked_trf
        from public.trfs t
        where t.id = v_recall.linked_trf_id
        for update;

        if found and v_linked_trf.status <> 'GA_PROCESSED' then
            update public.trfs
            set
                status = 'REJECTED',
                updated_at = now()
            where id = v_linked_trf.id;
        end if;
    end if;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_from_status,
        'CANCELLED',
        'USER',
        v_actor.id,
        v_actor.role,
        v_recall.cancellation_reason,
        jsonb_build_object(
            'linked_trf_id', v_recall.linked_trf_id,
            'linked_trf_was_ga_processed',
                case
                    when v_linked_trf.id is null then null
                    else v_linked_trf.status = 'GA_PROCESSED'
                end
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_app_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_deleted integer;
begin
    delete from public.app_sessions
    where
        (
            expires_at < now() - interval '30 days'
        )
        or
        (
            revoked_at is not null
            and revoked_at < now() - interval '30 days'
        );

    get diagnostics v_deleted = row_count;

    return v_deleted;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_early_recall_actual_return(p_actor_user_id uuid, p_early_recall_id uuid, p_actual_return_date date, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, employee_id uuid, os_ledger_id uuid, os_number text, os_generated_days integer, cycle_number smallint, os_status text, already_generated boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('GA', 'HR', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan confirm Actual Return.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    -- Retry setelah OS sudah terbentuk.
    if v_recall.status = 'OS_GENERATED' then
        return query
        select *
        from public.generate_early_recall_os(v_recall.id);
        return;
    end if;

    if v_recall.status not in ('TRAVEL_BOOKED', 'RETURNED_TO_SITE') then
        raise exception
            'Expected TRAVEL_BOOKED/RETURNED_TO_SITE, status saat ini %.',
            v_recall.status;
    end if;

    if (
        p_actual_return_date <= v_recall.approved_leave_start
        or p_actual_return_date > v_recall.approved_leave_end
    ) then
        raise exception
            'Actual Return Date harus setelah awal cuti dan tidak melewati akhir cuti.';
    end if;

    if v_recall.status = 'TRAVEL_BOOKED' then
        update public.early_recall_requests er
        set
            actual_return_date = p_actual_return_date,
            actual_return_confirmed_by_user_id = v_actor.id,
            actual_return_confirmed_at = now(),
            status = 'RETURNED_TO_SITE'
        where er.id = v_recall.id
        returning er.*
        into v_recall;

        insert into public.early_recall_status_history (
            early_recall_id,
            from_status,
            to_status,
            actor_type,
            changed_by_user_id,
            changed_by_role,
            remarks,
            metadata
        )
        values (
            v_recall.id,
            'TRAVEL_BOOKED',
            'RETURNED_TO_SITE',
            'USER',
            v_actor.id,
            v_actor.role,
            coalesce(
                nullif(trim(coalesce(p_remarks, '')), ''),
                'Actual return to site confirmed.'
            ),
            jsonb_build_object(
                'actual_return_date', v_recall.actual_return_date,
                'actual_leave_days_used', v_recall.actual_leave_days_used,
                'unused_leave_days', v_recall.unused_leave_days
            )
        );
    end if;

    return query
    select *
    from public.generate_early_recall_os(v_recall.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_employee_actual_site_out(p_actor_user_id uuid, p_site_cycle_id uuid, p_actual_site_out date, p_site_out_trf_id uuid DEFAULT NULL::uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(site_cycle_id uuid, employee_id uuid, actual_site_out date, extra_site_days integer, os_generated_days integer, os_ledger_id uuid, cycle_status text, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;

    v_cycle public.employee_site_cycles%rowtype;
    v_assignment public.employee_roster_assignments%rowtype;
    v_pattern public.roster_patterns%rowtype;

    v_extra_days integer;
    v_os_days integer;
    v_os_ledger_id uuid;
    v_operation_id uuid;
    v_operation_key text;
    v_existing_os public.employee_os_ledger%rowtype;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['GA', 'HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if p_site_cycle_id is null then
        raise exception
            'Site cycle ID wajib diisi.'
        using errcode = '22023';
    end if;

    if p_actual_site_out is null then
        raise exception
            'Actual Site Out wajib diisi.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'CONFIRM_SITE_OUT:' || p_site_cycle_id::text,
            0
        )
    );

    select c.*
    into strict v_cycle
    from public.employee_site_cycles c
    where c.id = p_site_cycle_id
    for update;

    select a.*
    into strict v_assignment
    from public.employee_roster_assignments a
    where a.id = v_cycle.roster_assignment_id;

    select p.*
    into strict v_pattern
    from public.roster_patterns p
    where p.id = v_assignment.roster_pattern_id
      and coalesce(p.is_active, true) = true;

    if v_cycle.actual_site_out is not null then
        if v_cycle.actual_site_out <> p_actual_site_out then
            raise exception
                'Actual Site Out sudah dikonfirmasi pada %, tidak dapat diganti menjadi %.',
                v_cycle.actual_site_out,
                p_actual_site_out
            using errcode = '22023';
        end if;

        select os.*
        into v_existing_os
        from public.employee_os_ledger os
        where os.source_type = 'OVERSTAY'
          and os.source_metadata ->> 'site_cycle_id'
              = v_cycle.id::text
        limit 1;

        v_extra_days :=
            greatest(
                v_cycle.actual_site_out
                - v_cycle.planned_site_out,
                0
            );

        v_os_days :=
            public.calculate_overstay_os_days(
                v_pattern.code,
                v_extra_days
            );

        return query
        select
            v_cycle.id,
            v_cycle.employee_id,
            v_cycle.actual_site_out,
            v_extra_days,
            v_os_days,
            v_existing_os.id,
            v_cycle.status,
            true;

        return;
    end if;

    if v_cycle.status not in (
        'ON_SITE',
        'TRAVEL_OUT_PENDING'
    ) then
        raise exception
            'Site cycle berstatus %, Actual Site Out hanya dapat dikonfirmasi dari ON_SITE atau TRAVEL_OUT_PENDING.',
            v_cycle.status
        using errcode = '55000';
    end if;

    if p_actual_site_out
       <= coalesce(
           v_cycle.actual_site_in,
           v_cycle.planned_site_in
       ) then
        raise exception
            'Actual Site Out (%) harus setelah Site In (%).',
            p_actual_site_out,
            coalesce(
                v_cycle.actual_site_in,
                v_cycle.planned_site_in
            )
        using errcode = '22023';
    end if;

    if p_site_out_trf_id is not null
       and not exists (
           select 1
           from public.trfs t
           where t.id = p_site_out_trf_id
             and t.employee_id = v_cycle.employee_id
       ) then
        raise exception
            'Site-Out TRF tidak ditemukan atau bukan milik employee site cycle.'
        using errcode = '23503';
    end if;

    v_extra_days :=
        greatest(
            p_actual_site_out
            - v_cycle.planned_site_out,
            0
        );

    v_os_days :=
        public.calculate_overstay_os_days(
            v_pattern.code,
            v_extra_days
        );

    update public.employee_site_cycles
    set
        actual_site_out = p_actual_site_out,
        site_out_trf_id = coalesce(
            p_site_out_trf_id,
            site_out_trf_id
        ),
        status = 'TRAVEL_OUT_PENDING',
        remarks = concat_ws(
            E'\n',
            nullif(remarks, ''),
            nullif(trim(p_remarks), '')
        ),
        updated_at = clock_timestamp()
    where id = v_cycle.id;

    insert into public.employee_site_cycle_history (
        site_cycle_id,
        employee_id,
        event_type,
        from_status,
        to_status,
        event_date,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        v_cycle.id,
        v_cycle.employee_id,
        'ACTUAL_SITE_OUT_CONFIRMED',
        v_cycle.status,
        'TRAVEL_OUT_PENDING',
        p_actual_site_out,
        'USER',
        p_actor_user_id,
        v_actor_role,
        p_remarks,
        jsonb_build_object(
            'planned_site_out', v_cycle.planned_site_out,
            'actual_site_out', p_actual_site_out,
            'extra_site_days', v_extra_days,
            'roster_code', v_pattern.code,
            'os_generated_days', v_os_days,
            'site_out_trf_id', p_site_out_trf_id
        )
    );

    if v_os_days > 0 then
        v_operation_key :=
            'OVERSTAY:' || v_cycle.id::text;

        select op.id
        into v_operation_id
        from public.employee_os_operations op
        where op.operation_key = v_operation_key;

        if v_operation_id is null then
            insert into public.employee_os_operations (
                operation_key,
                operation_type,
                employee_id,
                requested_days,
                processed_days,
                reference_type,
                reference_id,
                reference_number,
                actor_type,
                actor_user_id,
                actor_role,
                remarks,
                metadata
            )
            values (
                v_operation_key,
                'GENERATE_OVERSTAY',
                v_cycle.employee_id,
                v_os_days,
                v_os_days,
                'SITE_CYCLE',
                v_cycle.id,
                null,
                'USER',
                p_actor_user_id,
                v_actor_role,
                p_remarks,
                jsonb_build_object(
                    'roster_code', v_pattern.code,
                    'planned_site_out', v_cycle.planned_site_out,
                    'actual_site_out', p_actual_site_out,
                    'extra_site_days', v_extra_days
                )
            )
            returning id
            into v_operation_id;
        end if;

        select os.*
        into v_existing_os
        from public.employee_os_ledger os
        where os.source_type = 'OVERSTAY'
          and os.source_metadata ->> 'site_cycle_id'
              = v_cycle.id::text
        limit 1;

        if found then
            if v_existing_os.original_days <> v_os_days then
                raise exception
                    'Existing OVERSTAY OS amount % does not match calculated amount %.',
                    v_existing_os.original_days,
                    v_os_days
                using errcode = '23514';
            end if;

            v_os_ledger_id := v_existing_os.id;
        else
            insert into public.employee_os_ledger (
                employee_id,
                source_type,
                early_recall_id,
                source_reference,
                generated_date,
                original_days,
                remaining_days,
                cycle_number,
                status,
                created_by_type,
                created_by_user_id,
                remarks,
                source_metadata
            )
            values (
                v_cycle.employee_id,
                'OVERSTAY',
                null,
                'SITE_CYCLE:' || v_cycle.id::text,
                p_actual_site_out,
                v_os_days,
                v_os_days,
                0,
                'AVAILABLE',
                'USER',
                p_actor_user_id,
                p_remarks,
                jsonb_build_object(
                    'site_cycle_id', v_cycle.id,
                    'roster_code', v_pattern.code,
                    'planned_site_out', v_cycle.planned_site_out,
                    'actual_site_out', p_actual_site_out,
                    'extra_site_days', v_extra_days,
                    'conversion_rule', 'ROSTER_OVERSTAY',
                    'operation_id', v_operation_id
                )
            )
            returning id
            into v_os_ledger_id;

            insert into public.employee_os_transactions (
                operation_id,
                os_ledger_id,
                employee_id,
                transaction_type,
                days,
                cycle_before,
                cycle_after,
                remaining_before,
                remaining_after,
                status_before,
                status_after,
                actor_type,
                actor_user_id,
                actor_role,
                remarks,
                metadata
            )
            values (
                v_operation_id,
                v_os_ledger_id,
                v_cycle.employee_id,
                'GENERATED',
                v_os_days,
                null,
                0,
                0,
                v_os_days,
                'NOT_CREATED',
                'AVAILABLE',
                'USER',
                p_actor_user_id,
                v_actor_role,
                p_remarks,
                jsonb_build_object(
                    'site_cycle_id', v_cycle.id,
                    'source_type', 'OVERSTAY'
                )
            );
        end if;
    end if;

    return query
    select
        v_cycle.id,
        v_cycle.employee_id,
        p_actual_site_out,
        v_extra_days,
        v_os_days,
        v_os_ledger_id,
        'TRAVEL_OUT_PENDING'::text,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_employee_leave_start(p_actor_user_id uuid, p_site_cycle_id uuid, p_actual_leave_start date, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(site_cycle_id uuid, employee_id uuid, actual_leave_start date, cycle_status text, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;
    v_cycle public.employee_site_cycles%rowtype;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['GA', 'HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if p_site_cycle_id is null
       or p_actual_leave_start is null then
        raise exception
            'Site cycle ID dan Actual Leave Start wajib diisi.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'CONFIRM_LEAVE_START:' || p_site_cycle_id::text,
            0
        )
    );

    select c.*
    into strict v_cycle
    from public.employee_site_cycles c
    where c.id = p_site_cycle_id
    for update;

    if v_cycle.actual_leave_start is not null then
        if v_cycle.actual_leave_start
           <> p_actual_leave_start then
            raise exception
                'Actual Leave Start sudah dikonfirmasi pada %, tidak dapat diganti menjadi %.',
                v_cycle.actual_leave_start,
                p_actual_leave_start
            using errcode = '22023';
        end if;

        return query
        select
            v_cycle.id,
            v_cycle.employee_id,
            v_cycle.actual_leave_start,
            v_cycle.status,
            true;

        return;
    end if;

    if v_cycle.actual_site_out is null then
        raise exception
            'Actual Site Out harus dikonfirmasi sebelum Leave Start.'
        using errcode = '55000';
    end if;

    if v_cycle.status not in (
        'TRAVEL_OUT_PENDING',
        'ON_LEAVE'
    ) then
        raise exception
            'Site cycle berstatus %, Leave Start hanya dapat dikonfirmasi dari TRAVEL_OUT_PENDING atau ON_LEAVE.',
            v_cycle.status
        using errcode = '55000';
    end if;

    if p_actual_leave_start < v_cycle.actual_site_out then
        raise exception
            'Actual Leave Start (%) tidak boleh sebelum Actual Site Out (%).',
            p_actual_leave_start,
            v_cycle.actual_site_out
        using errcode = '22023';
    end if;

    update public.employee_site_cycles
    set
        actual_leave_start = p_actual_leave_start,
        status = 'ON_LEAVE',
        remarks = concat_ws(
            E'\n',
            nullif(remarks, ''),
            nullif(trim(p_remarks), '')
        ),
        updated_at = clock_timestamp()
    where id = v_cycle.id;

    insert into public.employee_site_cycle_history (
        site_cycle_id,
        employee_id,
        event_type,
        from_status,
        to_status,
        event_date,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        v_cycle.id,
        v_cycle.employee_id,
        'LEAVE_START_CONFIRMED',
        v_cycle.status,
        'ON_LEAVE',
        p_actual_leave_start,
        'USER',
        p_actor_user_id,
        v_actor_role,
        p_remarks,
        jsonb_build_object(
            'actual_site_out', v_cycle.actual_site_out,
            'actual_leave_start', p_actual_leave_start
        )
    );

    return query
    select
        v_cycle.id,
        v_cycle.employee_id,
        p_actual_leave_start,
        'ON_LEAVE'::text,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_employee_return_to_site(p_actor_user_id uuid, p_site_cycle_id uuid, p_return_to_site_date date, p_site_in_trf_id uuid DEFAULT NULL::uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(previous_cycle_id uuid, successor_cycle_id uuid, employee_id uuid, return_to_site_date date, previous_cycle_status text, successor_cycle_status text, os_advanced_count integer, os_expired_days integer, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;

    v_cycle public.employee_site_cycles%rowtype;
    v_assignment public.employee_roster_assignments%rowtype;
    v_pattern public.roster_patterns%rowtype;
    v_successor public.employee_site_cycles%rowtype;

    v_operation_id uuid;
    v_operation_key text;

    v_os record;
    v_after_cycle smallint;
    v_after_status text;
    v_after_remaining integer;
    v_after_expired integer;

    v_advanced_count integer := 0;
    v_expired_days_total integer := 0;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['GA', 'HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if p_site_cycle_id is null
       or p_return_to_site_date is null then
        raise exception
            'Site cycle ID dan Return to Site/D1 wajib diisi.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'CONFIRM_RETURN:' || p_site_cycle_id::text,
            0
        )
    );

    select c.*
    into strict v_cycle
    from public.employee_site_cycles c
    where c.id = p_site_cycle_id
    for update;

    if p_site_in_trf_id is not null
       and not exists (
           select 1
           from public.trfs t
           where t.id = p_site_in_trf_id
             and t.employee_id = v_cycle.employee_id
       ) then
        raise exception
            'Site-In TRF tidak ditemukan atau bukan milik employee site cycle.'
        using errcode = '23503';
    end if;

    if v_cycle.status = 'COMPLETED' then
        select c.*
        into v_successor
        from public.employee_site_cycles c
        where c.employee_id = v_cycle.employee_id
          and c.cycle_number = v_cycle.cycle_number + 1
          and c.status <> 'CANCELLED';

        if not found then
            raise exception
                'Previous cycle sudah COMPLETED tetapi successor tidak ditemukan.'
            using errcode = '23514';
        end if;

        if v_cycle.actual_leave_end
           <> p_return_to_site_date - 1
           or v_successor.actual_site_in
              <> p_return_to_site_date then
            raise exception
                'Return to Site sudah diproses dengan tanggal berbeda.'
            using errcode = '22023';
        end if;

        v_operation_key :=
            'AGE_ON_RETURN:'
            || v_cycle.id::text
            || ':'
            || p_return_to_site_date::text;

        select
            count(*) filter (
                where tx.transaction_type
                    in ('CYCLE_ADVANCED', 'EXPIRED')
            ),
            coalesce(
                sum(tx.days) filter (
                    where tx.transaction_type = 'EXPIRED'
                ),
                0
            )
        into
            v_advanced_count,
            v_expired_days_total
        from public.employee_os_operations op
        left join public.employee_os_transactions tx
          on tx.operation_id = op.id
        where op.operation_key = v_operation_key;

        return query
        select
            v_cycle.id,
            v_successor.id,
            v_cycle.employee_id,
            p_return_to_site_date,
            'COMPLETED'::text,
            v_successor.status,
            coalesce(v_advanced_count, 0),
            coalesce(v_expired_days_total, 0),
            true;

        return;
    end if;

    if v_cycle.status <> 'ON_LEAVE' then
        raise exception
            'Site cycle berstatus %, Return to Site hanya dapat dikonfirmasi dari ON_LEAVE.',
            v_cycle.status
        using errcode = '55000';
    end if;

    if v_cycle.actual_leave_start is null then
        raise exception
            'Actual Leave Start harus tersedia sebelum Return to Site.'
        using errcode = '55000';
    end if;

    if p_return_to_site_date
       <= v_cycle.actual_leave_start then
        raise exception
            'Return to Site (%) harus setelah Actual Leave Start (%).',
            p_return_to_site_date,
            v_cycle.actual_leave_start
        using errcode = '22023';
    end if;

    if exists (
        select 1
        from public.employee_site_cycles c
        where c.employee_id = v_cycle.employee_id
          and c.cycle_number = v_cycle.cycle_number + 1
          and c.status <> 'CANCELLED'
    ) then
        raise exception
            'Successor cycle number % sudah tersedia untuk employee.',
            v_cycle.cycle_number + 1
        using errcode = '23505';
    end if;

    select a.*
    into strict v_assignment
    from public.employee_roster_assignments a
    where a.id = v_cycle.roster_assignment_id
      and a.effective_to is null;

    select p.*
    into strict v_pattern
    from public.roster_patterns p
    where p.id = v_assignment.roster_pattern_id
      and coalesce(p.is_active, true) = true;

    update public.employee_site_cycles
    set
        actual_leave_end = p_return_to_site_date - 1,
        status = 'COMPLETED',
        remarks = concat_ws(
            E'\n',
            nullif(remarks, ''),
            nullif(trim(p_remarks), '')
        ),
        updated_at = clock_timestamp()
    where id = v_cycle.id;

    insert into public.employee_site_cycles (
        employee_id,
        roster_assignment_id,
        site_location_id,
        cycle_number,
        planned_site_in,
        planned_site_out,
        actual_site_in,
        planned_leave_start,
        planned_leave_end,
        site_in_trf_id,
        site_out_trf_id,
        status,
        source_type,
        source_reference,
        created_by_user_id,
        remarks
    )
    values (
        v_cycle.employee_id,
        v_cycle.roster_assignment_id,
        v_cycle.site_location_id,
        v_cycle.cycle_number + 1,
        p_return_to_site_date,
        p_return_to_site_date + v_pattern.site_days,
        p_return_to_site_date,
        p_return_to_site_date + v_pattern.site_days,
        p_return_to_site_date
            + v_pattern.site_days
            + v_pattern.leave_days
            - 1,
        p_site_in_trf_id,
        null,
        'ON_SITE',
        'SYSTEM',
        'RETURN_TO_SITE:'
            || v_cycle.id::text
            || ':'
            || p_return_to_site_date::text,
        p_actor_user_id,
        p_remarks
    )
    returning *
    into v_successor;

    insert into public.employee_site_cycle_history (
        site_cycle_id,
        employee_id,
        event_type,
        from_status,
        to_status,
        event_date,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values
    (
        v_cycle.id,
        v_cycle.employee_id,
        'RETURN_TO_SITE_CONFIRMED',
        v_cycle.status,
        'COMPLETED',
        p_return_to_site_date,
        'USER',
        p_actor_user_id,
        v_actor_role,
        p_remarks,
        jsonb_build_object(
            'actual_leave_end',
                p_return_to_site_date - 1,
            'successor_cycle_id',
                v_successor.id,
            'successor_cycle_number',
                v_successor.cycle_number,
            'site_in_trf_id',
                p_site_in_trf_id
        )
    ),
    (
        v_successor.id,
        v_successor.employee_id,
        'SUCCESSOR_CREATED',
        null,
        'ON_SITE',
        p_return_to_site_date,
        'SYSTEM',
        null,
        'SYSTEM',
        p_remarks,
        jsonb_build_object(
            'previous_cycle_id', v_cycle.id,
            'previous_cycle_number',
                v_cycle.cycle_number,
            'planned_site_out',
                v_successor.planned_site_out,
            'planned_leave_end',
                v_successor.planned_leave_end
        )
    );

    v_operation_key :=
        'AGE_ON_RETURN:'
        || v_cycle.id::text
        || ':'
        || p_return_to_site_date::text;

    insert into public.employee_os_operations (
        operation_key,
        operation_type,
        employee_id,
        requested_days,
        processed_days,
        reference_type,
        reference_id,
        reference_number,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        v_operation_key,
        'AGE_ON_RETURN',
        v_cycle.employee_id,
        0,
        0,
        'SITE_CYCLE',
        v_cycle.id,
        null,
        'USER',
        p_actor_user_id,
        v_actor_role,
        p_remarks,
        jsonb_build_object(
            'return_to_site_date',
                p_return_to_site_date,
            'successor_cycle_id',
                v_successor.id,
            'same_day_generated_os_excluded',
                true
        )
    )
    returning id
    into v_operation_id;

    for v_os in
        select os.*
        from public.employee_os_ledger os
        where os.employee_id = v_cycle.employee_id
          and os.status in (
              'AVAILABLE',
              'PARTIALLY_USED'
          )
          and os.remaining_days > 0
          and os.cycle_number between 0 and 3
          and os.generated_date
              < p_return_to_site_date
        order by
            os.generated_date,
            os.created_at,
            os.id
        for update
    loop
        v_after_cycle :=
            least(v_os.cycle_number + 1, 4);

        if v_after_cycle = 4 then
            v_after_status := 'EXPIRED';
            v_after_remaining := 0;
            v_after_expired :=
                v_os.expired_days
                + v_os.remaining_days;

            update public.employee_os_ledger
            set
                cycle_number = 4,
                status = 'EXPIRED',
                expired_days = v_after_expired,
                remaining_days = 0,
                expired_at = clock_timestamp(),
                updated_at = clock_timestamp()
            where id = v_os.id;

            v_expired_days_total :=
                v_expired_days_total
                + v_os.remaining_days;

            insert into public.employee_os_transactions (
                operation_id,
                os_ledger_id,
                employee_id,
                transaction_type,
                days,
                cycle_before,
                cycle_after,
                remaining_before,
                remaining_after,
                status_before,
                status_after,
                actor_type,
                actor_user_id,
                actor_role,
                remarks,
                metadata
            )
            values (
                v_operation_id,
                v_os.id,
                v_os.employee_id,
                'EXPIRED',
                v_os.remaining_days,
                v_os.cycle_number,
                4,
                v_os.remaining_days,
                0,
                v_os.status,
                'EXPIRED',
                'USER',
                p_actor_user_id,
                v_actor_role,
                p_remarks,
                jsonb_build_object(
                    'return_to_site_date',
                        p_return_to_site_date,
                    'site_cycle_id',
                        v_cycle.id
                )
            );
        else
            v_after_status := v_os.status;
            v_after_remaining :=
                v_os.remaining_days;
            v_after_expired :=
                v_os.expired_days;

            update public.employee_os_ledger
            set
                cycle_number = v_after_cycle,
                updated_at = clock_timestamp()
            where id = v_os.id;

            insert into public.employee_os_transactions (
                operation_id,
                os_ledger_id,
                employee_id,
                transaction_type,
                days,
                cycle_before,
                cycle_after,
                remaining_before,
                remaining_after,
                status_before,
                status_after,
                actor_type,
                actor_user_id,
                actor_role,
                remarks,
                metadata
            )
            values (
                v_operation_id,
                v_os.id,
                v_os.employee_id,
                'CYCLE_ADVANCED',
                0,
                v_os.cycle_number,
                v_after_cycle,
                v_os.remaining_days,
                v_os.remaining_days,
                v_os.status,
                v_os.status,
                'USER',
                p_actor_user_id,
                v_actor_role,
                p_remarks,
                jsonb_build_object(
                    'return_to_site_date',
                        p_return_to_site_date,
                    'site_cycle_id',
                        v_cycle.id
                )
            );
        end if;

        v_advanced_count :=
            v_advanced_count + 1;
    end loop;

    return query
    select
        v_cycle.id,
        v_successor.id,
        v_cycle.employee_id,
        p_return_to_site_date,
        'COMPLETED'::text,
        'ON_SITE'::text,
        v_advanced_count,
        v_expired_days_total,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_employee_os_fifo(p_actor_user_id uuid, p_employee_id uuid, p_requested_days integer, p_operation_key text, p_reference_type text, p_reference_id uuid DEFAULT NULL::uuid, p_reference_number text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(operation_id uuid, employee_id uuid, requested_days integer, processed_days integer, available_before integer, available_after integer, buckets_touched integer, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;

    v_existing_operation
        public.employee_os_operations%rowtype;
    v_operation_id uuid;

    v_available_before integer;
    v_available_after integer;
    v_remaining_request integer;
    v_processed integer := 0;
    v_buckets integer := 0;

    v_os record;
    v_take integer;
    v_after_remaining integer;
    v_after_status text;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if p_employee_id is null then
        raise exception
            'Employee ID wajib diisi.'
        using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.employees e
        where e.id = p_employee_id
          and coalesce(e.is_active, true) = true
    ) then
        raise exception
            'Employee tidak ditemukan atau tidak aktif.'
        using errcode = 'P0002';
    end if;

    if p_requested_days is null
       or p_requested_days <= 0 then
        raise exception
            'Requested OS days harus lebih dari 0.'
        using errcode = '22023';
    end if;

    if p_operation_key is null
       or trim(p_operation_key) = '' then
        raise exception
            'Operation key wajib diisi untuk idempotency.'
        using errcode = '22023';
    end if;

    if p_reference_type is null
       or trim(p_reference_type) = '' then
        raise exception
            'Reference type wajib diisi.'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'CONSUME_OS:'
            || p_employee_id::text
            || ':'
            || trim(p_operation_key),
            0
        )
    );

    select op.*
    into v_existing_operation
    from public.employee_os_operations op
    where op.operation_key = trim(p_operation_key);

    if found then
        if v_existing_operation.employee_id
           <> p_employee_id
           or v_existing_operation.operation_type
              <> 'CONSUME_FIFO'
           or v_existing_operation.requested_days
              <> p_requested_days then
            raise exception
                'Operation key sudah digunakan untuk payload yang berbeda.'
            using errcode = '23505';
        end if;

        select coalesce(sum(os.remaining_days), 0)
        into v_available_after
        from public.employee_os_ledger os
        where os.employee_id = p_employee_id
          and os.status in (
              'AVAILABLE',
              'PARTIALLY_USED'
          )
          and os.remaining_days > 0
          and os.cycle_number between 0 and 3;

        return query
        select
            v_existing_operation.id,
            p_employee_id,
            v_existing_operation.requested_days,
            v_existing_operation.processed_days,
            coalesce(
                (
                    v_existing_operation.metadata
                    ->> 'available_before'
                )::integer,
                v_existing_operation.processed_days
                + v_available_after
            ),
            v_available_after,
            (
                select count(*)::integer
                from public.employee_os_transactions tx
                where tx.operation_id =
                    v_existing_operation.id
                  and tx.transaction_type =
                    'CONSUMED'
            ),
            true;

        return;
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'EMPLOYEE_OS_BALANCE:'
            || p_employee_id::text,
            0
        )
    );

    select coalesce(sum(os.remaining_days), 0)
    into v_available_before
    from public.employee_os_ledger os
    where os.employee_id = p_employee_id
      and os.status in (
          'AVAILABLE',
          'PARTIALLY_USED'
      )
      and os.remaining_days > 0
      and os.cycle_number between 0 and 3;

    if v_available_before < p_requested_days then
        raise exception
            'Saldo OS tidak cukup. Available %, requested %.',
            v_available_before,
            p_requested_days
        using errcode = '22003';
    end if;

    insert into public.employee_os_operations (
        operation_key,
        operation_type,
        employee_id,
        requested_days,
        processed_days,
        reference_type,
        reference_id,
        reference_number,
        actor_type,
        actor_user_id,
        actor_role,
        remarks,
        metadata
    )
    values (
        trim(p_operation_key),
        'CONSUME_FIFO',
        p_employee_id,
        p_requested_days,
        0,
        trim(p_reference_type),
        p_reference_id,
        p_reference_number,
        'USER',
        p_actor_user_id,
        v_actor_role,
        p_remarks,
        jsonb_build_object(
            'available_before', v_available_before,
            'fifo_order',
                'generated_date, created_at, id'
        )
    )
    returning id
    into v_operation_id;

    v_remaining_request := p_requested_days;

    for v_os in
        select os.*
        from public.employee_os_ledger os
        where os.employee_id = p_employee_id
          and os.status in (
              'AVAILABLE',
              'PARTIALLY_USED'
          )
          and os.remaining_days > 0
          and os.cycle_number between 0 and 3
        order by
            os.generated_date,
            os.created_at,
            os.id
        for update
    loop
        exit when v_remaining_request = 0;

        v_take :=
            least(
                v_remaining_request,
                v_os.remaining_days
            );

        v_after_remaining :=
            v_os.remaining_days - v_take;

        v_after_status :=
            case
                when v_after_remaining = 0
                    then 'USED'
                else 'PARTIALLY_USED'
            end;

        update public.employee_os_ledger
        set
            remaining_days = v_after_remaining,
            status = v_after_status,
            updated_at = clock_timestamp()
        where id = v_os.id;

        insert into public.employee_os_transactions (
            operation_id,
            os_ledger_id,
            employee_id,
            transaction_type,
            days,
            cycle_before,
            cycle_after,
            remaining_before,
            remaining_after,
            status_before,
            status_after,
            actor_type,
            actor_user_id,
            actor_role,
            remarks,
            metadata
        )
        values (
            v_operation_id,
            v_os.id,
            v_os.employee_id,
            'CONSUMED',
            v_take,
            v_os.cycle_number,
            v_os.cycle_number,
            v_os.remaining_days,
            v_after_remaining,
            v_os.status,
            v_after_status,
            'USER',
            p_actor_user_id,
            v_actor_role,
            p_remarks,
            jsonb_build_object(
                'reference_type',
                    trim(p_reference_type),
                'reference_id',
                    p_reference_id,
                'reference_number',
                    p_reference_number,
                'fifo_position',
                    v_buckets + 1
            )
        );

        v_processed :=
            v_processed + v_take;

        v_remaining_request :=
            v_remaining_request - v_take;

        v_buckets :=
            v_buckets + 1;
    end loop;

    if v_remaining_request <> 0
       or v_processed <> p_requested_days then
        raise exception
            'FIFO consumption ended with unprocessed balance %.',
            v_remaining_request
        using errcode = '23514';
    end if;

    update public.employee_os_operations
    set
        processed_days = v_processed,
        metadata = metadata
            || jsonb_build_object(
                'available_after',
                    v_available_before
                    - v_processed,
                'buckets_touched',
                    v_buckets
            )
    where id = v_operation_id;

    v_available_after :=
        v_available_before - v_processed;

    return query
    select
        v_operation_id,
        p_employee_id,
        p_requested_days,
        v_processed,
        v_available_before,
        v_available_after,
        v_buckets,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_early_recall_request(p_actor_user_id uuid, p_employee_id uuid, p_approved_leave_start date, p_approved_leave_end date, p_proposed_return_date date, p_reason text, p_source_trf_id uuid DEFAULT NULL::uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, approved_leave_days integer, estimated_leave_days_used integer, estimated_unused_leave_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_employee public.employees%rowtype;
    v_source_trf public.trfs%rowtype;
    v_recall public.early_recall_requests%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('HOD', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan membuat Early Recall.',
            v_actor.role;
    end if;

    select e.*
    into v_employee
    from public.employees e
    where e.id = p_employee_id
      and coalesce(e.is_active, true) = true;

    if not found then
        raise exception 'Employee tidak ditemukan atau tidak aktif.';
    end if;

    if (
        v_actor.role = 'HOD'
        and (
            v_actor.department is null
            or v_actor.department <> v_employee.department
        )
    ) then
        raise exception
            'HOD hanya dapat membuat Early Recall untuk department sendiri.';
    end if;

    if p_approved_leave_end < p_approved_leave_start then
        raise exception
            'Approved Leave End tidak boleh lebih awal dari Approved Leave Start.';
    end if;

    if (
        p_proposed_return_date <= p_approved_leave_start
        or p_proposed_return_date > p_approved_leave_end
    ) then
        raise exception
            'Proposed Return Date harus setelah tanggal mulai cuti dan tidak melewati tanggal akhir cuti.';
    end if;

    if p_reason is null or trim(p_reason) = '' then
        raise exception 'Reason for Recall wajib diisi.';
    end if;

    if p_source_trf_id is not null then
        select t.*
        into v_source_trf
        from public.trfs t
        where t.id = p_source_trf_id;

        if not found then
            raise exception 'Source TRF tidak ditemukan.';
        end if;

        if v_source_trf.employee_id <> p_employee_id then
            raise exception
                'Source TRF tidak dimiliki oleh employee yang dipilih.';
        end if;

        if v_source_trf.status in ('REJECTED', 'NEEDS_REVISION') then
            raise exception
                'Source TRF berstatus % dan tidak dapat digunakan.',
                v_source_trf.status;
        end if;
    end if;

    insert into public.early_recall_requests (
        employee_id,
        department,
        source_trf_id,
        requested_by_user_id,
        request_source_role,
        approved_leave_start,
        approved_leave_end,
        proposed_return_date,
        reason,
        remarks,
        status
    )
    values (
        v_employee.id,
        v_employee.department,
        p_source_trf_id,
        v_actor.id,
        v_actor.role,
        p_approved_leave_start,
        p_approved_leave_end,
        p_proposed_return_date,
        trim(p_reason),
        nullif(trim(coalesce(p_remarks, '')), ''),
        'DRAFT'
    )
    returning *
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        null,
        'DRAFT',
        'USER',
        v_actor.id,
        v_actor.role,
        'Early Recall draft created.',
        jsonb_build_object(
            'employee_id', v_employee.id,
            'employee_code', v_employee.employee_code,
            'approved_leave_start', v_recall.approved_leave_start,
            'approved_leave_end', v_recall.approved_leave_end,
            'proposed_return_date', v_recall.proposed_return_date,
            'source_trf_id', v_recall.source_trf_id
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_recall.approved_leave_days,
        v_recall.estimated_leave_days_used,
        v_recall.estimated_unused_leave_days;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_employee_onboarding(p_actor_user_id uuid, p_operation_key text, p_employee_code text, p_employee_name text, p_employee_type text, p_email text, p_phone text, p_department text, p_section text, p_job_title text, p_join_date date, p_point_of_hire text, p_roster_code text, p_site_location_id uuid, p_planned_d1 date, p_password_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;

    v_employee public.employees%rowtype;
    v_user public.users%rowtype;
    v_roster public.roster_patterns%rowtype;
    v_site public.locations%rowtype;
    v_assignment public.employee_roster_assignments%rowtype;
    v_cycle public.employee_site_cycles%rowtype;

    v_existing_audit public.employee_management_audit%rowtype;

    v_operation_key text := nullif(btrim(p_operation_key), '');
    v_employee_code text := btrim(coalesce(p_employee_code, ''));
    v_employee_name text := btrim(coalesce(p_employee_name, ''));
    v_employee_type text := upper(btrim(coalesce(p_employee_type, '')));
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_phone text := btrim(coalesce(p_phone, ''));
    v_department text := btrim(coalesce(p_department, ''));
    v_section text := nullif(btrim(coalesce(p_section, '')), '');
    v_job_title text := btrim(coalesce(p_job_title, ''));
    v_point_of_hire text :=
        nullif(btrim(coalesce(p_point_of_hire, '')), '');

    v_result jsonb;
begin
    select actor.actor_role
    into v_actor_role
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if v_operation_key is null
       or length(v_operation_key) > 200 then
        raise exception
            'Operation key wajib diisi dan maksimal 200 karakter.'
        using errcode = '22023';
    end if;

    select audit_row.*
    into v_existing_audit
    from public.employee_management_audit audit_row
    where audit_row.operation_key = v_operation_key
      and audit_row.action = 'CREATE';

    if found then
        return v_existing_audit.after_data
            || jsonb_build_object('idempotent', true);
    end if;

    if v_employee_code !~ '^[0-9]{7}$' then
        raise exception
            'Employee ID wajib tepat 7 digit angka.'
        using errcode = '22023';
    end if;

    if v_employee_name = '' then
        raise exception 'Nama employee wajib diisi.'
        using errcode = '22023';
    end if;

    if v_employee_type not in ('EMPLOYEE', 'VISITOR') then
        raise exception
            'Employee Type harus EMPLOYEE atau VISITOR.'
        using errcode = '22023';
    end if;

    if v_email = ''
       or v_email !~
          '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
        raise exception 'Email employee tidak valid.'
        using errcode = '22023';
    end if;

    if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8 then
        raise exception
            'Nomor WhatsApp wajib diisi dan minimal 8 digit.'
        using errcode = '22023';
    end if;

    if v_department = '' then
        raise exception 'Department wajib dipilih.'
        using errcode = '22023';
    end if;

    if v_job_title = '' then
        raise exception 'Job Title wajib diisi.'
        using errcode = '22023';
    end if;

    if p_join_date is null then
        raise exception 'Date of Hire wajib diisi.'
        using errcode = '22023';
    end if;

    if p_planned_d1 is null then
        raise exception 'D1 wajib diisi.'
        using errcode = '22023';
    end if;

    if p_site_location_id is null then
        raise exception 'Site wajib dipilih.'
        using errcode = '22023';
    end if;

    if p_password_hash is null
       or length(btrim(p_password_hash)) < 20 then
        raise exception 'Password hash tidak valid.'
        using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.reference_master rm
        where rm.category = 'DEPARTMENT'
          and coalesce(rm.is_active, true) = true
          and rm.name = v_department
    ) then
        raise exception
            'Department % tidak tersedia pada master data.',
            v_department
        using errcode = '22023';
    end if;

    select roster_row.*
    into strict v_roster
    from public.roster_patterns roster_row
    where roster_row.code = p_roster_code
      and roster_row.code in (
            '4:2', '5:2', '6:2', '8:2', '10:2'
      )
      and coalesce(roster_row.is_active, true) = true;

    select site_row.*
    into strict v_site
    from public.locations site_row
    where site_row.id = p_site_location_id
      and site_row.type = 'SITE'
      and coalesce(site_row.is_active, true) = true;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'EMPLOYEE_ONBOARDING:' || v_employee_code,
            0
        )
    );

    if exists (
        select 1
        from public.employees e
        where e.employee_code = v_employee_code
    ) then
        raise exception
            'Employee ID % sudah terdaftar.',
            v_employee_code
        using errcode = '23505';
    end if;

    if exists (
        select 1
        from public.users u
        where lower(u.username) = lower(v_employee_code)
    ) then
        raise exception
            'Username % sudah digunakan.',
            v_employee_code
        using errcode = '23505';
    end if;

    if exists (
        select 1
        from public.users u
        where lower(u.email) = v_email
    )
       or exists (
        select 1
        from public.employees e
        where lower(e.email) = v_email
    ) then
        raise exception
            'Email % sudah digunakan.',
            v_email
        using errcode = '23505';
    end if;

    insert into public.employees (
        employee_code,
        employee_name,
        employee_type,
        email,
        phone,
        department,
        section,
        job_title,
        join_date,
        point_of_hire,
        is_active
    )
    values (
        v_employee_code,
        v_employee_name,
        v_employee_type,
        v_email,
        v_phone,
        v_department,
        coalesce(v_section, ''),
        v_job_title,
        p_join_date,
        coalesce(v_point_of_hire, ''),
        true
    )
    returning *
    into v_employee;

    insert into public.users (
        username,
        email,
        role,
        employee_id,
        department,
        password_hash,
        must_change_password,
        is_active
    )
    values (
        v_employee_code,
        v_email,
        'EMPLOYEE',
        v_employee.id,
        v_department,
        p_password_hash,
        true,
        true
    )
    returning *
    into v_user;

    update public.employees
    set user_id = v_user.id
    where id = v_employee.id
    returning *
    into v_employee;

    insert into public.employee_roster_assignments (
        employee_id,
        roster_pattern_id,
        effective_from,
        effective_to,
        source_type,
        source_reference,
        assigned_by_user_id,
        remarks
    )
    values (
        v_employee.id,
        v_roster.id,
        p_planned_d1,
        null,
        'HR_MANUAL',
        v_operation_key,
        p_actor_user_id,
        format(
            'Employee onboarding. Roster %s; site %s; planned D1 %s.',
            v_roster.code,
            v_site.name,
            p_planned_d1
        )
    )
    returning *
    into v_assignment;

    insert into public.employee_site_cycles (
        employee_id,
        roster_assignment_id,
        site_location_id,
        cycle_number,

        planned_site_in,
        planned_site_out,
        planned_leave_start,
        planned_leave_end,

        actual_site_in,
        actual_site_out,
        actual_leave_start,
        actual_leave_end,

        site_in_trf_id,
        site_out_trf_id,

        status,
        source_type,
        source_reference,
        created_by_user_id,
        remarks
    )
    values (
        v_employee.id,
        v_assignment.id,
        v_site.id,
        1,

        p_planned_d1,
        p_planned_d1 + v_roster.site_days,
        p_planned_d1 + v_roster.site_days,
        p_planned_d1
            + v_roster.site_days
            + v_roster.leave_days
            - 1,

        null,
        null,
        null,
        null,

        null,
        null,

        'PLANNED',
        'HR_MANUAL',
        v_operation_key,
        p_actor_user_id,
        'Created through Employee Onboarding. Actual Site In requires separate confirmation.'
    )
    returning *
    into v_cycle;

    v_result := jsonb_build_object(
        'idempotent', false,
        'employee',
            jsonb_build_object(
                'id', v_employee.id,
                'employee_code', v_employee.employee_code,
                'employee_name', v_employee.employee_name,
                'employee_type', v_employee.employee_type,
                'email', v_employee.email,
                'phone', v_employee.phone,
                'department', v_employee.department,
                'section', v_employee.section,
                'job_title', v_employee.job_title,
                'join_date', v_employee.join_date,
                'point_of_hire', v_employee.point_of_hire,
                'is_active', v_employee.is_active
            ),
        'user',
            jsonb_build_object(
                'id', v_user.id,
                'username', v_user.username,
                'email', v_user.email,
                'role', v_user.role,
                'is_active', v_user.is_active,
                'must_change_password',
                    v_user.must_change_password
            ),
        'roster_assignment',
            jsonb_build_object(
                'id', v_assignment.id,
                'roster_code', v_roster.code,
                'effective_from', v_assignment.effective_from,
                'effective_to', v_assignment.effective_to
            ),
        'site_cycle',
            jsonb_build_object(
                'id', v_cycle.id,
                'cycle_number', v_cycle.cycle_number,
                'status', v_cycle.status,
                'site_location_id', v_cycle.site_location_id,
                'site_name', v_site.name,
                'planned_site_in', v_cycle.planned_site_in,
                'planned_site_out', v_cycle.planned_site_out,
                'planned_leave_start',
                    v_cycle.planned_leave_start,
                'planned_leave_end',
                    v_cycle.planned_leave_end,
                'actual_site_in', v_cycle.actual_site_in
            ),
        'os_generated', false,
        'actual_movement_confirmed', false
    );

    insert into public.employee_management_audit (
        operation_key,
        action,
        employee_id,
        employee_code_snapshot,
        actor_user_id,
        before_data,
        after_data
    )
    values (
        v_operation_key,
        'CREATE',
        v_employee.id,
        v_employee.employee_code,
        p_actor_user_id,
        null,
        v_result
    );

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_trf_purpose_remarks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if not public.trf_purpose_remarks_are_complete(
        new.purpose_entries,
        new.purpose_remarks
    ) then
        raise exception
            'Remarks / Catatan wajib diisi pada setiap Travel Purpose.'
        using
            errcode = '23514',
            constraint =
                'trfs_travel_purpose_remarks_required';
    end if;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_early_recall_os(p_early_recall_id uuid)
 RETURNS TABLE(early_recall_id uuid, recall_number text, employee_id uuid, os_ledger_id uuid, os_number text, os_generated_days integer, cycle_number smallint, os_status text, already_generated boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_recall public.early_recall_requests%rowtype;
    v_ledger public.employee_os_ledger%rowtype;
begin
    -- --------------------------------------------------------
    -- 1. Ambil dan kunci data Early Recall.
    -- FOR UPDATE mencegah dua proses membentuk OS bersamaan.
    -- --------------------------------------------------------

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception
            'Early Recall dengan ID % tidak ditemukan.',
            p_early_recall_id
        using errcode = 'P0002';
    end if;


    -- --------------------------------------------------------
    -- 2. Idempotency.
    -- Jika OS sudah pernah dibuat, kembalikan bucket existing.
    -- --------------------------------------------------------

    if (
        v_recall.status = 'OS_GENERATED'
        and v_recall.os_ledger_id is not null
    ) then
        select os.*
        into v_ledger
        from public.employee_os_ledger os
        where os.id = v_recall.os_ledger_id;

        if not found then
            raise exception
                'Early Recall % berstatus OS_GENERATED tetapi OS Ledger tidak ditemukan.',
                v_recall.recall_number;
        end if;

        return query
        select
            v_recall.id,
            v_recall.recall_number,
            v_recall.employee_id,
            v_ledger.id,
            v_ledger.os_number,
            v_recall.os_generated_days,
            v_ledger.cycle_number,
            v_ledger.status,
            true;

        return;
    end if;


    -- --------------------------------------------------------
    -- 3. Validasi status workflow.
    -- --------------------------------------------------------

    if v_recall.status <> 'RETURNED_TO_SITE' then
        raise exception
            'Early Recall % belum berstatus RETURNED_TO_SITE. Status saat ini: %.',
            v_recall.recall_number,
            v_recall.status;
    end if;


    -- --------------------------------------------------------
    -- 4. Validasi HR.
    -- --------------------------------------------------------

    if (
        v_recall.hr_validated_by_user_id is null
        or v_recall.hr_validated_at is null
    ) then
        raise exception
            'Early Recall % belum divalidasi oleh HR.',
            v_recall.recall_number;
    end if;


    -- --------------------------------------------------------
    -- 5. Validasi PM.
    -- --------------------------------------------------------

    if (
        v_recall.pm_approved_by_user_id is null
        or v_recall.pm_approved_at is null
    ) then
        raise exception
            'Early Recall % belum disetujui oleh PM.',
            v_recall.recall_number;
    end if;


    -- --------------------------------------------------------
    -- 6. Validasi Actual Return.
    -- --------------------------------------------------------

    if v_recall.actual_return_date is null then
        raise exception
            'Actual Return Date Early Recall % belum diisi.',
            v_recall.recall_number;
    end if;

    if (
        v_recall.actual_return_confirmed_by_user_id is null
        or v_recall.actual_return_confirmed_at is null
    ) then
        raise exception
            'Actual Return Early Recall % belum dikonfirmasi.',
            v_recall.recall_number;
    end if;


    -- --------------------------------------------------------
    -- 7. Validasi sisa cuti.
    -- --------------------------------------------------------

    if (
        v_recall.unused_leave_days is null
        or v_recall.unused_leave_days <= 0
    ) then
        raise exception
            'Early Recall % tidak memiliki sisa cuti yang dapat dikonversi menjadi OS.',
            v_recall.recall_number;
    end if;


    -- --------------------------------------------------------
    -- 8. Guard terhadap ledger existing yang tidak sinkron.
    -- --------------------------------------------------------

    if exists (
        select 1
        from public.employee_os_ledger os
        where os.early_recall_id = v_recall.id
    ) then
        raise exception
            'OS Ledger untuk Early Recall % sudah tersedia tetapi belum terhubung dengan benar.',
            v_recall.recall_number;
    end if;


    -- --------------------------------------------------------
    -- 9. Bentuk OS Ledger.
    -- Early Recall menggunakan konversi 1:1.
    -- --------------------------------------------------------

    insert into public.employee_os_ledger (
        employee_id,
        source_type,
        early_recall_id,
        source_reference,
        generated_date,
        original_days,
        remaining_days,
        expired_days,
        cancelled_days,
        cycle_number,
        status,
        created_by_type,
        created_by_user_id,
        remarks,
        source_metadata
    )
    values (
        v_recall.employee_id,
        'EARLY_RECALL',
        v_recall.id,
        v_recall.recall_number,
        v_recall.actual_return_date,
        v_recall.unused_leave_days,
        v_recall.unused_leave_days,
        0,
        0,
        0,
        'AVAILABLE',
        'SYSTEM',
        null,
        'OS generated automatically from Early Recall.',
        jsonb_build_object(
            'recall_number',
            v_recall.recall_number,
            'approved_leave_start',
            v_recall.approved_leave_start,
            'approved_leave_end',
            v_recall.approved_leave_end,
            'approved_leave_days',
            v_recall.approved_leave_days,
            'actual_return_date',
            v_recall.actual_return_date,
            'actual_leave_days_used',
            v_recall.actual_leave_days_used,
            'unused_leave_days',
            v_recall.unused_leave_days,
            'conversion_rule',
            'EARLY_RECALL_1_TO_1'
        )
    )
    returning *
    into v_ledger;


    -- --------------------------------------------------------
    -- 10. Update Early Recall.
    -- --------------------------------------------------------

    update public.early_recall_requests er
    set
        os_ledger_id = v_ledger.id,
        os_generated_days = v_recall.unused_leave_days,
        os_generated_at = now(),
        status = 'OS_GENERATED'
    where er.id = v_recall.id
    returning er.*
    into v_recall;


    -- --------------------------------------------------------
    -- 11. Catat audit history.
    -- --------------------------------------------------------

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        'RETURNED_TO_SITE',
        'OS_GENERATED',
        'SYSTEM',
        null,
        'SYSTEM',
        'OS Early Recall generated automatically.',
        jsonb_build_object(
            'os_ledger_id',
            v_ledger.id,
            'os_number',
            v_ledger.os_number,
            'os_generated_days',
            v_recall.os_generated_days,
            'cycle_number',
            v_ledger.cycle_number,
            'source_type',
            v_ledger.source_type,
            'actual_return_confirmed_by_user_id',
            v_recall.actual_return_confirmed_by_user_id,
            'actual_return_confirmed_at',
            v_recall.actual_return_confirmed_at
        )
    );


    -- --------------------------------------------------------
    -- 12. Return hasil.
    -- --------------------------------------------------------

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.employee_id,
        v_ledger.id,
        v_ledger.os_number,
        v_recall.os_generated_days,
        v_ledger.cycle_number,
        v_ledger.status,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_trf_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.trf_number IS NULL THEN
        NEW.trf_number := 'TRF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_employee_management_master_data(p_actor_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_result jsonb;
begin
    perform 1
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    );

    select jsonb_build_object(
        'departments',
            coalesce(
                (
                    select jsonb_agg(
                        rm.name
                        order by rm.name
                    )
                    from (
                        select distinct btrim(master.name) as name
                        from public.reference_master master
                        where master.category = 'DEPARTMENT'
                          and coalesce(master.is_active, true) = true
                          and nullif(btrim(master.name), '') is not null
                    ) rm
                ),
                '[]'::jsonb
            ),

        'rosters',
            coalesce(
                (
                    select jsonb_agg(
                        jsonb_build_object(
                            'id', p.id,
                            'code', p.code,
                            'name', p.name,
                            'site_days', p.site_days,
                            'leave_days', p.leave_days
                        )
                        order by
                            array_position(
                                array['4:2', '5:2', '6:2', '8:2', '10:2'],
                                p.code
                            )
                    )
                    from public.roster_patterns p
                    where p.code in (
                        '4:2', '5:2', '6:2', '8:2', '10:2'
                    )
                      and coalesce(p.is_active, true) = true
                ),
                '[]'::jsonb
            ),

        'sites',
            coalesce(
                (
                    select jsonb_agg(
                        jsonb_build_object(
                            'id', l.id,
                            'name', l.name,
                            'type', l.type
                        )
                        order by l.name
                    )
                    from public.locations l
                    where l.type = 'SITE'
                      and coalesce(l.is_active, true) = true
                ),
                '[]'::jsonb
            ),

        'employee_types',
            jsonb_build_array('EMPLOYEE', 'VISITOR')
    )
    into v_result;

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_manpower_dashboard_snapshot(p_actor_user_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;
    v_as_of_date date := coalesce(p_as_of_date, current_date);
    v_result jsonb;
begin
    if p_actor_user_id is null then
        raise exception 'Actor user ID wajib diisi.'
        using errcode = '22023';
    end if;

    select
        u.role,
        nullif(btrim(u.department), '')
    into
        v_actor_role,
        v_actor_department
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Akun actor tidak ditemukan atau tidak aktif.'
        using errcode = '42501';
    end if;

    if v_actor_role not in (
        'HOD',
        'HR',
        'PM',
        'SUPER_ADMIN'
    ) then
        raise exception
            'Role % tidak memiliki akses ke Manpower Dashboard.',
            v_actor_role
        using errcode = '42501';
    end if;

    if v_actor_role = 'HOD'
       and v_actor_department is null then
        raise exception
            'Department akun HOD belum ditentukan.'
        using errcode = '22023';
    end if;

    if v_as_of_date > current_date then
        raise exception
            'As of Date tidak boleh melebihi tanggal hari ini.'
        using errcode = '22023';
    end if;

    with
    scoped_employees as (
        select
            e.id as employee_id,
            e.employee_code,
            e.employee_name,
            coalesce(
                department_master.department_name,
                nullif(btrim(e.department), '')
            ) as department,
            nullif(btrim(e.job_title), '') as job_title,
            nullif(btrim(e.point_of_hire), '') as point_of_hire
        from public.employees e
        left join lateral (
            select btrim(rm.name) as department_name
            from public.reference_master rm
            where rm.category = 'DEPARTMENT'
              and coalesce(rm.is_active, true) = true
              and lower(btrim(rm.name))
                  = lower(btrim(coalesce(e.department, '')))
            order by rm.id
            limit 1
        ) department_master
          on true
        where coalesce(e.is_active, true) = true
          and coalesce(e.employee_type, 'EMPLOYEE') = 'EMPLOYEE'
          and (
                v_actor_role <> 'HOD'
                or lower(btrim(coalesce(e.department, '')))
                   = lower(btrim(v_actor_department))
              )
    ),

    cycle_candidates as (
        select
            e.employee_id,
            e.employee_code,
            e.employee_name,
            e.department,
            e.job_title,
            e.point_of_hire,

            c.id as site_cycle_id,
            c.cycle_number,
            c.status as cycle_status,

            c.planned_site_in,
            c.planned_site_out,
            c.actual_site_in,
            c.actual_site_out,

            c.planned_leave_start,
            c.planned_leave_end,
            c.actual_leave_start,
            c.actual_leave_end,

            case
                when c.actual_site_in is not null
                 and c.actual_site_in <= v_as_of_date
                 and (
                        c.actual_site_out is null
                        or v_as_of_date < c.actual_site_out
                     )
                    then 'ONSITE'

                when c.actual_site_out is not null
                 and c.actual_site_out <= v_as_of_date
                 and (
                        c.actual_leave_end is null
                        or v_as_of_date <= c.actual_leave_end
                     )
                    then 'FIELD_BREAK'

                else null
            end as manpower_status,

            row_number() over (
                partition by e.employee_id
                order by
                    greatest(
                        coalesce(c.actual_site_in, date '-infinity'),
                        coalesce(c.actual_site_out, date '-infinity'),
                        coalesce(c.actual_leave_start, date '-infinity'),
                        coalesce(c.actual_leave_end, date '-infinity')
                    ) desc,
                    c.cycle_number desc nulls last,
                    c.created_at desc nulls last,
                    c.id desc nulls last
            ) as candidate_rank

        from scoped_employees e
        join public.employee_site_cycles c
          on c.employee_id = e.employee_id
        where coalesce(c.status, '') <> 'CANCELLED'
          and (
                (
                    c.actual_site_in is not null
                    and c.actual_site_in <= v_as_of_date
                    and (
                        c.actual_site_out is null
                        or v_as_of_date < c.actual_site_out
                    )
                )
                or
                (
                    c.actual_site_out is not null
                    and c.actual_site_out <= v_as_of_date
                    and (
                        c.actual_leave_end is null
                        or v_as_of_date <= c.actual_leave_end
                    )
                )
              )
    ),

    candidate_counts as (
        select
            c.employee_id,
            count(*)::integer as matching_interval_count
        from cycle_candidates c
        group by c.employee_id
    ),

    selected_candidate as (
        select c.*
        from cycle_candidates c
        where c.candidate_rank = 1
    ),

    latest_cycle as (
        select distinct on (c.employee_id)
            c.employee_id,
            c.id as site_cycle_id,
            c.cycle_number,
            c.status as cycle_status,
            c.planned_site_in,
            c.planned_site_out,
            c.actual_site_in,
            c.actual_site_out,
            c.planned_leave_start,
            c.planned_leave_end,
            c.actual_leave_start,
            c.actual_leave_end
        from public.employee_site_cycles c
        join scoped_employees e
          on e.employee_id = c.employee_id
        where coalesce(c.status, '') <> 'CANCELLED'
        order by
            c.employee_id,
            c.cycle_number desc nulls last,
            c.created_at desc nulls last,
            c.id desc
    ),

    employee_snapshot as (
        select
            e.employee_id,
            e.employee_code,
            e.employee_name,
            e.department,
            e.job_title,
            e.point_of_hire,

            coalesce(
                sc.site_cycle_id,
                lc.site_cycle_id
            ) as site_cycle_id,

            coalesce(
                sc.cycle_number,
                lc.cycle_number
            ) as cycle_number,

            coalesce(
                sc.cycle_status,
                lc.cycle_status
            ) as cycle_status,

            coalesce(cc.matching_interval_count, 0)
                as matching_interval_count,

            case
                when coalesce(cc.matching_interval_count, 0) = 1
                    then sc.manpower_status
                else 'UNCLASSIFIED'
            end as manpower_status,

            case
                when coalesce(cc.matching_interval_count, 0) > 1
                    then 'MULTIPLE_MATCHING_INTERVALS'
                when coalesce(cc.matching_interval_count, 0) = 0
                 and lc.site_cycle_id is null
                    then 'NO_SITE_CYCLE'
                when coalesce(cc.matching_interval_count, 0) = 0
                 and lc.actual_site_in is null
                    then 'ACTUAL_SITE_IN_NOT_CONFIRMED'
                when coalesce(cc.matching_interval_count, 0) = 0
                    then 'NO_ACTUAL_INTERVAL_FOR_DATE'
                else null
            end as unclassified_reason,

            case
                when coalesce(cc.matching_interval_count, 0) = 1
                 and sc.manpower_status = 'FIELD_BREAK'
                    then sc.actual_site_out
                else null
            end as travel_out,

            case
                when coalesce(cc.matching_interval_count, 0) = 1
                 and sc.manpower_status = 'FIELD_BREAK'
                    then coalesce(
                        sc.actual_leave_end + 1,
                        sc.planned_leave_end + 1
                    )
                else null
            end as travel_in,

            case
                when coalesce(cc.matching_interval_count, 0) = 1
                 and sc.manpower_status = 'FIELD_BREAK'
                 and sc.actual_leave_end is not null
                    then 'ACTUAL'
                when coalesce(cc.matching_interval_count, 0) = 1
                 and sc.manpower_status = 'FIELD_BREAK'
                 and sc.planned_leave_end is not null
                    then 'PLANNED'
                else null
            end as travel_in_source,

            coalesce(
                sc.planned_site_in,
                lc.planned_site_in
            ) as planned_site_in,

            coalesce(
                sc.planned_site_out,
                lc.planned_site_out
            ) as planned_site_out,

            coalesce(
                sc.actual_site_in,
                lc.actual_site_in
            ) as actual_site_in,

            coalesce(
                sc.actual_site_out,
                lc.actual_site_out
            ) as actual_site_out,

            coalesce(
                sc.planned_leave_start,
                lc.planned_leave_start
            ) as planned_leave_start,

            coalesce(
                sc.planned_leave_end,
                lc.planned_leave_end
            ) as planned_leave_end,

            coalesce(
                sc.actual_leave_start,
                lc.actual_leave_start
            ) as actual_leave_start,

            coalesce(
                sc.actual_leave_end,
                lc.actual_leave_end
            ) as actual_leave_end

        from scoped_employees e
        left join candidate_counts cc
          on cc.employee_id = e.employee_id
        left join selected_candidate sc
          on sc.employee_id = e.employee_id
        left join latest_cycle lc
          on lc.employee_id = e.employee_id
    ),

    classified_employees as (
        select s.*
        from employee_snapshot s
        where s.manpower_status in (
            'ONSITE',
            'FIELD_BREAK'
        )
    ),

    department_summary as (
        select
            coalesce(
                s.department,
                'UNASSIGNED'
            ) as department,

            count(*) filter (
                where s.manpower_status = 'ONSITE'
            )::integer as onsite,

            count(*) filter (
                where s.manpower_status = 'FIELD_BREAK'
            )::integer as field_break,

            count(*)::integer as total

        from classified_employees s
        group by
            coalesce(
                s.department,
                'UNASSIGNED'
            )
    ),

    summary as (
        select
            count(*) filter (
                where s.manpower_status = 'ONSITE'
            )::integer as onsite,

            count(*) filter (
                where s.manpower_status = 'FIELD_BREAK'
            )::integer as field_break,

            count(*) filter (
                where s.manpower_status in (
                    'ONSITE',
                    'FIELD_BREAK'
                )
            )::integer as classified_total,

            count(*) filter (
                where s.manpower_status = 'UNCLASSIFIED'
            )::integer as unclassified,

            count(*)::integer as active_employee_total
        from employee_snapshot s
    ),

    data_quality as (
        select
            count(*) filter (
                where s.matching_interval_count > 1
            )::integer as duplicate_interval_employee_count,

            count(*) filter (
                where s.point_of_hire is null
            )::integer as missing_point_of_hire_count,

            count(*) filter (
                where s.department is null
            )::integer as missing_department_count,

            count(*) filter (
                where s.manpower_status = 'UNCLASSIFIED'
            )::integer as unclassified_count
        from employee_snapshot s
    )

    select jsonb_build_object(
        'as_of_date',
            v_as_of_date,

        'generated_at',
            now(),

        'scope',
            jsonb_build_object(
                'role', v_actor_role,
                'department',
                    case
                        when v_actor_role = 'HOD'
                            then v_actor_department
                        else null
                    end,
                'visibility',
                    case
                        when v_actor_role = 'HOD'
                            then 'OWN_DEPARTMENT_ONLY'
                        else 'ALL_DEPARTMENTS'
                    end
            ),

        'summary',
            (
                select jsonb_build_object(
                    'onsite', s.onsite,
                    'field_break', s.field_break,
                    'classified_total', s.classified_total,
                    'unclassified', s.unclassified,
                    'active_employee_total',
                        s.active_employee_total
                )
                from summary s
            ),

        'departments',
            coalesce(
                (
                    select jsonb_agg(
                        jsonb_build_object(
                            'department', d.department,
                            'onsite', d.onsite,
                            'field_break', d.field_break,
                            'total', d.total
                        )
                        order by
                            d.total desc,
                            d.department
                    )
                    from department_summary d
                ),
                '[]'::jsonb
            ),

        'employees',
            coalesce(
                (
                    select jsonb_agg(
                        jsonb_build_object(
                            'employee_id', e.employee_id,
                            'employee_code', e.employee_code,
                            'employee_name', e.employee_name,
                            'department', e.department,
                            'job_title', e.job_title,
                            'point_of_hire', e.point_of_hire,
                            'status', e.manpower_status,
                            'travel_out', e.travel_out,
                            'travel_in', e.travel_in,
                            'travel_in_source',
                                e.travel_in_source,
                            'remarks',
                                case e.manpower_status
                                    when 'ONSITE' then 'Onsite'
                                    when 'FIELD_BREAK' then 'Field Break'
                                end,
                            'site_cycle_id', e.site_cycle_id,
                            'cycle_number', e.cycle_number,
                            'cycle_status', e.cycle_status
                        )
                        order by
                            case e.manpower_status
                                when 'FIELD_BREAK' then 1
                                else 2
                            end,
                            e.department,
                            e.employee_name,
                            e.employee_code
                    )
                    from classified_employees e
                ),
                '[]'::jsonb
            ),

        'data_quality',
            jsonb_build_object(
                'duplicate_interval_employee_count',
                    (
                        select q.duplicate_interval_employee_count
                        from data_quality q
                    ),
                'missing_point_of_hire_count',
                    (
                        select q.missing_point_of_hire_count
                        from data_quality q
                    ),
                'missing_department_count',
                    (
                        select q.missing_department_count
                        from data_quality q
                    ),
                'unclassified_count',
                    (
                        select q.unclassified_count
                        from data_quality q
                    ),
                'unclassified_employees',
                    coalesce(
                        (
                            select jsonb_agg(
                                jsonb_build_object(
                                    'employee_id', e.employee_id,
                                    'employee_code', e.employee_code,
                                    'employee_name', e.employee_name,
                                    'department', e.department,
                                    'point_of_hire', e.point_of_hire,
                                    'reason', e.unclassified_reason,
                                    'matching_interval_count',
                                        e.matching_interval_count,
                                    'cycle_number', e.cycle_number,
                                    'cycle_status', e.cycle_status,
                                    'planned_site_in',
                                        e.planned_site_in,
                                    'planned_site_out',
                                        e.planned_site_out,
                                    'actual_site_in',
                                        e.actual_site_in,
                                    'actual_site_out',
                                        e.actual_site_out,
                                    'planned_leave_start',
                                        e.planned_leave_start,
                                    'planned_leave_end',
                                        e.planned_leave_end,
                                    'actual_leave_start',
                                        e.actual_leave_start,
                                    'actual_leave_end',
                                        e.actual_leave_end
                                )
                                order by
                                    e.department,
                                    e.employee_name,
                                    e.employee_code
                            )
                            from employee_snapshot e
                            where e.manpower_status = 'UNCLASSIFIED'
                        ),
                        '[]'::jsonb
                    )
            ),

        'classification_rules',
            jsonb_build_object(
                'onsite',
                    'Actual Site In is effective and Actual Site Out is not yet effective.',
                'field_break',
                    'Actual Site Out is effective and Return to Site is not yet effective.',
                'unclassified',
                    'No unique confirmed actual interval covers the selected date.'
            )
    )
    into v_result;

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_roster_os_summary(p_actor_user_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_user public.users%rowtype;
    v_employee public.employees%rowtype;

    v_assignment_count integer := 0;
    v_assignment public.employee_roster_assignments%rowtype;
    v_pattern public.roster_patterns%rowtype;

    v_cycle_count integer := 0;
    v_cycle public.employee_site_cycles%rowtype;

    v_effective_site_in date;
    v_site_day_number integer;
    v_completed_site_days integer;
    v_days_until_site_out integer;
    v_overstay_days integer;
    v_progress_percent numeric(7,2);

    v_total_available_os integer := 0;
    v_active_os_bucket_count integer := 0;
    v_active_os_buckets jsonb := '[]'::jsonb;
    v_recent_os_history jsonb := '[]'::jsonb;
    v_cycle_history jsonb := '[]'::jsonb;

    v_roster_json jsonb;
    v_current_cycle_json jsonb;
begin
    if p_actor_user_id is null then
        raise exception
            'Actor user ID wajib diisi.'
        using errcode = '22023';
    end if;

    if p_as_of_date is null then
        raise exception
            'As-of date wajib diisi.'
        using errcode = '22023';
    end if;

    select u.*
    into v_user
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception
            'User tidak ditemukan atau tidak aktif.'
        using errcode = 'P0002';
    end if;

    if v_user.role <> 'EMPLOYEE' then
        raise exception
            'Hanya akun EMPLOYEE yang dapat membuka My Roster & OS.'
        using errcode = '42501';
    end if;

    if v_user.employee_id is null then
        raise exception
            'Akun EMPLOYEE belum terhubung ke master employee.'
        using errcode = 'P0002';
    end if;

    select e.*
    into v_employee
    from public.employees e
    where e.id = v_user.employee_id
      and coalesce(e.is_active, true) = true;

    if not found then
        raise exception
            'Master employee tidak ditemukan atau tidak aktif.'
        using errcode = 'P0002';
    end if;

    select count(*)
    into v_assignment_count
    from public.employee_roster_assignments a
    where a.employee_id = v_employee.id
      and a.effective_to is null;

    if v_assignment_count > 1 then
        raise exception
            'Ditemukan % active roster assignments. Hubungi HR.',
            v_assignment_count
        using errcode = '23514';
    end if;

    if v_assignment_count = 1 then
        select a.*
        into strict v_assignment
        from public.employee_roster_assignments a
        where a.employee_id = v_employee.id
          and a.effective_to is null;

        select p.*
        into strict v_pattern
        from public.roster_patterns p
        where p.id = v_assignment.roster_pattern_id;
    end if;

    select count(*)
    into v_cycle_count
    from public.employee_site_cycles c
    where c.employee_id = v_employee.id
      and c.status in (
          'PLANNED',
          'ON_SITE',
          'TRAVEL_OUT_PENDING',
          'ON_LEAVE'
      );

    if v_cycle_count > 1 then
        raise exception
            'Ditemukan % active site cycles. Hubungi HR.',
            v_cycle_count
        using errcode = '23514';
    end if;

    if v_cycle_count = 1 then
        select c.*
        into strict v_cycle
        from public.employee_site_cycles c
        where c.employee_id = v_employee.id
          and c.status in (
              'PLANNED',
              'ON_SITE',
              'TRAVEL_OUT_PENDING',
              'ON_LEAVE'
          );

        v_effective_site_in :=
            coalesce(
                v_cycle.actual_site_in,
                v_cycle.planned_site_in
            );

        v_site_day_number :=
            case
                when v_cycle.status = 'ON_SITE'
                 and v_effective_site_in is not null
                 and p_as_of_date >= v_effective_site_in
                    then
                        p_as_of_date
                        - v_effective_site_in
                        + 1
                else 0
            end;

        v_completed_site_days :=
            case
                when v_cycle.actual_site_out is not null
                 and v_effective_site_in is not null
                    then greatest(
                        v_cycle.actual_site_out
                        - v_effective_site_in,
                        0
                    )
                else 0
            end;

        v_days_until_site_out :=
            case
                when v_cycle.status = 'ON_SITE'
                 and v_cycle.planned_site_out is not null
                 and v_cycle.planned_site_out >= p_as_of_date
                    then
                        v_cycle.planned_site_out
                        - p_as_of_date
                else 0
            end;

        v_overstay_days :=
            case
                when v_cycle.status = 'ON_SITE'
                 and v_cycle.actual_site_out is null
                 and v_cycle.planned_site_out < p_as_of_date
                    then
                        p_as_of_date
                        - v_cycle.planned_site_out
                else 0
            end;

        v_progress_percent :=
            case
                when v_cycle.status = 'ON_SITE'
                 and v_pattern.site_days > 0
                    then least(
                        round(
                            (
                                v_site_day_number::numeric
                                / v_pattern.site_days::numeric
                            ) * 100,
                            2
                        ),
                        100
                    )
                else 0
            end;
    end if;

    select
        coalesce(sum(os.remaining_days), 0)::integer,
        count(*)::integer,
        coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'id', os.id,
                    'os_number', os.os_number,
                    'source_type', os.source_type,
                    'source_reference', os.source_reference,
                    'generated_date', os.generated_date,
                    'original_days', os.original_days,
                    'remaining_days', os.remaining_days,
                    'used_days', os.used_days,
                    'cycle_number', os.cycle_number,
                    'status', os.status,
                    'remarks', os.remarks
                )
                order by
                    os.generated_date,
                    os.created_at,
                    os.id
            ),
            '[]'::jsonb
        )
    into
        v_total_available_os,
        v_active_os_bucket_count,
        v_active_os_buckets
    from public.employee_os_ledger os
    where os.employee_id = v_employee.id
      and os.status in (
          'AVAILABLE',
          'PARTIALLY_USED'
      )
      and os.remaining_days > 0
      and os.cycle_number between 0 and 3;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', recent.id,
                'os_number', recent.os_number,
                'source_type', recent.source_type,
                'generated_date', recent.generated_date,
                'original_days', recent.original_days,
                'remaining_days', recent.remaining_days,
                'used_days', recent.used_days,
                'expired_days', recent.expired_days,
                'cancelled_days', recent.cancelled_days,
                'cycle_number', recent.cycle_number,
                'status', recent.status,
                'remarks', recent.remarks
            )
            order by
                recent.generated_date desc,
                recent.created_at desc
        ),
        '[]'::jsonb
    )
    into v_recent_os_history
    from (
        select os.*
        from public.employee_os_ledger os
        where os.employee_id = v_employee.id
        order by
            os.generated_date desc,
            os.created_at desc
        limit 10
    ) recent;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', history.id,
                'cycle_number', history.cycle_number,
                'status', history.status,
                'planned_site_in', history.planned_site_in,
                'planned_site_out', history.planned_site_out,
                'actual_site_in', history.actual_site_in,
                'actual_site_out', history.actual_site_out,
                'planned_leave_start', history.planned_leave_start,
                'planned_leave_end', history.planned_leave_end,
                'actual_leave_start', history.actual_leave_start,
                'actual_leave_end', history.actual_leave_end,
                'planned_site_days', history.planned_site_days,
                'actual_site_days', history.actual_site_days,
                'planned_leave_days', history.planned_leave_days,
                'actual_leave_days', history.actual_leave_days,
                'source_type', history.source_type,
                'source_reference', history.source_reference
            )
            order by history.cycle_number desc
        ),
        '[]'::jsonb
    )
    into v_cycle_history
    from (
        select c.*
        from public.employee_site_cycles c
        where c.employee_id = v_employee.id
        order by c.cycle_number desc
        limit 8
    ) history;

    v_roster_json :=
        case
            when v_assignment_count = 1 then
                jsonb_build_object(
                    'assignment_id', v_assignment.id,
                    'roster_pattern_id', v_pattern.id,
                    'roster_code', v_pattern.code,
                    'site_days', v_pattern.site_days,
                    'leave_days', v_pattern.leave_days,
                    'effective_from', v_assignment.effective_from,
                    'effective_to', v_assignment.effective_to,
                    'source_type', v_assignment.source_type,
                    'source_reference', v_assignment.source_reference
                )
            else null
        end;

    v_current_cycle_json :=
        case
            when v_cycle_count = 1 then
                jsonb_build_object(
                    'id', v_cycle.id,
                    'cycle_number', v_cycle.cycle_number,
                    'status', v_cycle.status,

                    'planned_site_in', v_cycle.planned_site_in,
                    'planned_site_out', v_cycle.planned_site_out,
                    'actual_site_in', v_cycle.actual_site_in,
                    'actual_site_out', v_cycle.actual_site_out,

                    'planned_leave_start', v_cycle.planned_leave_start,
                    'planned_leave_end', v_cycle.planned_leave_end,
                    'actual_leave_start', v_cycle.actual_leave_start,
                    'actual_leave_end', v_cycle.actual_leave_end,

                    'site_day_number', v_site_day_number,
                    'completed_site_days', v_completed_site_days,
                    'days_until_site_out', v_days_until_site_out,
                    'overstay_days', v_overstay_days,
                    'progress_percent', v_progress_percent,

                    'source_type', v_cycle.source_type,
                    'source_reference', v_cycle.source_reference
                )
            else null
        end;

    return jsonb_build_object(
        'success', true,
        'as_of_date', p_as_of_date,

        'employee', jsonb_build_object(
            'id', v_employee.id,
            'employee_code', v_employee.employee_code,
            'employee_name', v_employee.employee_name,
            'department', v_employee.department,
            'job_title', v_employee.job_title
        ),

        'roster', v_roster_json,
        'current_cycle', v_current_cycle_json,

        'os_summary', jsonb_build_object(
            'has_available_os', v_total_available_os > 0,
            'total_available_days', v_total_available_os,
            'active_bucket_count', v_active_os_bucket_count
        ),

        'active_os_buckets', v_active_os_buckets,
        'recent_os_history', v_recent_os_history,
        'cycle_history', v_cycle_history,

        'data_quality', jsonb_build_object(
            'employee_mapping_ready', true,
            'active_roster_assignment_count', v_assignment_count,
            'active_site_cycle_count', v_cycle_count,
            'has_active_roster', v_assignment_count = 1,
            'has_active_cycle', v_cycle_count = 1
        )
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_roster_attention_queue(p_actor_user_id uuid, p_as_of_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(action_code text, priority integer, employee_id uuid, employee_code text, employee_name text, department text, roster_code text, site_cycle_id uuid, cycle_number integer, cycle_status text, planned_site_in date, planned_site_out date, actual_site_in date, actual_site_out date, planned_leave_start date, planned_leave_end date, actual_leave_start date, actual_leave_end date, days_overdue integer, potential_extra_site_days integer, projected_os_days integer, source_reference text, remarks text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;
begin
    select
        actor.actor_role,
        actor.actor_department
    into
        v_actor_role,
        v_actor_department
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['GA', 'HOD', 'HR', 'SUPER_ADMIN']::text[]
    ) actor;

    if p_as_of_date is null then
        raise exception
            'As-of date wajib diisi.'
        using errcode = '22023';
    end if;

    return query
    with queue_source as (
        select
            case
                when c.status = 'ON_LEAVE'
                 and c.actual_leave_end is null
                 and c.planned_leave_end < p_as_of_date
                    then 'RETURN_TO_SITE_CONFIRMATION_REQUIRED'

                when c.status = 'TRAVEL_OUT_PENDING'
                 and c.actual_site_out is not null
                 and c.actual_leave_start is null
                    then 'TRAVEL_OUT_CONFIRMATION_REQUIRED'

                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out < p_as_of_date
                    then 'POTENTIAL_OVERSTAY'

                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out = p_as_of_date
                    then 'SITE_OUT_DUE_TODAY'

                else null
            end as action_code,

            case
                when c.status = 'ON_LEAVE'
                 and c.actual_leave_end is null
                 and c.planned_leave_end < p_as_of_date
                    then 1

                when c.status = 'TRAVEL_OUT_PENDING'
                 and c.actual_site_out is not null
                 and c.actual_leave_start is null
                    then 2

                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out < p_as_of_date
                    then 3

                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out = p_as_of_date
                    then 4

                else 99
            end as priority,

            e.id as employee_id,
            e.employee_code,
            e.employee_name,
            e.department,

            p.code as roster_code,

            c.id as site_cycle_id,
            c.cycle_number,
            c.status as cycle_status,

            c.planned_site_in,
            c.planned_site_out,
            c.actual_site_in,
            c.actual_site_out,

            c.planned_leave_start,
            c.planned_leave_end,
            c.actual_leave_start,
            c.actual_leave_end,

            case
                when c.status = 'ON_LEAVE'
                 and c.actual_leave_end is null
                 and c.planned_leave_end < p_as_of_date
                    then p_as_of_date - c.planned_leave_end

                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out < p_as_of_date
                    then p_as_of_date - c.planned_site_out

                else 0
            end::integer as days_overdue,

            case
                when c.status = 'ON_SITE'
                 and c.actual_site_out is null
                 and c.planned_site_out < p_as_of_date
                    then p_as_of_date - c.planned_site_out

                else 0
            end::integer as potential_extra_site_days,

            c.source_reference,
            c.remarks
        from public.employee_site_cycles c
        join public.employees e
          on e.id = c.employee_id
         and coalesce(e.is_active, true) = true
        join public.employee_roster_assignments a
          on a.id = c.roster_assignment_id
         and a.effective_to is null
        join public.roster_patterns p
          on p.id = a.roster_pattern_id
         and coalesce(p.is_active, true) = true
        where c.status in (
            'ON_SITE',
            'TRAVEL_OUT_PENDING',
            'ON_LEAVE'
        )
          and (
                v_actor_role <> 'HOD'
                or lower(btrim(e.department))
                   = lower(btrim(v_actor_department))
              )
    )
    select
        q.action_code,
        q.priority,

        q.employee_id,
        q.employee_code,
        q.employee_name,
        q.department,

        q.roster_code,

        q.site_cycle_id,
        q.cycle_number,
        q.cycle_status,

        q.planned_site_in,
        q.planned_site_out,
        q.actual_site_in,
        q.actual_site_out,

        q.planned_leave_start,
        q.planned_leave_end,
        q.actual_leave_start,
        q.actual_leave_end,

        q.days_overdue,
        q.potential_extra_site_days,

        case
            when q.action_code = 'POTENTIAL_OVERSTAY'
                then public.calculate_overstay_os_days(
                    q.roster_code,
                    q.potential_extra_site_days
                )
            else 0
        end as projected_os_days,

        q.source_reference,
        q.remarks
    from queue_source q
    where q.action_code is not null
    order by
        q.priority,
        q.days_overdue desc,
        q.employee_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hr_validate_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, approved_leave_days integer, estimated_leave_days_used integer, estimated_unused_leave_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('HR', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan memvalidasi Early Recall.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status <> 'PENDING_HR_VALIDATION' then
        raise exception
            'Expected PENDING_HR_VALIDATION, status saat ini %.',
            v_recall.status;
    end if;

    update public.early_recall_requests er
    set
        status = 'HR_VALIDATED',
        hr_validated_by_user_id = v_actor.id,
        hr_validated_at = now(),
        hr_validation_remarks =
            nullif(trim(coalesce(p_remarks, '')), '')
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        'PENDING_HR_VALIDATION',
        'HR_VALIDATED',
        'USER',
        v_actor.id,
        v_actor.role,
        coalesce(
            v_recall.hr_validation_remarks,
            'Approved leave and estimated unused leave validated by HR.'
        ),
        jsonb_build_object(
            'approved_leave_days', v_recall.approved_leave_days,
            'estimated_leave_days_used', v_recall.estimated_leave_days_used,
            'estimated_unused_leave_days', v_recall.estimated_unused_leave_days
        )
    );

    update public.early_recall_requests er
    set status = 'PENDING_PM_APPROVAL'
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        'HR_VALIDATED',
        'PENDING_PM_APPROVAL',
        'USER',
        v_actor.id,
        v_actor.role,
        'HR validation completed and forwarded to PM.',
        '{}'::jsonb
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_recall.approved_leave_days,
        v_recall.estimated_leave_days_used,
        v_recall.estimated_unused_leave_days;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_employee_management_records(p_actor_user_id uuid, p_search text DEFAULT NULL::text, p_include_inactive boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_search text := nullif(btrim(p_search), '');
    v_result jsonb;
begin
    perform 1
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    );

    with records as (
        select
            e.id as employee_id,
            e.employee_code,
            e.employee_name,
            coalesce(e.employee_type, 'EMPLOYEE') as employee_type,
            coalesce(e.email, u.email) as email,
            e.phone,
            e.department,
            e.section,
            e.job_title,
            e.join_date,
            e.point_of_hire,
            coalesce(e.is_active, true) as employee_is_active,

            u.id as user_id,
            u.username,
            u.role as user_role,
            coalesce(u.is_active, false) as user_is_active,
            coalesce(u.must_change_password, false)
                as must_change_password,

            a.id as roster_assignment_id,
            r.id as roster_pattern_id,
            r.code as roster_code,
            r.name as roster_name,
            r.site_days,
            r.leave_days,
            a.effective_from as roster_effective_from,
            a.effective_to as roster_effective_to,

            c.id as site_cycle_id,
            c.cycle_number,
            c.status as cycle_status,
            c.site_location_id,
            l.name as site_name,
            c.planned_site_in,
            c.planned_site_out,
            c.planned_leave_start,
            c.planned_leave_end,
            c.actual_site_in,
            c.actual_site_out,
            c.actual_leave_start,
            c.actual_leave_end,

            (
                c.id is null
                or (
                    c.status = 'PLANNED'
                    and c.actual_site_in is null
                    and c.actual_site_out is null
                    and c.actual_leave_start is null
                    and c.actual_leave_end is null
                )
            ) as schedule_editable

        from public.employees e

        left join lateral (
            select user_row.*
            from public.users user_row
            where user_row.role = 'EMPLOYEE'
              and (
                    user_row.employee_id = e.id
                 or user_row.id = e.user_id
                 or user_row.username = e.employee_code
              )
            order by
                case
                    when user_row.employee_id = e.id then 0
                    when user_row.id = e.user_id then 1
                    else 2
                end,
                user_row.id
            limit 1
        ) u on true

        left join lateral (
            select assignment_row.*
            from public.employee_roster_assignments assignment_row
            where assignment_row.employee_id = e.id
              and assignment_row.effective_to is null
            order by
                assignment_row.effective_from desc,
                assignment_row.created_at desc,
                assignment_row.id desc
            limit 1
        ) a on true

        left join public.roster_patterns r
          on r.id = a.roster_pattern_id

        left join lateral (
            select cycle_row.*
            from public.employee_site_cycles cycle_row
            where cycle_row.employee_id = e.id
              and cycle_row.status in (
                    'PLANNED',
                    'ON_SITE',
                    'TRAVEL_OUT_PENDING',
                    'ON_LEAVE'
              )
            order by
                cycle_row.cycle_number desc,
                cycle_row.created_at desc,
                cycle_row.id desc
            limit 1
        ) c on true

        left join public.locations l
          on l.id = c.site_location_id

        where (
            coalesce(p_include_inactive, true)
            or (
                coalesce(e.is_active, true) = true
                and coalesce(u.is_active, false) = true
            )
        )
          and (
            v_search is null
            or concat_ws(
                ' ',
                e.employee_code,
                e.employee_name,
                e.department,
                e.section,
                e.job_title,
                e.phone,
                e.email,
                u.email,
                r.code,
                l.name
            ) ilike '%' || v_search || '%'
          )
    ),
    limited as (
        select *
        from records
        order by employee_name, employee_code
        limit 1000
    )
    select jsonb_build_object(
        'items',
            coalesce(
                jsonb_agg(
                    to_jsonb(limited)
                    order by employee_name, employee_code
                ),
                '[]'::jsonb
            ),
        'total',
            (select count(*) from records),
        'returned',
            (select count(*) from limited)
    )
    into v_result
    from limited;

    return coalesce(
        v_result,
        jsonb_build_object(
            'items', '[]'::jsonb,
            'total', 0,
            'returned', 0
        )
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_early_recall_travel_booked(p_actor_user_id uuid, p_early_recall_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, linked_trf_id uuid, linked_trf_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_linked_trf public.trfs%rowtype;
    v_from_status text;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('GA', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan menandai travel booked.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status in (
        'TRAVEL_BOOKED',
        'RETURNED_TO_SITE',
        'OS_GENERATED'
    ) then
        select t.*
        into v_linked_trf
        from public.trfs t
        where t.id = v_recall.linked_trf_id;

        return query
        select
            v_recall.id,
            v_recall.recall_number,
            v_recall.status,
            v_recall.linked_trf_id,
            v_linked_trf.trf_number;
        return;
    end if;

    if v_recall.status not in ('PM_APPROVED', 'GA_PROCESSING') then
        raise exception
            'Status % tidak dapat ditandai TRAVEL_BOOKED.',
            v_recall.status;
    end if;

    if v_recall.linked_trf_id is null then
        raise exception 'Linked Travel-In TRF belum tersedia.';
    end if;

    select t.*
    into v_linked_trf
    from public.trfs t
    where t.id = v_recall.linked_trf_id;

    if not found then
        raise exception 'Linked Travel-In TRF tidak ditemukan.';
    end if;

    if v_linked_trf.status <> 'GA_PROCESSED' then
        raise exception
            'Linked TRF harus GA_PROCESSED. Status saat ini: %.',
            v_linked_trf.status;
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set
        ga_processed_by_user_id = coalesce(
            er.ga_processed_by_user_id,
            v_actor.id
        ),
        ga_processing_started_at = coalesce(
            er.ga_processing_started_at,
            now()
        ),
        travel_booked_at = now(),
        ga_remarks = coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            er.ga_remarks
        ),
        status = 'TRAVEL_BOOKED'
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_from_status,
        'TRAVEL_BOOKED',
        'USER',
        v_actor.id,
        v_actor.role,
        coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            'Early Recall travel arrangement completed.'
        ),
        jsonb_build_object(
            'linked_trf_id', v_linked_trf.id,
            'linked_trf_number', v_linked_trf.trf_number,
            'linked_trf_status', v_linked_trf.status
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_linked_trf.id,
        v_linked_trf.trf_number;
end;
$function$;

CREATE OR REPLACE FUNCTION public.pm_approve_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, linked_trf_id uuid, linked_trf_number text, already_approved boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_linked_trf public.trfs%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan approve Early Recall.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    -- Idempotency untuk retry setelah approval berhasil.
    if (
        v_recall.status in (
            'PM_APPROVED',
            'GA_PROCESSING',
            'TRAVEL_BOOKED',
            'RETURNED_TO_SITE',
            'OS_GENERATED'
        )
        and v_recall.pm_approved_at is not null
        and v_recall.linked_trf_id is not null
    ) then
        select t.*
        into v_linked_trf
        from public.trfs t
        where t.id = v_recall.linked_trf_id;

        if not found then
            raise exception
                'Linked TRF untuk Early Recall % tidak ditemukan.',
                v_recall.recall_number;
        end if;

        return query
        select
            v_recall.id,
            v_recall.recall_number,
            v_recall.status,
            v_linked_trf.id,
            v_linked_trf.trf_number,
            true;

        return;
    end if;

    if v_recall.status <> 'PENDING_PM_APPROVAL' then
        raise exception
            'Expected PENDING_PM_APPROVAL, status saat ini %.',
            v_recall.status;
    end if;

    if (
        v_recall.hr_validated_by_user_id is null
        or v_recall.hr_validated_at is null
    ) then
        raise exception
            'Early Recall belum memiliki validasi HR yang lengkap.';
    end if;

    insert into public.trfs (
        employee_id,
        department,
        travel_purpose,
        start_date,
        end_date,
        purpose_remarks,
        status,
        travel_arrangements,
        purpose_entries,
        accommodations,
        submitted_at
    )
    values (
        v_recall.employee_id,
        v_recall.department,
        'EARLY_RECALL',
        v_recall.proposed_return_date,
        v_recall.proposed_return_date,
        concat(
            'Linked Travel In for ',
            v_recall.recall_number,
            '. ',
            v_recall.reason
        ),
        'PM_APPROVED',
        '[]'::jsonb,
        jsonb_build_array(
            jsonb_build_object(
                'id', gen_random_uuid()::text,
                'travelPurpose', 'EARLY_RECALL',
                'startDate', v_recall.proposed_return_date,
                'endDate', v_recall.proposed_return_date,
                'purposeRemarks',
                    concat(
                        'Early Recall ',
                        v_recall.recall_number
                    )
            )
        ),
        '[]'::jsonb,
        now()
    )
    returning *
    into v_linked_trf;

    if v_linked_trf.trf_number is null then
        raise exception
            'Linked TRF berhasil dibuat tetapi TRF Number tidak ter-generate.';
    end if;

    update public.early_recall_requests er
    set
        linked_trf_id = v_linked_trf.id,
        pm_approved_by_user_id = v_actor.id,
        pm_approved_at = now(),
        pm_approval_remarks =
            nullif(trim(coalesce(p_remarks, '')), ''),
        status = 'PM_APPROVED'
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        'PENDING_PM_APPROVAL',
        'PM_APPROVED',
        'USER',
        v_actor.id,
        v_actor.role,
        coalesce(
            v_recall.pm_approval_remarks,
            'Early Recall approved by PM.'
        ),
        jsonb_build_object(
            'linked_trf_id', v_linked_trf.id,
            'linked_trf_number', v_linked_trf.trf_number,
            'linked_trf_status', v_linked_trf.status,
            'planned_return_date', v_recall.proposed_return_date
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_linked_trf.id,
        v_linked_trf.trf_number,
        false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_employee_roster_assignment_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if exists (
        select 1
        from public.employee_roster_assignments existing
        where existing.employee_id = new.employee_id
          and existing.id <> new.id
          and daterange(
                existing.effective_from,
                coalesce(
                    existing.effective_to + 1,
                    'infinity'::date
                ),
                '[)'
              )
              &&
              daterange(
                new.effective_from,
                coalesce(
                    new.effective_to + 1,
                    'infinity'::date
                ),
                '[)'
              )
    ) then
        raise exception
            'Roster assignment employee % memiliki periode yang overlap.',
            new.employee_id;
    end if;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_rejection_reason text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_from_status text;
begin
    if p_rejection_reason is null or trim(p_rejection_reason) = '' then
        raise exception 'Rejection reason wajib diisi.';
    end if;

    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_actor.role = 'HR' and v_recall.status <> 'PENDING_HR_VALIDATION' then
        raise exception
            'HR hanya dapat reject dari PENDING_HR_VALIDATION.';
    elsif v_actor.role = 'PM' and v_recall.status <> 'PENDING_PM_APPROVAL' then
        raise exception
            'PM hanya dapat reject dari PENDING_PM_APPROVAL.';
    elsif v_actor.role = 'SUPER_ADMIN'
          and v_recall.status not in (
              'PENDING_HR_VALIDATION',
              'PENDING_PM_APPROVAL'
          ) then
        raise exception
            'Status % tidak dapat ditolak.',
            v_recall.status;
    elsif v_actor.role not in ('HR', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan reject Early Recall.',
            v_actor.role;
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set
        status = 'REJECTED',
        rejected_by_user_id = v_actor.id,
        rejected_at = now(),
        rejection_reason = trim(p_rejection_reason)
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_from_status,
        'REJECTED',
        'USER',
        v_actor.id,
        v_actor.role,
        v_recall.rejection_reason,
        '{}'::jsonb
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.require_roster_os_actor(p_actor_user_id uuid, p_allowed_roles text[])
 RETURNS TABLE(actor_user_id uuid, actor_role text, actor_department text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
begin
    if p_actor_user_id is null then
        raise exception
            'Actor user ID wajib diisi.'
        using errcode = '22023';
    end if;

    if p_allowed_roles is null
       or cardinality(p_allowed_roles) = 0 then
        raise exception
            'Allowed roles wajib diisi.'
        using errcode = '22023';
    end if;

    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception
            'Actor user tidak ditemukan atau tidak aktif.'
        using errcode = 'P0002';
    end if;

    if not (
        v_actor.role = any(p_allowed_roles)
    ) then
        raise exception
            'Role % tidak diizinkan. Allowed roles: %.',
            v_actor.role,
            array_to_string(p_allowed_roles, ', ')
        using errcode = '42501';
    end if;

    return query
    select
        v_actor.id,
        v_actor.role,
        v_actor.department;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reset_employee_temporary_password(p_actor_user_id uuid, p_operation_key text, p_employee_id uuid, p_password_hash text, p_remarks text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_employee public.employees%rowtype;
    v_user public.users%rowtype;
    v_existing_audit public.employee_management_audit%rowtype;

    v_operation_key text := nullif(btrim(p_operation_key), '');
    v_remarks text := nullif(btrim(coalesce(p_remarks, '')), '');

    v_before jsonb;
    v_result jsonb;
begin
    perform 1
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    );

    if v_operation_key is null
       or p_employee_id is null
       or p_password_hash is null
       or length(btrim(p_password_hash)) < 20
       or v_remarks is null then
        raise exception
            'Employee, password hash, operation key, dan remarks wajib valid.'
        using errcode = '22023';
    end if;

    select audit_row.*
    into v_existing_audit
    from public.employee_management_audit audit_row
    where audit_row.operation_key = v_operation_key
      and audit_row.action = 'RESET_PASSWORD';

    if found then
        return v_existing_audit.after_data
            || jsonb_build_object('idempotent', true);
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'EMPLOYEE_PASSWORD:' || p_employee_id::text,
            0
        )
    );

    select e.*
    into strict v_employee
    from public.employees e
    where e.id = p_employee_id;

    select u.*
    into v_user
    from public.users u
    where u.role = 'EMPLOYEE'
      and (
            u.employee_id = v_employee.id
         or u.id = v_employee.user_id
         or u.username = v_employee.employee_code
      )
    order by
        case
            when u.employee_id = v_employee.id then 0
            when u.id = v_employee.user_id then 1
            else 2
        end,
        u.id
    limit 1
    for update;

    if not found then
        raise exception
            'Akun login EMPLOYEE untuk % tidak ditemukan.',
            v_employee.employee_code
        using errcode = 'P0002';
    end if;

    v_before := jsonb_build_object(
        'must_change_password', v_user.must_change_password,
        'active_session_count',
            (
                select count(*)
                from public.app_sessions s
                where s.user_id = v_user.id
                  and s.revoked_at is null
            )
    );

    update public.users
    set
        password_hash = p_password_hash,
        must_change_password = true
    where id = v_user.id
    returning *
    into v_user;

    update public.app_sessions
    set
        revoked_at = now(),
        revoke_reason = 'PASSWORD_RESET_BY_HR',
        updated_at = now()
    where user_id = v_user.id
      and revoked_at is null;

    v_result := jsonb_build_object(
        'idempotent', false,
        'employee_id', v_employee.id,
        'employee_code', v_employee.employee_code,
        'user_id', v_user.id,
        'username', v_user.username,
        'must_change_password',
            v_user.must_change_password,
        'all_previous_sessions_revoked', true,
        'remarks', v_remarks
    );

    insert into public.employee_management_audit (
        operation_key,
        action,
        employee_id,
        employee_code_snapshot,
        actor_user_id,
        before_data,
        after_data
    )
    values (
        v_operation_key,
        'RESET_PASSWORD',
        v_employee.id,
        v_employee.employee_code,
        p_actor_user_id,
        v_before,
        v_result
    );

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_employee_os_earned_site_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_cycle_id uuid;
    v_cycle_employee_id uuid;
    v_return_date date;
begin
    if new.earned_site_cycle_id is not null then
        select c.employee_id
        into v_cycle_employee_id
        from public.employee_site_cycles c
        where c.id = new.earned_site_cycle_id;

        if not found then
            raise exception
                'Earned Site Cycle tidak ditemukan.'
            using errcode = '23503';
        end if;

        if v_cycle_employee_id <> new.employee_id then
            raise exception
                'Earned Site Cycle bukan milik employee OS.'
            using errcode = '23514';
        end if;
    end if;

    if new.earned_site_cycle_id is null
       and new.source_type = 'OVERSTAY'
       and new.source_metadata ? 'site_cycle_id'
       and (
           new.source_metadata ->> 'site_cycle_id'
       ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then

        select c.id
        into v_cycle_id
        from public.employee_site_cycles c
        where c.id =
            (new.source_metadata ->> 'site_cycle_id')::uuid
          and c.employee_id = new.employee_id;

        if found then
            new.earned_site_cycle_id := v_cycle_id;
        end if;
    end if;

    if new.earned_site_cycle_id is null
       and new.source_type = 'EARLY_RECALL'
       and new.early_recall_id is not null then

        select er.actual_return_date
        into v_return_date
        from public.early_recall_requests er
        where er.id = new.early_recall_id
          and er.employee_id = new.employee_id;

        if v_return_date is not null then
            select c.id
            into v_cycle_id
            from public.employee_site_cycles c
            where c.employee_id = new.employee_id
              and c.actual_leave_start is not null
              and c.actual_leave_start < v_return_date
              and (
                  c.actual_leave_end =
                      v_return_date - 1
                  or (
                      c.actual_leave_end is null
                      and c.planned_leave_end >=
                          v_return_date - 1
                  )
              )
            order by
                case
                    when c.actual_leave_end =
                        v_return_date - 1
                        then 0
                    else 1
                end,
                c.cycle_number desc
            limit 1;

            if found then
                new.earned_site_cycle_id := v_cycle_id;
            end if;
        end if;
    end if;

    if new.earned_site_cycle_id is not null then
        new.source_metadata :=
            coalesce(
                new.source_metadata,
                '{}'::jsonb
            )
            || jsonb_build_object(
                'earned_site_cycle_id',
                    new.earned_site_cycle_id
            );
    end if;

    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.return_early_recall_for_revision(p_actor_user_id uuid, p_early_recall_id uuid, p_revision_reason text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_from_status text;
begin
    if p_revision_reason is null or trim(p_revision_reason) = '' then
        raise exception 'Revision reason wajib diisi.';
    end if;

    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_actor.role = 'HR' and v_recall.status <> 'PENDING_HR_VALIDATION' then
        raise exception
            'HR hanya dapat return revision dari PENDING_HR_VALIDATION.';
    elsif v_actor.role = 'PM' and v_recall.status <> 'PENDING_PM_APPROVAL' then
        raise exception
            'PM hanya dapat return revision dari PENDING_PM_APPROVAL.';
    elsif v_actor.role = 'SUPER_ADMIN'
          and v_recall.status not in (
              'PENDING_HR_VALIDATION',
              'PENDING_PM_APPROVAL'
          ) then
        raise exception
            'Status % tidak dapat dikembalikan untuk revisi.',
            v_recall.status;
    elsif v_actor.role not in ('HR', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan return revision.',
            v_actor.role;
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set
        status = 'NEEDS_REVISION',
        hr_validated_by_user_id = null,
        hr_validated_at = null,
        hr_validation_remarks = null,
        pm_approved_by_user_id = null,
        pm_approved_at = null,
        pm_approval_remarks = null
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_from_status,
        'NEEDS_REVISION',
        'USER',
        v_actor.id,
        v_actor.role,
        trim(p_revision_reason),
        jsonb_build_object(
            'revision_requested_by_role', v_actor.role
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_app_session_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_early_recall_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_management_active(p_actor_user_id uuid, p_operation_key text, p_employee_id uuid, p_is_active boolean, p_remarks text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_employee public.employees%rowtype;
    v_user public.users%rowtype;
    v_existing_audit public.employee_management_audit%rowtype;

    v_operation_key text := nullif(btrim(p_operation_key), '');
    v_remarks text := nullif(btrim(coalesce(p_remarks, '')), '');

    v_active_trf_count integer;
    v_before jsonb;
    v_result jsonb;
begin
    perform 1
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    );

    if v_operation_key is null then
        raise exception 'Operation key wajib diisi.'
        using errcode = '22023';
    end if;

    if p_employee_id is null
       or p_is_active is null
       or v_remarks is null then
        raise exception
            'Employee, status aktif, dan remarks wajib diisi.'
        using errcode = '22023';
    end if;

    select audit_row.*
    into v_existing_audit
    from public.employee_management_audit audit_row
    where audit_row.operation_key = v_operation_key
      and audit_row.action = 'SET_ACTIVE';

    if found then
        return v_existing_audit.after_data
            || jsonb_build_object('idempotent', true);
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'EMPLOYEE_ACTIVE:' || p_employee_id::text,
            0
        )
    );

    select e.*
    into strict v_employee
    from public.employees e
    where e.id = p_employee_id
    for update;

    select u.*
    into v_user
    from public.users u
    where u.role = 'EMPLOYEE'
      and (
            u.employee_id = v_employee.id
         or u.id = v_employee.user_id
         or u.username = v_employee.employee_code
      )
    order by
        case
            when u.employee_id = v_employee.id then 0
            when u.id = v_employee.user_id then 1
            else 2
        end,
        u.id
    limit 1
    for update;

    if not found then
        raise exception
            'Akun login EMPLOYEE untuk % tidak ditemukan.',
            v_employee.employee_code
        using errcode = 'P0002';
    end if;

    if p_is_active = false then
        select count(*)
        into v_active_trf_count
        from public.trfs trf
        where trf.employee_id = v_employee.id
          and trf.status not in (
                'GA_PROCESSED',
                'REJECTED'
          );

        if v_active_trf_count > 0 then
            raise exception
                'Employee memiliki % TRF aktif. Selesaikan atau batalkan TRF terlebih dahulu.',
                v_active_trf_count
            using errcode = '55000';
        end if;
    end if;

    v_before := jsonb_build_object(
        'employee_is_active', v_employee.is_active,
        'user_is_active', v_user.is_active,
        'remarks', v_remarks
    );

    update public.employees
    set is_active = p_is_active
    where id = v_employee.id
    returning *
    into v_employee;

    update public.users
    set is_active = p_is_active
    where id = v_user.id
    returning *
    into v_user;

    if p_is_active = false then
        update public.app_sessions
        set
            revoked_at = now(),
            revoke_reason = 'ACCOUNT_INACTIVE',
            updated_at = now()
        where user_id = v_user.id
          and revoked_at is null;
    end if;

    v_result := jsonb_build_object(
        'idempotent', false,
        'employee_id', v_employee.id,
        'employee_code', v_employee.employee_code,
        'employee_is_active', v_employee.is_active,
        'user_id', v_user.id,
        'user_is_active', v_user.is_active,
        'remarks', v_remarks
    );

    insert into public.employee_management_audit (
        operation_key,
        action,
        employee_id,
        employee_code_snapshot,
        actor_user_id,
        before_data,
        after_data
    )
    values (
        v_operation_key,
        'SET_ACTIVE',
        v_employee.id,
        v_employee.employee_code,
        p_actor_user_id,
        v_before,
        v_result
    );

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_os_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_roster_assignment_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_employee_site_cycle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_roster_pattern_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_early_recall_ga_processing(p_actor_user_id uuid, p_early_recall_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, linked_trf_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    if v_actor.role not in ('GA', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan memproses Early Recall.',
            v_actor.role;
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status in (
        'GA_PROCESSING',
        'TRAVEL_BOOKED',
        'RETURNED_TO_SITE',
        'OS_GENERATED'
    ) then
        return query
        select
            v_recall.id,
            v_recall.recall_number,
            v_recall.status,
            v_recall.linked_trf_id;
        return;
    end if;

    if v_recall.status <> 'PM_APPROVED' then
        raise exception
            'Expected PM_APPROVED, status saat ini %.',
            v_recall.status;
    end if;

    if v_recall.linked_trf_id is null then
        raise exception 'Linked Travel-In TRF belum tersedia.';
    end if;

    update public.early_recall_requests er
    set
        ga_processed_by_user_id = v_actor.id,
        ga_processing_started_at = coalesce(
            er.ga_processing_started_at,
            now()
        ),
        ga_remarks = coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            er.ga_remarks
        ),
        status = 'GA_PROCESSING'
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        'PM_APPROVED',
        'GA_PROCESSING',
        'USER',
        v_actor.id,
        v_actor.role,
        coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            'GA started processing Early Recall travel.'
        ),
        jsonb_build_object(
            'linked_trf_id', v_recall.linked_trf_id
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_recall.linked_trf_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_from_status text;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status not in ('DRAFT', 'NEEDS_REVISION') then
        raise exception
            'Early Recall berstatus % dan tidak dapat disubmit.',
            v_recall.status;
    end if;

    if v_actor.role not in ('HOD', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan submit Early Recall.',
            v_actor.role;
    end if;

    if (
        v_actor.role = 'HOD'
        and (
            v_actor.department is null
            or v_actor.department <> v_recall.department
        )
    ) then
        raise exception
            'HOD hanya dapat submit Early Recall department sendiri.';
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set status = 'PENDING_HR_VALIDATION'
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_from_status,
        'PENDING_HR_VALIDATION',
        'USER',
        v_actor.id,
        v_actor.role,
        coalesce(
            nullif(trim(coalesce(p_remarks, '')), ''),
            'Early Recall submitted for HR validation.'
        ),
        jsonb_build_object(
            'approved_leave_days', v_recall.approved_leave_days,
            'estimated_leave_days_used', v_recall.estimated_leave_days_used,
            'estimated_unused_leave_days', v_recall.estimated_unused_leave_days
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trf_purpose_remarks_are_complete(p_purpose_entries jsonb, p_legacy_purpose_remarks text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_entry jsonb;
begin
    if p_purpose_entries is not null
       and jsonb_typeof(p_purpose_entries) = 'array'
       and jsonb_array_length(p_purpose_entries) > 0 then

        for v_entry in
            select value
            from jsonb_array_elements(p_purpose_entries)
        loop
            if nullif(
                btrim(
                    coalesce(
                        v_entry ->> 'purposeRemarks',
                        ''
                    )
                ),
                ''
            ) is null then
                return false;
            end if;
        end loop;

        return true;
    end if;

    return nullif(
        btrim(
            coalesce(
                p_legacy_purpose_remarks,
                ''
            )
        ),
        ''
    ) is not null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_early_recall_request(p_actor_user_id uuid, p_early_recall_id uuid, p_approved_leave_start date, p_approved_leave_end date, p_proposed_return_date date, p_reason text, p_source_trf_id uuid DEFAULT NULL::uuid, p_remarks text DEFAULT NULL::text)
 RETURNS TABLE(early_recall_id uuid, recall_number text, recall_status text, approved_leave_days integer, estimated_leave_days_used integer, estimated_unused_leave_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor public.users%rowtype;
    v_recall public.early_recall_requests%rowtype;
    v_source_trf public.trfs%rowtype;
    v_old jsonb;
begin
    select u.*
    into v_actor
    from public.users u
    where u.id = p_actor_user_id
      and coalesce(u.is_active, true) = true;

    if not found then
        raise exception 'Actor user tidak ditemukan atau tidak aktif.';
    end if;

    select er.*
    into v_recall
    from public.early_recall_requests er
    where er.id = p_early_recall_id
    for update;

    if not found then
        raise exception 'Early Recall tidak ditemukan.';
    end if;

    if v_recall.status not in ('DRAFT', 'NEEDS_REVISION') then
        raise exception
            'Early Recall berstatus % dan tidak dapat diedit.',
            v_recall.status;
    end if;

    if v_actor.role not in ('HOD', 'PM', 'SUPER_ADMIN') then
        raise exception
            'Role % tidak diizinkan mengedit Early Recall.',
            v_actor.role;
    end if;

    if (
        v_actor.role = 'HOD'
        and (
            v_actor.department is null
            or v_actor.department <> v_recall.department
        )
    ) then
        raise exception
            'HOD hanya dapat mengedit Early Recall department sendiri.';
    end if;

    if p_approved_leave_end < p_approved_leave_start then
        raise exception 'Periode approved leave tidak valid.';
    end if;

    if (
        p_proposed_return_date <= p_approved_leave_start
        or p_proposed_return_date > p_approved_leave_end
    ) then
        raise exception 'Proposed Return Date tidak valid.';
    end if;

    if p_reason is null or trim(p_reason) = '' then
        raise exception 'Reason for Recall wajib diisi.';
    end if;

    if p_source_trf_id is not null then
        select t.*
        into v_source_trf
        from public.trfs t
        where t.id = p_source_trf_id;

        if not found then
            raise exception 'Source TRF tidak ditemukan.';
        end if;

        if v_source_trf.employee_id <> v_recall.employee_id then
            raise exception
                'Source TRF tidak dimiliki oleh employee Early Recall.';
        end if;

        if v_source_trf.status in ('REJECTED', 'NEEDS_REVISION') then
            raise exception
                'Source TRF berstatus % dan tidak dapat digunakan.',
                v_source_trf.status;
        end if;
    end if;

    v_old := jsonb_build_object(
        'approved_leave_start', v_recall.approved_leave_start,
        'approved_leave_end', v_recall.approved_leave_end,
        'proposed_return_date', v_recall.proposed_return_date,
        'reason', v_recall.reason,
        'remarks', v_recall.remarks,
        'source_trf_id', v_recall.source_trf_id
    );

    update public.early_recall_requests er
    set
        approved_leave_start = p_approved_leave_start,
        approved_leave_end = p_approved_leave_end,
        proposed_return_date = p_proposed_return_date,
        reason = trim(p_reason),
        remarks = nullif(trim(coalesce(p_remarks, '')), ''),
        source_trf_id = p_source_trf_id,

        -- Revisi wajib melalui validasi HR ulang.
        hr_validated_by_user_id = null,
        hr_validated_at = null,
        hr_validation_remarks = null,
        pm_approved_by_user_id = null,
        pm_approved_at = null,
        pm_approval_remarks = null
    where er.id = v_recall.id
    returning er.*
    into v_recall;

    insert into public.early_recall_status_history (
        early_recall_id,
        from_status,
        to_status,
        actor_type,
        changed_by_user_id,
        changed_by_role,
        remarks,
        metadata
    )
    values (
        v_recall.id,
        v_recall.status,
        v_recall.status,
        'USER',
        v_actor.id,
        v_actor.role,
        'Early Recall data updated.',
        jsonb_build_object(
            'event', 'DATA_UPDATED',
            'old_values', v_old,
            'new_values', jsonb_build_object(
                'approved_leave_start', v_recall.approved_leave_start,
                'approved_leave_end', v_recall.approved_leave_end,
                'proposed_return_date', v_recall.proposed_return_date,
                'reason', v_recall.reason,
                'remarks', v_recall.remarks,
                'source_trf_id', v_recall.source_trf_id
            )
        )
    );

    return query
    select
        v_recall.id,
        v_recall.recall_number,
        v_recall.status,
        v_recall.approved_leave_days,
        v_recall.estimated_leave_days_used,
        v_recall.estimated_unused_leave_days;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_employee_management(p_actor_user_id uuid, p_operation_key text, p_employee_id uuid, p_employee_name text, p_employee_type text, p_email text, p_phone text, p_department text, p_section text, p_job_title text, p_join_date date, p_point_of_hire text, p_roster_code text, p_site_location_id uuid, p_planned_d1 date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_employee public.employees%rowtype;
    v_user public.users%rowtype;
    v_roster public.roster_patterns%rowtype;
    v_site public.locations%rowtype;
    v_assignment public.employee_roster_assignments%rowtype;
    v_cycle public.employee_site_cycles%rowtype;

    v_existing_audit public.employee_management_audit%rowtype;

    v_operation_key text := nullif(btrim(p_operation_key), '');
    v_employee_name text := btrim(coalesce(p_employee_name, ''));
    v_employee_type text := upper(btrim(coalesce(p_employee_type, '')));
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_phone text := btrim(coalesce(p_phone, ''));
    v_department text := btrim(coalesce(p_department, ''));
    v_section text := nullif(btrim(coalesce(p_section, '')), '');
    v_job_title text := btrim(coalesce(p_job_title, ''));
    v_point_of_hire text :=
        nullif(btrim(coalesce(p_point_of_hire, '')), '');

    v_schedule_editable boolean;
    v_schedule_changed boolean;
    v_cycle_number integer;

    v_before jsonb;
    v_result jsonb;
begin
    perform 1
    from public.require_roster_os_actor(
        p_actor_user_id,
        array['HR', 'SUPER_ADMIN']::text[]
    );

    if v_operation_key is null
       or length(v_operation_key) > 200 then
        raise exception
            'Operation key wajib diisi dan maksimal 200 karakter.'
        using errcode = '22023';
    end if;

    select audit_row.*
    into v_existing_audit
    from public.employee_management_audit audit_row
    where audit_row.operation_key = v_operation_key
      and audit_row.action = 'UPDATE';

    if found then
        return v_existing_audit.after_data
            || jsonb_build_object('idempotent', true);
    end if;

    if p_employee_id is null then
        raise exception 'Employee wajib dipilih.'
        using errcode = '22023';
    end if;

    if v_employee_name = ''
       or v_employee_type not in ('EMPLOYEE', 'VISITOR')
       or v_email = ''
       or v_email !~
          '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
       or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 8
       or v_department = ''
       or v_job_title = ''
       or p_join_date is null
       or p_site_location_id is null
       or p_planned_d1 is null then
        raise exception
            'Nama, Employee Type, Email, WhatsApp, Department, Job Title, Date of Hire, Roster, Site, dan D1 wajib valid.'
        using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.reference_master rm
        where rm.category = 'DEPARTMENT'
          and coalesce(rm.is_active, true) = true
          and rm.name = v_department
    ) then
        raise exception
            'Department % tidak tersedia pada master data.',
            v_department
        using errcode = '22023';
    end if;

    select roster_row.*
    into strict v_roster
    from public.roster_patterns roster_row
    where roster_row.code = p_roster_code
      and roster_row.code in (
            '4:2', '5:2', '6:2', '8:2', '10:2'
      )
      and coalesce(roster_row.is_active, true) = true;

    select site_row.*
    into strict v_site
    from public.locations site_row
    where site_row.id = p_site_location_id
      and site_row.type = 'SITE'
      and coalesce(site_row.is_active, true) = true;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'EMPLOYEE_MANAGEMENT:' || p_employee_id::text,
            0
        )
    );

    select e.*
    into strict v_employee
    from public.employees e
    where e.id = p_employee_id
    for update;

    select u.*
    into v_user
    from public.users u
    where u.role = 'EMPLOYEE'
      and (
            u.employee_id = v_employee.id
         or u.id = v_employee.user_id
         or u.username = v_employee.employee_code
      )
    order by
        case
            when u.employee_id = v_employee.id then 0
            when u.id = v_employee.user_id then 1
            else 2
        end,
        u.id
    limit 1
    for update;

    if not found then
        raise exception
            'Akun login EMPLOYEE untuk % tidak ditemukan.',
            v_employee.employee_code
        using errcode = 'P0002';
    end if;

    if exists (
        select 1
        from public.users u
        where lower(u.email) = v_email
          and u.id <> v_user.id
    )
       or exists (
        select 1
        from public.employees e
        where lower(e.email) = v_email
          and e.id <> v_employee.id
    ) then
        raise exception
            'Email % sudah digunakan.',
            v_email
        using errcode = '23505';
    end if;

    select a.*
    into v_assignment
    from public.employee_roster_assignments a
    where a.employee_id = v_employee.id
      and a.effective_to is null
    order by
        a.effective_from desc,
        a.created_at desc,
        a.id desc
    limit 1
    for update;

    select c.*
    into v_cycle
    from public.employee_site_cycles c
    where c.employee_id = v_employee.id
      and c.status in (
            'PLANNED',
            'ON_SITE',
            'TRAVEL_OUT_PENDING',
            'ON_LEAVE'
      )
    order by
        c.cycle_number desc,
        c.created_at desc,
        c.id desc
    limit 1
    for update;

    v_schedule_editable :=
        v_cycle.id is null
        or (
            v_cycle.status = 'PLANNED'
            and v_cycle.actual_site_in is null
            and v_cycle.actual_site_out is null
            and v_cycle.actual_leave_start is null
            and v_cycle.actual_leave_end is null
        );

    v_schedule_changed :=
        (
            v_assignment.id is null
            or v_assignment.roster_pattern_id <> v_roster.id
        )
        or (
            v_cycle.id is null
            and (
                v_assignment.id is null
                or v_assignment.effective_from <> p_planned_d1
            )
        )
        or (
            v_cycle.id is not null
            and (
                v_cycle.site_location_id <> v_site.id
                or v_cycle.planned_site_in <> p_planned_d1
            )
        );

    if not v_schedule_editable
       and v_schedule_changed then
        raise exception
            'Roster, Site, atau D1 tidak dapat diubah karena cycle sudah memiliki actual movement.'
        using errcode = '55000';
    end if;

    v_before := jsonb_build_object(
        'employee', to_jsonb(v_employee),
        'user',
            jsonb_build_object(
                'id', v_user.id,
                'username', v_user.username,
                'email', v_user.email,
                'role', v_user.role,
                'department', v_user.department,
                'is_active', v_user.is_active,
                'must_change_password',
                    v_user.must_change_password
            ),
        'roster_assignment',
            case
                when v_assignment.id is null then null
                else to_jsonb(v_assignment)
            end,
        'site_cycle',
            case
                when v_cycle.id is null then null
                else to_jsonb(v_cycle)
            end
    );

    update public.employees
    set
        employee_name = v_employee_name,
        employee_type = v_employee_type,
        email = v_email,
        phone = v_phone,
        department = v_department,
        section = coalesce(v_section, ''),
        job_title = v_job_title,
        join_date = p_join_date,
        point_of_hire = coalesce(v_point_of_hire, '')
    where id = v_employee.id
    returning *
    into v_employee;

    update public.users
    set
        email = v_email,
        department = v_department
    where id = v_user.id
    returning *
    into v_user;

    if v_assignment.id is null then
        insert into public.employee_roster_assignments (
            employee_id,
            roster_pattern_id,
            effective_from,
            effective_to,
            source_type,
            source_reference,
            assigned_by_user_id,
            remarks
        )
        values (
            v_employee.id,
            v_roster.id,
            p_planned_d1,
            null,
            'HR_MANUAL',
            v_operation_key,
            p_actor_user_id,
            'Roster assigned through Employee Management.'
        )
        returning *
        into v_assignment;
    elsif v_schedule_editable then
        update public.employee_roster_assignments
        set
            roster_pattern_id = v_roster.id,
            effective_from = p_planned_d1,
            assigned_by_user_id = p_actor_user_id,
            source_type = 'HR_MANUAL',
            source_reference = v_operation_key,
            remarks = 'Roster updated through Employee Management.'
        where id = v_assignment.id
        returning *
        into v_assignment;
    end if;

    if v_cycle.id is null then
        select coalesce(max(c.cycle_number), 0) + 1
        into v_cycle_number
        from public.employee_site_cycles c
        where c.employee_id = v_employee.id;

        insert into public.employee_site_cycles (
            employee_id,
            roster_assignment_id,
            site_location_id,
            cycle_number,

            planned_site_in,
            planned_site_out,
            planned_leave_start,
            planned_leave_end,

            actual_site_in,
            actual_site_out,
            actual_leave_start,
            actual_leave_end,

            site_in_trf_id,
            site_out_trf_id,

            status,
            source_type,
            source_reference,
            created_by_user_id,
            remarks
        )
        values (
            v_employee.id,
            v_assignment.id,
            v_site.id,
            v_cycle_number,

            p_planned_d1,
            p_planned_d1 + v_roster.site_days,
            p_planned_d1 + v_roster.site_days,
            p_planned_d1
                + v_roster.site_days
                + v_roster.leave_days
                - 1,

            null,
            null,
            null,
            null,

            null,
            null,

            'PLANNED',
            'HR_MANUAL',
            v_operation_key,
            p_actor_user_id,
            'Planned cycle created through Employee Management.'
        )
        returning *
        into v_cycle;
    elsif v_schedule_editable then
        update public.employee_site_cycles
        set
            roster_assignment_id = v_assignment.id,
            site_location_id = v_site.id,

            planned_site_in = p_planned_d1,
            planned_site_out =
                p_planned_d1 + v_roster.site_days,
            planned_leave_start =
                p_planned_d1 + v_roster.site_days,
            planned_leave_end =
                p_planned_d1
                + v_roster.site_days
                + v_roster.leave_days
                - 1,

            status = 'PLANNED',
            source_type = 'HR_MANUAL',
            source_reference = v_operation_key,
            remarks =
                'Planned cycle updated through Employee Management.'
        where id = v_cycle.id
        returning *
        into v_cycle;
    end if;

    v_result := jsonb_build_object(
        'idempotent', false,
        'employee',
            jsonb_build_object(
                'id', v_employee.id,
                'employee_code', v_employee.employee_code,
                'employee_name', v_employee.employee_name,
                'employee_type', v_employee.employee_type,
                'email', v_employee.email,
                'phone', v_employee.phone,
                'department', v_employee.department,
                'section', v_employee.section,
                'job_title', v_employee.job_title,
                'join_date', v_employee.join_date,
                'point_of_hire', v_employee.point_of_hire,
                'is_active', v_employee.is_active
            ),
        'user',
            jsonb_build_object(
                'id', v_user.id,
                'username', v_user.username,
                'email', v_user.email,
                'is_active', v_user.is_active,
                'must_change_password',
                    v_user.must_change_password
            ),
        'roster_assignment',
            jsonb_build_object(
                'id', v_assignment.id,
                'roster_code', v_roster.code,
                'effective_from', v_assignment.effective_from,
                'effective_to', v_assignment.effective_to
            ),
        'site_cycle',
            jsonb_build_object(
                'id', v_cycle.id,
                'cycle_number', v_cycle.cycle_number,
                'status', v_cycle.status,
                'site_location_id', v_cycle.site_location_id,
                'site_name', v_site.name,
                'planned_site_in', v_cycle.planned_site_in,
                'planned_site_out', v_cycle.planned_site_out,
                'planned_leave_start',
                    v_cycle.planned_leave_start,
                'planned_leave_end',
                    v_cycle.planned_leave_end,
                'actual_site_in', v_cycle.actual_site_in
            ),
        'schedule_editable_after',
            (
                v_cycle.status = 'PLANNED'
                and v_cycle.actual_site_in is null
                and v_cycle.actual_site_out is null
                and v_cycle.actual_leave_start is null
                and v_cycle.actual_leave_end is null
            )
    );

    insert into public.employee_management_audit (
        operation_key,
        action,
        employee_id,
        employee_code_snapshot,
        actor_user_id,
        before_data,
        after_data
    )
    values (
        v_operation_key,
        'UPDATE',
        v_employee.id,
        v_employee.employee_code,
        p_actor_user_id,
        v_before,
        v_result
    );

    return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_employee_site_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_assignment
        public.employee_roster_assignments%rowtype;
begin
    select assignment.*
    into v_assignment
    from public.employee_roster_assignments assignment
    where assignment.id =
        new.roster_assignment_id;

    if not found then
        raise exception
            'Roster assignment % tidak ditemukan.',
            new.roster_assignment_id;
    end if;

    if v_assignment.employee_id
       <> new.employee_id then
        raise exception
            'Employee site cycle tidak sama dengan employee roster assignment.';
    end if;

    if new.planned_site_in
       < v_assignment.effective_from then
        raise exception
            'Planned Site In lebih awal dari effective roster assignment.';
    end if;

    if v_assignment.effective_to is not null
       and new.planned_site_in
           > v_assignment.effective_to then
        raise exception
            'Planned Site In melewati effective roster assignment.';
    end if;

    if new.status <> 'CANCELLED'
       and exists (
            select 1
            from public.employee_site_cycles existing
            where existing.employee_id =
                new.employee_id
              and existing.id <> new.id
              and existing.status <> 'CANCELLED'
              and daterange(
                    existing.planned_site_in,
                    existing.planned_site_out,
                    '[)'
                  )
                  &&
                  daterange(
                    new.planned_site_in,
                    new.planned_site_out,
                    '[)'
                  )
       ) then
        raise exception
            'Site cycle employee % memiliki planned site period yang overlap.',
            new.employee_id;
    end if;

    return new;
end;
$function$;

CREATE TRIGGER trg_app_sessions_updated_at BEFORE UPDATE ON public.app_sessions FOR EACH ROW EXECUTE FUNCTION set_app_session_updated_at();

CREATE TRIGGER trg_early_recall_updated_at BEFORE UPDATE ON public.early_recall_requests FOR EACH ROW EXECUTE FUNCTION set_early_recall_updated_at();

CREATE TRIGGER trg_employee_os_updated_at BEFORE UPDATE ON public.employee_os_ledger FOR EACH ROW EXECUTE FUNCTION set_employee_os_updated_at();

CREATE TRIGGER trg_resolve_employee_os_earned_site_cycle BEFORE INSERT OR UPDATE OF employee_id, source_type, early_recall_id, source_metadata, earned_site_cycle_id, generated_date ON public.employee_os_ledger FOR EACH ROW EXECUTE FUNCTION resolve_employee_os_earned_site_cycle();

CREATE TRIGGER trg_employee_roster_assignment_updated_at BEFORE UPDATE ON public.employee_roster_assignments FOR EACH ROW EXECUTE FUNCTION set_employee_roster_assignment_updated_at();

CREATE TRIGGER trg_prevent_roster_assignment_overlap BEFORE INSERT OR UPDATE ON public.employee_roster_assignments FOR EACH ROW EXECUTE FUNCTION prevent_employee_roster_assignment_overlap();

CREATE TRIGGER trg_employee_site_cycle_updated_at BEFORE UPDATE ON public.employee_site_cycles FOR EACH ROW EXECUTE FUNCTION set_employee_site_cycle_updated_at();

CREATE TRIGGER trg_validate_employee_site_cycle BEFORE INSERT OR UPDATE ON public.employee_site_cycles FOR EACH ROW EXECUTE FUNCTION validate_employee_site_cycle();

CREATE TRIGGER trg_roster_pattern_updated_at BEFORE UPDATE ON public.roster_patterns FOR EACH ROW EXECUTE FUNCTION set_roster_pattern_updated_at();

CREATE TRIGGER trg_enforce_trf_purpose_remarks BEFORE INSERT OR UPDATE OF purpose_entries, purpose_remarks ON public.trfs FOR EACH ROW EXECUTE FUNCTION enforce_trf_purpose_remarks();

CREATE TRIGGER trigger_set_trf_number BEFORE INSERT ON public.trfs FOR EACH ROW EXECUTE FUNCTION generate_trf_number();

CREATE TRIGGER update_trfs_updated_at BEFORE UPDATE ON public.trfs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

