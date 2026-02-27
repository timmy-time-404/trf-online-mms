import { supabase, isSupabaseEnabled } from '@/lib/supabase';

import type {
  User,
  Employee,
  TRF,
  StatusHistory,
  TRFStatus,
  UserRole,
  CreateTRFInput,
} from '@/types';

import {
  mockUsers,
  mockEmployees,
  mockTRFs
} from '@/mock/data';

type ApprovalAction = 'APPROVE' | 'REJECT' | 'REVISE';

export const processTRFApproval = async (
  trfId: string,
  role: UserRole,
  userId: string,
  userName: string,
  action: ApprovalAction,
  remarks: string
): Promise<boolean> => {

  requireRemarks(remarks);

const { data: trf, error } = await supabase
  .from("trfs")
  .select("status")
  .eq("id", trfId)
  .single();

if (error) throw error;
if (!trf) throw new Error("TRF tidak ditemukan");

let expectedStatus: TRFStatus;
let nextStatus: TRFStatus = "REJECTED";

switch (role) {
  case "HOD":
    expectedStatus = "ADMIN_DEPT_VERIFIED";
    nextStatus =
      action === "APPROVE" ? "HOD_APPROVED"
      : action === "REVISE" ? "NEEDS_REVISION"
      : "REJECTED";
    break;

    case "HR":
      expectedStatus = "HOD_APPROVED";
      nextStatus =
        action === "APPROVE" ? "HR_APPROVED"
        : action === "REVISE" ? "NEEDS_REVISION"
        : "REJECTED";
      break;

    case "PM":
      expectedStatus = "HR_APPROVED";
      nextStatus =
        action === "APPROVE" ? "PM_APPROVED"
        : "REJECTED";
      break;

    default:
      throw new Error("Role tidak memiliki approval permission");
  }

  requireStatus(trf.status, expectedStatus);

  await supabase
    .from("trfs")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    })
    .eq("id", trfId);

  await addStatusHistory({
    trfId,
    changedBy: userId,
    changedByName: userName,
    oldStatus: trf.status,
    newStatus: nextStatus,
    remarks
  });

  return true;
};
/* =====================================================
   HELPERS
===================================================== */

const requireRemarks = (remarks?: string) => {
  if (!remarks || remarks.trim().length === 0) {
    throw new Error("Remarks wajib diisi");
  }
};

const requireStatus = (current: string, expected: string) => {
  if (current !== expected) {
    throw new Error(`Invalid workflow state. Expected ${expected}`);
  }
};

/* =====================================================
   CREATE TRF
===================================================== */

export const createTRF = async (
  input: CreateTRFInput
): Promise<TRF | null> => {

  if (!isSupabaseEnabled()) return null;

  try {

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('trfs')
      .insert({
        // ⚠️ JANGAN KIRIM ID
        employee_id: input.employeeId,
        department: input.department,
        travel_purpose: input.travelPurpose,
        start_date: input.startDate,
        end_date: input.endDate,
        purpose_remarks: input.purposeRemarks ?? null,
        status: 'DRAFT',
        accommodation: input.accommodation ?? null,
        travel_arrangements: input.travelArrangements ?? [],
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) throw error;

    await addStatusHistory({
      trfId: data.id,
      changedBy: input.employeeId,
      changedByName: "System",
      newStatus: "DRAFT",
      remarks: "TRF created"
    });

    const employees = await getEmployees();
    return transformTRFFromDB(data, employees);

  } catch (err) {
    console.error("CREATE TRF ERROR:", err);
    return null;
  }
};

/* =====================================================
   SUBMIT
===================================================== */

export const submitTRF = async (
  id: string,
  employeeId: string,
  employeeName: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;

  try {

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('trfs')
      .update({
        status: 'SUBMITTED',
        submitted_at: now,
        updated_at: now
      })
      .eq('id', id);

    if (error) throw error;

    await addStatusHistory({
      trfId: id,
      changedBy: employeeId,
      changedByName: employeeName,
      oldStatus: "DRAFT",
      newStatus: "SUBMITTED",
      remarks: "TRF submitted"
    });

    return true;

  } catch (err) {
    console.error(err);
    return false;
  }
};

/* =====================================================
   APPROVAL WORKFLOW (SEQUENTIAL)
===================================================== */

export const verifyTRF = async (
  id: string,
  verifierId: string,
  verifierName: string,
  verified: boolean,
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;
  requireRemarks(remarks);

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("status")
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status, "SUBMITTED");

    const newStatus = verified
      ? "ADMIN_DEPT_VERIFIED"
      : "NEEDS_REVISION";

    await supabase.from("trfs")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    await addStatusHistory({
      trfId: id,
      changedBy: verifierId,
      changedByName: verifierName,
      oldStatus: "SUBMITTED",
      newStatus,
      remarks
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const hodApproveTRF = async (
  id: string,
  hodId: string,
  hodName: string,
  approved: boolean,
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;
  requireRemarks(remarks);

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("status")
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status, "ADMIN_DEPT_VERIFIED");

    const newStatus = approved ? "HOD_APPROVED" : "REJECTED";

    await supabase.from("trfs")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    await addStatusHistory({
      trfId: id,
      changedBy: hodId,
      changedByName: hodName,
      oldStatus: "ADMIN_DEPT_VERIFIED",
      newStatus,
      remarks
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const hrApproveTRF = async (
  id: string,
  hrId: string,
  hrName: string,
  approved: boolean,
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;
  requireRemarks(remarks);

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("status")
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status, "HOD_APPROVED");

    const newStatus = approved ? "HR_APPROVED" : "NEEDS_REVISION";

    await supabase.from("trfs")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    await addStatusHistory({
      trfId: id,
      changedBy: hrId,
      changedByName: hrName,
      oldStatus: "HOD_APPROVED",
      newStatus,
      remarks
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const pmApproveTRF = async (
  id: string,
  pmId: string,
  pmName: string,
  approved: boolean,
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;
  requireRemarks(remarks);

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("status")
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status, "HR_APPROVED");

    const newStatus = approved ? "PM_APPROVED" : "REJECTED";

    await supabase.from("trfs")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    await addStatusHistory({
      trfId: id,
      changedBy: pmId,
      changedByName: pmName,
      oldStatus: "HR_APPROVED",
      newStatus,
      remarks
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const gaProcessTRF = async (
  id: string,
  gaId: string,
  gaName: string,
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;
  requireRemarks(remarks);

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("status")
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status, "PM_APPROVED");

    await supabase.from("trfs")
      .update({
        status: "GA_PROCESSED",
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    await addStatusHistory({
      trfId: id,
      changedBy: gaId,
      changedByName: gaName,
      oldStatus: "PM_APPROVED",
      newStatus: "GA_PROCESSED",
      remarks
    });

    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

/* =====================================================
   STATUS HISTORY
===================================================== */

export const addStatusHistory = async (
  entry: Omit<StatusHistory, 'id' | 'changedAt'>
): Promise<void> => {

  if (!isSupabaseEnabled()) return;

  await supabase
    .from("status_history")
    .insert([{
      trf_id: entry.trfId,
      changed_by: entry.changedBy,
      changed_by_name: entry.changedByName,
      old_status: entry.oldStatus || null,
      new_status: entry.newStatus,

      // ✅ FIX PALING PENTING
      remarks: entry.remarks ?? "System update"
    }]);
};


/* =====================================================
   FETCHERS + TRANSFORMERS
===================================================== */

export const getEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseEnabled()) return mockEmployees;

  const { data } = await supabase.from("employees").select("*");
  return (data || []).map(transformEmployeeFromDB);
};

export const getTRFs = async (): Promise<TRF[]> => {
  if (!isSupabaseEnabled()) return mockTRFs;

  const { data } = await supabase
    .from("trfs")
    .select("*")
    .order("created_at", { ascending: false });

  const employees = await getEmployees();
  return (data || []).map(t => transformTRFFromDB(t, employees));
};
export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseEnabled()) return mockUsers;

  const { data, error } = await supabase
    .from("users")
    .select("*");

  if (error) {
    console.error("Error fetching users:", error);
    return mockUsers;
  }

  return (data || []).map((dbUser: any) => ({
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    role: dbUser.role as UserRole,
    employeeId: dbUser.employee_id,
    department: dbUser.department
  }));
};
/* =====================================================
   TRANSFORMERS
===================================================== */

const transformEmployeeFromDB = (db: any): Employee => ({
  id: db.id,
  userId: db.user_id || null,
  employeeType: db.employee_type,
  employeeName: db.employee_name,
  jobTitle: db.job_title,
  department: db.department,
  section: db.section,
  email: db.email,
  phone: db.phone,
  dateOfHire: db.date_of_hire,
  pointOfHire: db.point_of_hire
});

const transformTRFFromDB = (db: any, employees: Employee[]): TRF => ({
  id: db.id,
  trfNumber: db.trf_number,
  employeeId: db.employee_id,
  
  // ✅ REVISI: Fallback object jika data employee belum ter-load atau tidak ditemukan
  employee: employees.find(e => e.id === db.employee_id) ?? {
    id: db.employee_id,
    employeeName: 'Unknown Employee',
    employeeType: 'EMPLOYEE'
  },
  
  department: db.department,
  travelPurpose: db.travel_purpose,
  startDate: db.start_date,
  endDate: db.end_date,
  purposeRemarks: db.purpose_remarks,
  status: db.status,
  accommodation: db.accommodation,
  travelArrangements: db.travel_arrangements || [],
  adminDeptVerify: db.admin_dept_verify,
  pmApproval: db.pm_approval,
  gaProcess: db.ga_process,
  submittedAt: db.submitted_at,
  createdAt: db.created_at,
  updatedAt: db.updated_at
});