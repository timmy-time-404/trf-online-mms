import { supabase, isSupabaseEnabled } from '@/lib/supabase';

import type {
  User,
  Employee,
  EmployeeType,
  TRF,
  StatusHistory,
  TRFStatus,
  UserRole,
  CreateTRFInput,
  GAProcess,
  GADocument,
  Accommodation,
  TravelArrangement,
  AdminDeptVerify,
  PMApproval
} from '@/types';

import {
  mockUsers,
  mockEmployees,
  mockTRFs
} from '@/mock/data';

/* =====================================================
   DATABASE ROW INTERFACES (100% BEBAS ANY)
===================================================== */
interface DBUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  employee_id?: string;
  department?: string;
}

interface DBEmployeeRow {
  id: string;
  user_id?: string;
  employee_type: string;
  employee_name: string;
  job_title: string;
  department: string;
  section: string;
  email: string;
  phone: string;
  date_of_hire?: string;
  point_of_hire: string;
}

interface DBTRFRow {
  id: string;
  trf_number: string;
  employee_id: string;
  department?: string;
  travel_purpose: string;
  start_date: string;
  end_date: string;
  purpose_remarks?: string;
  status: string;
  accommodation?: Accommodation;
  travel_arrangements?: TravelArrangement[];
  admin_dept_verify?: AdminDeptVerify;
  pm_approval?: PMApproval;
  ga_process?: GAProcess;
  ga_documents?: GADocument[];
  lumpsum_amount?: number;
  lumpsum_currency?: string;
  lumpsum_note?: string;
  lumpsum_input_by?: string;
  lumpsum_input_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

/* =====================================================
   APPROVAL & WORKFLOW LOGIC
===================================================== */

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

  requireStatus(trf.status as TRFStatus, expectedStatus);

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
    oldStatus: trf.status as string,
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
   CREATE & SUBMIT TRF
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
    return transformTRFFromDB(data as DBTRFRow, employees);

  } catch (err) {
    console.error("CREATE TRF ERROR:", err);
    return null;
  }
};

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
   SPECIFIC APPROVAL ACTIONS
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

    requireStatus(trf.status as string, "SUBMITTED");

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

    requireStatus(trf.status as string, "ADMIN_DEPT_VERIFIED");

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

    requireStatus(trf.status as string, "HOD_APPROVED");

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

    requireStatus(trf.status as string, "HR_APPROVED");

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
  voucherDetails: GAProcess['voucherDetails'], 
  remarks: string
): Promise<boolean> => {

  if (!isSupabaseEnabled()) return false;

  try {
    const { data: trf } = await supabase
      .from("trfs")
      .select("*, ga_documents") 
      .eq("id", id)
      .single();

    if (!trf) throw new Error("TRF tidak ditemukan");

    requireStatus(trf.status as string, "PM_APPROVED");

    const gaProcessData: GAProcess = {
      processed: true,
      processedAt: new Date().toISOString(),
      processorId: gaId,
      processorName: gaName,
      voucherDetails: voucherDetails,
      remarksToEmployee: remarks || ""
    };

    const { error: updateError } = await supabase.from("trfs")
      .update({
        status: "GA_PROCESSED",
        ga_process: gaProcessData, 
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateError) throw updateError;

    await addStatusHistory({
      trfId: id,
      changedBy: gaId,
      changedByName: gaName,
      oldStatus: "PM_APPROVED",
      newStatus: "GA_PROCESSED",
      remarks: remarks || "TRF Processed by GA"
    });

    return true;
  } catch (e) {
    console.error("GA Process Error:", e);
    throw e;
  }
};

/* =====================================================
   HR LUMPSUM
===================================================== */

export const saveHRLumpsum = async (
  trfId: string,
  amount: number,
  note: string,
  hrUserId: string
) => {
  if (!isSupabaseEnabled()) return;

  const { error } = await supabase
    .from("trfs")
    .update({
      lumpsum_amount: amount,
      lumpsum_note: note,
      lumpsum_input_by: hrUserId,
      lumpsum_input_at: new Date().toISOString()
    })
    .eq("id", trfId);

  if (error) throw error;
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
      remarks: entry.remarks ?? "System update"
    }]);
};

/* =====================================================
   FETCHERS
===================================================== */

export const getEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseEnabled()) return mockEmployees;

  const { data } = await supabase.from("employees").select("*");
  // Ciptakan barikade tipe untuk meyakinkan TS bahwa tidak ada any yang lewat
  const rows = (data as DBEmployeeRow[]) || [];
  return rows.map(transformEmployeeFromDB);
};

export const getTRFs = async (): Promise<TRF[]> => {
  if (!isSupabaseEnabled()) return mockTRFs;

  const { data } = await supabase
    .from("trfs")
    .select("*, ga_documents") 
    .order("created_at", { ascending: false });

  const employees = await getEmployees();
  const rows = (data as DBTRFRow[]) || [];
  return rows.map(t => transformTRFFromDB(t, employees));
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

  const rows = (data as DBUserRow[]) || [];
  return rows.map(dbUser => ({
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    role: dbUser.role as UserRole,
    employeeId: dbUser.employee_id || undefined,
    department: dbUser.department || undefined
  }));
};

/* =====================================================
   TRANSFORMERS
===================================================== */

const transformEmployeeFromDB = (db: DBEmployeeRow): Employee => ({
  id: db.id,
  userId: db.user_id || undefined,
  employeeType: db.employee_type as EmployeeType,
  employeeName: db.employee_name,
  jobTitle: db.job_title,
  department: db.department,
  section: db.section,
  email: db.email,
  phone: db.phone,
  dateOfHire: db.date_of_hire,
  pointOfHire: db.point_of_hire
});

const transformTRFFromDB = (dbTRF: DBTRFRow, employees: Employee[]): TRF => ({
  id: dbTRF.id,
  trfNumber: dbTRF.trf_number,
  employeeId: dbTRF.employee_id,
  employee: employees.find(e => e.id === dbTRF.employee_id) ?? {
    id: dbTRF.employee_id,
    employeeName: 'Unknown Employee',
    employeeType: 'EMPLOYEE' as EmployeeType,
    jobTitle: '-',
    department: 'Unknown',
    section: '-',
    email: '-',
    phone: '-',
    pointOfHire: '-'
  },
  department: dbTRF.department,
  travelPurpose: dbTRF.travel_purpose,
  startDate: dbTRF.start_date,
  endDate: dbTRF.end_date,
  purposeRemarks: dbTRF.purpose_remarks,
  status: dbTRF.status as TRFStatus,
  accommodation: dbTRF.accommodation,
  travelArrangements: dbTRF.travel_arrangements || [],
  adminDeptVerify: dbTRF.admin_dept_verify,
  pmApproval: dbTRF.pm_approval,
  gaProcess: dbTRF.ga_process,
  
  submittedAt: dbTRF.submitted_at,
  createdAt: dbTRF.created_at,
  updatedAt: dbTRF.updated_at
});

/* =====================================================
   FILE UPLOAD
===================================================== */

export const uploadGAFile = async (
  trfId: string,
  file: File
): Promise<string | null> => {
  const filePath = `${trfId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("trf-documents")
    .upload(filePath, file);

  if (uploadError) {
    console.error(uploadError);
    return null;
  }

  const { data } = supabase.storage
    .from("trf-documents")
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const saveGAFileToTRF = async (
  trfId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileName: string
) => {
  const { data: trf } = await supabase
    .from("trfs")
    .select("*, ga_documents")
    .eq("id", trfId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const existing = trf?.ga_documents || {};
};