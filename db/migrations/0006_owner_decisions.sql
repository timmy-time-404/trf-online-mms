-- Owner decisions D2/D6/D7/D8/D9/D13. Existing TRF numbers remain unchanged.
CREATE FUNCTION public.normalize_department(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(btrim(coalesce(value, ''))) $$;
CREATE FUNCTION public.business_date(instant timestamptz DEFAULT now()) RETURNS date LANGUAGE sql STABLE AS $$ SELECT (instant AT TIME ZONE 'Asia/Makassar')::date $$;
GRANT EXECUTE ON FUNCTION public.normalize_department(text),public.business_date(timestamptz) TO trf_auth_runtime;
ALTER TABLE public.trfs ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE public.trfs ADD COLUMN late_submission_reason text;
ALTER TABLE public.trfs ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.trfs ALTER COLUMN end_date DROP NOT NULL;
ALTER TABLE public.trfs ADD CONSTRAINT trfs_status_check CHECK(status IN ('DRAFT','SUBMITTED','ADMIN_DEPT_VERIFIED','PENDING_APPROVAL','HOD_APPROVED','HR_APPROVED','PM_APPROVED','GA_PROCESSED','REJECTED','NEEDS_REVISION','REVISED','CANCELLED')) NOT VALID;
GRANT UPDATE(late_submission_reason) ON public.trfs TO trf_auth_runtime;
CREATE FUNCTION public.increment_trf_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.version:=OLD.version+1; RETURN NEW; END $$;
CREATE TRIGGER increment_trf_version BEFORE UPDATE ON public.trfs FOR EACH ROW EXECUTE FUNCTION public.increment_trf_version();

CREATE OR REPLACE FUNCTION public.adjust_employee_os(p_actor_user_id uuid, p_operation_key text, p_adjustment_type text, p_employee_id uuid DEFAULT NULL::uuid, p_os_ledger_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT NULL::integer, p_new_remaining_days integer DEFAULT NULL::integer, p_new_cycle_number integer DEFAULT NULL::integer, p_earned_site_cycle_id uuid DEFAULT NULL::uuid, p_generated_date date DEFAULT public.business_date(), p_reference_number text DEFAULT NULL::text, p_remarks text DEFAULT NULL::text)
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
            public.normalize_department(v_actor.department) = ''
            or public.normalize_department(v_actor.department) <> public.normalize_department(v_recall.department)
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
      and er.status = v_recall.status
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
            public.normalize_department(v_actor.department) = ''
            or public.normalize_department(v_actor.department) <> public.normalize_department(v_employee.department)
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

CREATE OR REPLACE FUNCTION public.enforce_trf_purpose_remarks()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if new.status = 'DRAFT' then return new; end if;
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

CREATE OR REPLACE FUNCTION public.generate_trf_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.trf_number IS NULL THEN
        NEW.trf_number := 'TRF-' || TO_CHAR(public.business_date(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0');
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_manpower_dashboard_snapshot(p_actor_user_id uuid, p_as_of_date date DEFAULT public.business_date())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_actor_role text;
    v_actor_department text;
    v_as_of_date date := coalesce(p_as_of_date, public.business_date());
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
       and public.normalize_department(v_actor_department) = '' then
        raise exception
            'Department akun HOD belum ditentukan.'
        using errcode = '22023';
    end if;

    if v_as_of_date > public.business_date() then
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
              and public.normalize_department(rm.name)
                  = public.normalize_department(coalesce(e.department, ''))
            order by rm.id
            limit 1
        ) department_master
          on true
        where coalesce(e.is_active, true) = true
          and coalesce(e.employee_type, 'EMPLOYEE') = 'EMPLOYEE'
          and (
                v_actor_role <> 'HOD'
                or public.normalize_department(coalesce(e.department, ''))
                   = public.normalize_department(v_actor_department)
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

CREATE OR REPLACE FUNCTION public.get_my_roster_os_summary(p_actor_user_id uuid, p_as_of_date date DEFAULT public.business_date())
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

CREATE OR REPLACE FUNCTION public.get_roster_attention_queue(p_actor_user_id uuid, p_as_of_date date DEFAULT public.business_date())
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
                or public.normalize_department(e.department)
                   = public.normalize_department(v_actor_department)
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
            public.normalize_department(v_actor.department) = ''
            or public.normalize_department(v_actor.department) <> public.normalize_department(v_recall.department)
        )
    ) then
        raise exception
            'HOD hanya dapat submit Early Recall department sendiri.';
    end if;

    v_from_status := v_recall.status;

    update public.early_recall_requests er
    set status = 'PENDING_HR_VALIDATION'
    where er.id = v_recall.id
      and er.status = v_recall.status
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
            public.normalize_department(v_actor.department) = ''
            or public.normalize_department(v_actor.department) <> public.normalize_department(v_recall.department)
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
      and er.status = v_recall.status
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
    v_email text := public.normalize_department(coalesce(p_email, ''));
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
          and public.normalize_department(rm.name) = public.normalize_department(v_department)
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
    v_email text := public.normalize_department(coalesce(p_email, ''));
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
          and public.normalize_department(rm.name) = public.normalize_department(v_department)
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
      and er.status = v_recall.status
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
