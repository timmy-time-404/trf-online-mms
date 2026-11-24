-- Native API access to the existing, actor-authorized business routines.
CREATE FUNCTION public.change_application_password(p_actor_user_id uuid, p_session_id uuid, p_expected_hash text, p_new_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  PERFORM 1 FROM public.users WHERE id=p_actor_user_id AND is_active=true AND password_hash=p_expected_hash FOR UPDATE;
  IF NOT FOUND OR p_new_hash NOT LIKE '$argon2id$%' THEN RAISE EXCEPTION 'Invalid password change' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.app_sessions WHERE id=p_session_id AND user_id=p_actor_user_id AND revoked_at IS NULL
    AND expires_at>now() AND created_at>now()-interval '12 hours' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session revoked' USING ERRCODE='42501'; END IF;
  UPDATE public.users SET password_hash=p_new_hash,must_change_password=false WHERE id=p_actor_user_id;
  UPDATE public.app_sessions SET revoked_at=now(),revoke_reason='PASSWORD_CHANGED'
    WHERE user_id=p_actor_user_id AND id<>p_session_id AND revoked_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.change_application_password(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_application_password(uuid,uuid,text,text) TO trf_auth_runtime;

GRANT SELECT ON public.early_recall_requests, public.early_recall_status_history,
 public.employee_os_ledger, public.employee_site_cycles TO trf_auth_runtime;
-- SELECT FOR UPDATE needs an UPDATE privilege, limited to the concurrency column.
GRANT UPDATE (status) ON public.early_recall_requests TO trf_auth_runtime;
ALTER TABLE public.notification_outbox ALTER COLUMN trf_id DROP NOT NULL;
ALTER TABLE public.notification_outbox ADD COLUMN early_recall_id uuid REFERENCES public.early_recall_requests(id) ON DELETE CASCADE;
ALTER TABLE public.notification_outbox ADD CONSTRAINT notification_outbox_source_check CHECK (num_nonnulls(trf_id,early_recall_id)=1);
CREATE INDEX notification_outbox_early_recall_idx ON public.notification_outbox(early_recall_id) WHERE early_recall_id IS NOT NULL;

GRANT EXECUTE ON FUNCTION public.get_employee_management_master_data(uuid) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.list_employee_management_records(uuid,text,boolean) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.create_employee_onboarding(uuid,text,text,text,text,text,text,text,text,text,date,text,text,uuid,date,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.update_employee_management(uuid,text,uuid,text,text,text,text,text,text,text,date,text,text,uuid,date) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.set_employee_management_active(uuid,text,uuid,boolean,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.reset_employee_temporary_password(uuid,text,uuid,text,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.get_my_roster_os_summary(uuid,date) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.get_roster_attention_queue(uuid,date) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.confirm_employee_actual_site_out(uuid,uuid,date,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.confirm_employee_leave_start(uuid,uuid,date,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.confirm_employee_return_to_site(uuid,uuid,date,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.consume_employee_os_fifo(uuid,uuid,integer,text,text,uuid,text,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.adjust_employee_os(uuid,text,text,uuid,uuid,integer,integer,integer,uuid,date,text,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.get_manpower_dashboard_snapshot(uuid,date) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.create_early_recall_request(uuid,uuid,date,date,date,text,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.update_early_recall_request(uuid,uuid,date,date,date,text,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.submit_early_recall_request(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.hr_validate_early_recall_request(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.return_early_recall_for_revision(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.pm_approve_early_recall_request(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.start_early_recall_ga_processing(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.mark_early_recall_travel_booked(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.acknowledge_early_recall(uuid,uuid) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.confirm_early_recall_actual_return(uuid,uuid,date,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.reject_early_recall_request(uuid,uuid,text) TO trf_auth_runtime;
GRANT EXECUTE ON FUNCTION public.cancel_early_recall_request(uuid,uuid,text) TO trf_auth_runtime;

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
