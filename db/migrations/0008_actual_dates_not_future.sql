-- #12: actual dates (roster movements and Early Recall return) must not be later than
-- today's business date (Asia/Makassar). Previously a future date was accepted and the
-- overstay/Early Recall OS was generated for days that had not happened yet.
--
-- Both routines are replaced with their existing bodies plus the date check; nothing else
-- changes. CREATE OR REPLACE keeps owner, SECURITY DEFINER and grants, so routine and
-- trigger counts in deploy/verify-schema.sql stay the same.

CREATE OR REPLACE FUNCTION public.validate_employee_site_cycle()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_assignment
        public.employee_roster_assignments%rowtype;
    v_old public.employee_site_cycles%rowtype;
    v_today date := public.business_date();
begin
    -- #12: an actual movement cannot be confirmed before it happens (WITA business date).
    -- Only newly set or changed values are checked, so existing rows stay valid.
    if tg_op = 'UPDATE' then
        v_old := old;
    end if;

    if new.actual_site_in is distinct from v_old.actual_site_in
       and new.actual_site_in > v_today then
        raise exception
            'Actual Site In (%) tidak boleh melebihi hari ini (%).',
            new.actual_site_in, v_today;
    end if;

    if new.actual_site_out is distinct from v_old.actual_site_out
       and new.actual_site_out > v_today then
        raise exception
            'Actual Site Out (%) tidak boleh melebihi hari ini (%).',
            new.actual_site_out, v_today;
    end if;

    if new.actual_leave_start is distinct from v_old.actual_leave_start
       and new.actual_leave_start > v_today then
        raise exception
            'Actual Leave Start (%) tidak boleh melebihi hari ini (%).',
            new.actual_leave_start, v_today;
    end if;

    if new.actual_leave_end is distinct from v_old.actual_leave_end
       and new.actual_leave_end > v_today then
        raise exception
            'Actual Leave End (%) tidak boleh melebihi hari ini (%).',
            new.actual_leave_end, v_today;
    end if;

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

    -- #12: the return cannot be confirmed before it happens (WITA business date).
    if p_actual_return_date > public.business_date() then
        raise exception
            'Actual Return Date (%) tidak boleh melebihi hari ini (%).',
            p_actual_return_date, public.business_date();
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
