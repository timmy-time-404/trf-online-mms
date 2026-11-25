-- #13: the same leave period could be converted into OS more than once. The legacy guard
-- (early_recall_one_active_employee_idx) only blocks two ACTIVE recalls; once a recall was
-- OS_GENERATED, a new recall with an overlapping approved leave period was accepted and
-- generated OS again.
--
-- create/update now reject a period that overlaps an OS_GENERATED recall of the same
-- employee. REJECTED and CANCELLED recalls never generated OS and do not block.
-- Both routines keep their existing bodies; CREATE OR REPLACE keeps grants and counts.

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
    v_converted_recall text;
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

    -- #13: a leave period that was already converted into OS cannot be recalled again.
    select er.recall_number
    into v_converted_recall
    from public.early_recall_requests er
    where er.employee_id = v_employee.id
      and er.status = 'OS_GENERATED'
      and daterange(er.approved_leave_start, er.approved_leave_end, '[]')
          && daterange(p_approved_leave_start, p_approved_leave_end, '[]')
    order by er.created_at
    limit 1;

    if found then
        raise exception
            'Periode cuti ini sudah pernah dikonversi menjadi OS (%).',
            v_converted_recall;
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
    v_converted_recall text;
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

    -- #13: a leave period that was already converted into OS cannot be recalled again.
    select er.recall_number
    into v_converted_recall
    from public.early_recall_requests er
    where er.employee_id = v_recall.employee_id
      and er.status = 'OS_GENERATED'
      and daterange(er.approved_leave_start, er.approved_leave_end, '[]')
          && daterange(p_approved_leave_start, p_approved_leave_end, '[]')
    order by er.created_at
    limit 1;

    if found then
        raise exception
            'Periode cuti ini sudah pernah dikonversi menjadi OS (%).',
            v_converted_recall;
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
