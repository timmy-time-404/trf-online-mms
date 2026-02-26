// store/supabaseStore.ts - Supabase operations
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { 
  User, 
  Employee, 
  TRF, 
  StatusHistory,
  TRFStatus 
} from '@/types';
import { mockUsers, mockEmployees, mockTRFs, mockStatusHistory } from '@/mock/data';

// ============================================
// USERS
// ============================================

export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseEnabled()) return mockUsers;

  const { data, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
    return mockUsers;
  }

  return data.map(transformUserFromDB) || [];
};

export const getUserById = async (id: string): Promise<User | null> => {
  if (!isSupabaseEnabled()) {
    return mockUsers.find(u => u.id === id) || null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data ? transformUserFromDB(data) : null;
};

// ============================================
// EMPLOYEES
// ============================================

export const getEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseEnabled()) return mockEmployees;

  const { data, error } = await supabase
    .from('employees')
    .select('*');

  if (error) {
    console.error('Error fetching employees:', error);
    return mockEmployees;
  }

  return data.map(transformEmployeeFromDB) || [];
};

export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  if (!isSupabaseEnabled()) {
    return mockEmployees.find(e => e.id === id) || null;
  }

  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data ? transformEmployeeFromDB(data) : null;
};

// ============================================
// TRFS
// ============================================

export const getTRFs = async (): Promise<TRF[]> => {
  if (!isSupabaseEnabled()) return mockTRFs;

  const { data, error } = await supabase
    .from('trfs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching TRFs:', error);
    return mockTRFs;
  }

  // Fetch employees for relation
  const employees = await getEmployees();
  
  return (data || []).map(trf => transformTRFFromDB(trf, employees));
};

export const getTRFById = async (id: string): Promise<TRF | null> => {
  if (!isSupabaseEnabled()) {
    return mockTRFs.find(t => t.id === id) || null;
  }

  const { data, error } = await supabase
    .from('trfs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;

  const employees = await getEmployees();
  return data ? transformTRFFromDB(data, employees) : null;
};

export const createTRF = async (trf: Omit<TRF, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt' | 'status'>): Promise<TRF | null> => {
  if (!isSupabaseEnabled()) {
    // Mock mode - use local store
    return null;
  }

  const { data, error } = await supabase
    .from('trfs')
    .insert([{
      employee_id: trf.employeeId,
      department: trf.department,
      travel_purpose: trf.travelPurpose,
      start_date: trf.startDate,
      end_date: trf.endDate,
      purpose_remarks: trf.purposeRemarks,
      status: 'DRAFT',
      accommodation: trf.accommodation,
      travel_arrangements: trf.travelArrangements
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating TRF:', error);
    return null;
  }

  const employees = await getEmployees();
  return data ? transformTRFFromDB(data, employees) : null;
};

export const updateTRFStatus = async (
  id: string, 
  status: TRFStatus, 
  updates: Partial<TRF>
): Promise<boolean> => {
  if (!isSupabaseEnabled()) return false;

  const dbUpdates: any = { status };
  
  if (updates.adminDeptVerify) dbUpdates.admin_dept_verify = updates.adminDeptVerify;
  if (updates.parallelApproval) dbUpdates.parallel_approval = updates.parallelApproval;
  if (updates.pmApproval) dbUpdates.pm_approval = updates.pmApproval;
  if (updates.gaProcess) dbUpdates.ga_process = updates.gaProcess;
  if (updates.submittedAt) dbUpdates.submitted_at = updates.submittedAt;

  const { error } = await supabase
    .from('trfs')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('Error updating TRF:', error);
    return false;
  }

  return true;
};

// ============================================
// STATUS HISTORY
// ============================================

export const addStatusHistory = async (entry: Omit<StatusHistory, 'id' | 'changedAt'>): Promise<void> => {
  if (!isSupabaseEnabled()) return;

  const { error } = await supabase
    .from('status_history')
    .insert([{
      trf_id: entry.trfId,
      changed_by: entry.changedBy,
      changed_by_name: entry.changedByName,
      old_status: entry.oldStatus,
      new_status: entry.newStatus,
      remarks: entry.remarks
    }]);

  if (error) {
    console.error('Error adding status history:', error);
  }
};

// ============================================
// TRANSFORMERS (DB → App Types)
// ============================================

const transformUserFromDB = (dbUser: any): User => ({
  id: dbUser.id,
  username: dbUser.username,
  email: dbUser.email,
  role: dbUser.role,
  employeeId: dbUser.employee_id,
  department: dbUser.department
});

const transformEmployeeFromDB = (dbEmp: any): Employee => ({
  id: dbEmp.id,
  userId: dbEmp.user_id,
  employeeType: dbEmp.employee_type,
  employeeName: dbEmp.employee_name,
  jobTitle: dbEmp.job_title,
  department: dbEmp.department,
  section: dbEmp.section,
  email: dbEmp.email,
  phone: dbEmp.phone,
  dateOfHire: dbEmp.date_of_hire,
  pointOfHire: dbEmp.point_of_hire
});

const transformTRFFromDB = (dbTRF: any, employees: Employee[]): TRF => {
  const employee = employees.find(e => e.id === dbTRF.employee_id);
  
  return {
    id: dbTRF.id,
    trfNumber: dbTRF.trf_number,
    employeeId: dbTRF.employee_id,
    employee,
    department: dbTRF.department,
    travelPurpose: dbTRF.travel_purpose,
    startDate: dbTRF.start_date,
    endDate: dbTRF.end_date,
    purposeRemarks: dbTRF.purpose_remarks,
    status: dbTRF.status as TRFStatus,
    accommodation: dbTRF.accommodation,
    travelArrangements: dbTRF.travel_arrangements || [],
    adminDeptVerify: dbTRF.admin_dept_verify,
    parallelApproval: dbTRF.parallel_approval,
    pmApproval: dbTRF.pm_approval,
    gaProcess: dbTRF.ga_process,
    submittedAt: dbTRF.submitted_at,
    createdAt: dbTRF.created_at,
    updatedAt: dbTRF.updated_at
  };
};