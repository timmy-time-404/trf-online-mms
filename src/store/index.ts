// TRF Online System - Zustand Store with Supabase Integration

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import bcrypt from "bcryptjs";
import type { 
  User, 
  UserRole, 
  TRF, 
  TRFStatus, 
  Employee,
  EmployeeType,
  StatusHistory,
  CreateTRFInput,
  UpdateTRFInput,
  Accommodation,
  TravelArrangement,
  AdminDeptVerify,
  PMApproval,
  GAProcess
} from '@/types';

// ✅ MOCK DATA IMPORT TELAH DIBUMI-HANGUSKAN DARI SINI!

import { getNextStatus, type WorkflowAction } from '@/workflow/trfWorkflow';

// ============================================
// DATABASE ROW & PAYLOAD INTERFACES
// ============================================

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
  parallel_approval?: unknown; 
  pm_approval?: PMApproval;
  ga_process?: GAProcess;
  ga_documents?: Record<string, unknown>;
  lumpsum_amount?: number;
  lumpsum_currency?: string;
  lumpsum_note?: string;
  lumpsum_input_by?: string;
  lumpsum_input_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

interface LocationRow {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

interface EmployeePayload {
  employeeName: string;
  employeeCode?: string;
  department: string;
  section: string;
  jobTitle: string;
  email: string;
  phone: string;
}

interface UserPayload {
  username: string;
  email: string;
  role: string;
  department?: string;
  employee_id?: string;
}

// ============================================
// TRANSFORMERS
// ============================================
const transformUserFromDB = (dbUser: DBUserRow): User => ({
  id: dbUser.id,
  username: dbUser.username,
  email: dbUser.email,
  role: dbUser.role as UserRole,
  employeeId: dbUser.employee_id,
  department: dbUser.department
});

const transformEmployeeFromDB = (dbEmp: DBEmployeeRow): Employee => ({
  id: dbEmp.id,
  userId: dbEmp.user_id || undefined,
  employeeType: dbEmp.employee_type as EmployeeType,
  employeeName: dbEmp.employee_name,
  jobTitle: dbEmp.job_title,
  department: dbEmp.department,
  section: dbEmp.section,
  email: dbEmp.email,
  phone: dbEmp.phone,
  dateOfHire: dbEmp.date_of_hire,
  pointOfHire: dbEmp.point_of_hire
});

const transformTRFFromDB = (dbTRF: DBTRFRow, employees: Employee[]): TRF => {
  return {
    id: dbTRF.id,
    trfNumber: dbTRF.trf_number,
    employeeId: dbTRF.employee_id,
    employee: employees.find(e => e.id === dbTRF.employee_id) ?? {
      id: dbTRF.employee_id,
      employeeName: 'Unknown Employee',
      employeeType: 'EMPLOYEE',
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
    parallelApproval: dbTRF.parallel_approval as TRF['parallelApproval'],
    pmApproval: dbTRF.pm_approval,
    gaProcess: dbTRF.ga_process,
    lumpsumAmount: dbTRF.lumpsum_amount,
    lumpsumCurrency: dbTRF.lumpsum_currency,
    lumpsumNote: dbTRF.lumpsum_note,
    lumpsumInputBy: dbTRF.lumpsum_input_by,
    lumpsumInputAt: dbTRF.lumpsum_input_at,
    gaDocuments: (dbTRF.ga_documents ?? {}) as Record<string, GADocument>, 
    submittedAt: dbTRF.submitted_at,
    createdAt: dbTRF.created_at,
    updatedAt: dbTRF.updated_at
  };
};

// ============================================
// AUTH STORE
// ============================================

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  loadUserFromSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: true,

      login: (user) => set({ currentUser: user, isAuthenticated: true, isLoading: false }),
      
      logout: () => {
        if (isSupabaseEnabled()) {
          supabase.auth.signOut();
        }
        set({ currentUser: null, isAuthenticated: false, isLoading: false });
      },
      
      switchRole: (role) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, role } : null
      })),

      loadUserFromSession: async () => {
        if (!isSupabaseEnabled()) {
          set({ isLoading: false });
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userData) {
            set({
              currentUser: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                role: userData.role as UserRole,
                employeeId: userData.employee_id,
                department: userData.department
              },
              isAuthenticated: true,
              isLoading: false
            });
          }
        } else {
          set({ isLoading: false });
        }
      }
    }),
    { name: 'trf-auth-storage' }
  )
);

export interface GADocument {
  url: string;
  name: string;
}

// ============================================
// TRF STORE
// ============================================

interface TRFState {
  trfs: TRF[];
  statusHistory: StatusHistory[];
  employees: Employee[];
  users: User[];
  // ✅ Tipe referensi diamankan
  referenceData: Record<string, unknown>;
  isLoading: boolean;
  
  referenceMaster: {
    departments: string[];
    purposes: string[];
    transports: string[];
    accommodations: string[];
  };
  fetchReferenceMaster: () => Promise<void>;
  
  searchLocations: (keyword: string, type: string) => Promise<LocationRow[]>;
  fetchAllData: () => Promise<void>;
  forceRefreshTRFs: () => Promise<void>; 
  
  fetchEmployees: () => Promise<void>;
  createEmployee: (payload: EmployeePayload) => Promise<void>;
  updateEmployee: (id: string, payload: Partial<EmployeePayload>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  
  fetchTRFs: () => Promise<void>;
  
  getTRFById: (id: string) => TRF | undefined;
  getTRFsByEmployee: (employeeId: string) => TRF[];
  getTRFsByStatus: (status: TRFStatus) => TRF[];
  getTRFsByDepartment: (department: string) => TRF[];
  createTRF: (input: CreateTRFInput) => Promise<TRF | null>;
  updateTRF: (id: string, input: UpdateTRFInput) => Promise<boolean>;
  deleteTRF: (id: string, hardDelete?: boolean) => Promise<boolean>;
  getVisibleTRFs: (user: User) => TRF[];
  getTRFsForVerification: (department: string) => TRF[];
  getTRFsForApproval: (role: UserRole, department?: string) => TRF[];
  getTRFsForProcessing: () => TRF[];
  getPendingApprovals: () => TRF[];
  submitTRF: (
    id: string,
    changedBy: string,
    changedByName: string
  ) => Promise<boolean>;  
  getStatusHistory: (trfId: string) => StatusHistory[];
  addStatusHistory: (entry: Omit<StatusHistory, 'id' | 'changedAt'>) => Promise<void>;
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeesByType: (type: 'EMPLOYEE' | 'VISITOR') => Employee[];
  getUserById: (id: string) => User | undefined;
  handleVerify: (trfId: string, currentUser: User, action: WorkflowAction, remarks?: string) => Promise<boolean>;
  handleApproval: (trfId: string, currentUser: User, action: WorkflowAction, remarks?: string) => Promise<boolean>;
  
  fetchUsers: () => Promise<void>;
  createUser: (payload: UserPayload) => Promise<void>;
  updateUser: (id: string, payload: Partial<UserPayload>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

export const useTRFStore = create<TRFState>()(
  persist(
    (set, get) => ({
      // ✅ STATE AWAL BERSIH DARI MOCK DATA
      trfs: [],
      statusHistory: [],
      employees: [],
      users: [],
      referenceData: {},
      isLoading: false,

      referenceMaster: {
        departments: [],
        purposes: [],
        transports: [],
        accommodations: []
      },

      fetchReferenceMaster: async () => {
        if (!isSupabaseEnabled()) return;

        const { data, error } = await supabase
          .from("reference_master")
          .select("*")
          .eq("is_active", true);

        if (error) {
          console.error("Reference load error:", error);
          return;
        }

        const grouped = {
          departments: [] as string[],
          purposes: [] as string[],
          transports: [] as string[],
          accommodations: [] as string[]
        };

        data?.forEach((item) => {
          switch (item.category) {
            case "DEPARTMENT":
              grouped.departments.push(item.name);
              break;
            case "TRAVEL_PURPOSE":
              grouped.purposes.push(item.name);
              break;
            case "TRANSPORT":
              grouped.transports.push(item.name);
              break;
            case "ACCOMMODATION":
              grouped.accommodations.push(item.name);
              break;
          }
        });

        set({ referenceMaster: grouped });
      },

      searchLocations: async (keyword: string, type: string) => {
        if (!isSupabaseEnabled()) return [];

        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .ilike("name", `%${keyword}%`)
          .eq("type", type)
          .limit(10);

        if (error) {
          console.error("Search locations error:", error);
          return [];
        }

        return (data as LocationRow[]) || [];
      },

      fetchAllData: async () => {
        if (!isSupabaseEnabled()) return;
        set({ isLoading: true });
        try {
          await get().fetchReferenceMaster();
          await get().fetchEmployees();
          await get().fetchTRFs();
          await get().fetchUsers();
        } catch (error) {
          console.error("Fetch all data error:", error);
        } finally {
          set({ isLoading: false });
        }
      },

      forceRefreshTRFs: async () => {
        await get().fetchTRFs();
        set({ trfs: [...get().trfs] });
      },

      // ============================================
      // EMPLOYEE MANAGEMENT
      // ============================================

      fetchEmployees: async () => {
        if (!isSupabaseEnabled()) return;
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .eq('is_active', true)
          .order('employee_name'); 

        if (error) {
          console.error('Error fetching employees:', error);
          return;
        }

        if (data) {
          const rows = data as DBEmployeeRow[];
          set({ employees: rows.map(transformEmployeeFromDB) });
        }
      },

      createEmployee: async (payload) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('employees')
          .insert({
            employee_name: payload.employeeName,
            employee_code: payload.employeeCode,
            department: payload.department,
            section: payload.section,
            job_title: payload.jobTitle,
            email: payload.email,
            phone: payload.phone
          });

        if (error) throw error;
        await get().fetchEmployees();
      },

      updateEmployee: async (id, payload) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('employees')
          .update({
            employee_name: payload.employeeName,
            department: payload.department,
            section: payload.section,
            job_title: payload.jobTitle,
            email: payload.email,
            phone: payload.phone
          })
          .eq('id', id);

        if (error) throw error;
        await get().fetchEmployees();
      },

      deleteEmployee: async (id) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('employees')
          .update({ is_active: false })
          .eq('id', id);

        if (error) throw error;
        await get().fetchEmployees();
      },

      // ============================================
      // TRF MANAGEMENT
      // ============================================

      fetchTRFs: async () => {
        if (!isSupabaseEnabled()) return;
        const { data, error } = await supabase.from('trfs').select('*').order('created_at', { ascending: false });
        
        if (error) {
          console.error("Fetch TRFs error:", error);
          return;
        }
        
        if (data) {
          const rows = data as DBTRFRow[];
          const employees = get().employees;
          set({ trfs: rows.map(trf => transformTRFFromDB(trf, employees)) });
        }
      },

      getTRFById: (id) => {
        const trf = get().trfs.find((t) => t.id === id);
        return trf ? { ...trf, employee: get().employees.find((e) => e.id === trf.employeeId) } : undefined;
      },

      getTRFsByEmployee: (employeeId) => {
        return get().trfs.filter((t) => t.employeeId === employeeId).map(t => ({...t, employee: get().employees.find((e) => e.id === t.employeeId)}));
      },

      getTRFsByStatus: (status) => {
        return get().trfs.filter((t) => t.status === status).map(t => ({...t, employee: get().employees.find((e) => e.id === t.employeeId)}));
      },

      getTRFsByDepartment: (department) => {
        return get().trfs.filter((t) => t.department === department).map(t => ({...t, employee: get().employees.find((e) => e.id === t.employeeId)}));
      },

      createTRF: async (trfData) => {
        if (!isSupabaseEnabled()) return null;
        const employee = get().employees.find(e => e.id === trfData.employeeId);
        const department = employee?.department ?? null;

        const { data, error } = await supabase
          .from('trfs')
          .insert([{
            employee_id: trfData.employeeId,
            department: department,
            travel_purpose: trfData.travelPurpose,
            start_date: trfData.startDate,
            end_date: trfData.endDate,
            purpose_remarks: trfData.purposeRemarks || null,
            status: 'SUBMITTED',
            accommodation: trfData.accommodation || null,
            travel_arrangements: trfData.travelArrangements || []
          }])
          .select().single();

        if (error || !data) return null;

        const row = data as DBTRFRow;

        const newTRF: TRF = {
          ...trfData,
          id: row.id,
          department: department || undefined, 
          trfNumber: row.trf_number,
          status: 'SUBMITTED', 
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          travelArrangements: trfData.travelArrangements || []
        };

        set((state) => ({ trfs: [newTRF, ...state.trfs] }));
        await get().addStatusHistory({ trfId: row.id, changedBy: trfData.employeeId, changedByName: "System", newStatus: "SUBMITTED", remarks: "TRF created" });
        return newTRF;
      },

      updateTRF: async (id, updates) => {
        if (!isSupabaseEnabled()) return false;
        await supabase.from('trfs').update({
          travel_purpose: updates.travelPurpose, start_date: updates.startDate, end_date: updates.endDate,
          purpose_remarks: updates.purposeRemarks, accommodation: updates.accommodation,
          travel_arrangements: updates.travelArrangements, status: updates.status
        }).eq('id', id);
        return true;
      },

      deleteTRF: async (id) => {
        if (!isSupabaseEnabled()) return false;
        await supabase.from('trfs').delete().eq('id', id);
        return true;
      },

      getVisibleTRFs: (user) => {
        let filtered = get().trfs;
        if (user.role === 'EMPLOYEE') filtered = get().getTRFsByEmployee(user.employeeId!);
        if (user.role === 'ADMIN_DEPT' || user.role === 'HOD') filtered = get().getTRFsByDepartment(user.department!);
        return filtered.map(t => ({...t, employee: get().employees.find(e => e.id === t.employeeId)}));
      },

      getTRFsForVerification: (department: string) => {
        return get().trfs.filter(t => t.department === department && t.status === 'SUBMITTED')
          .map(t => ({...t, employee: get().employees.find(e => e.id === t.employeeId)}));
      },

      getTRFsForApproval: (role: UserRole, department?: string) => {
        return get().trfs.filter((trf) => {
          if (role === 'HOD') return trf.status === 'PENDING_APPROVAL' && trf.department === department;
          if (role === 'HR') return trf.status === 'HOD_APPROVED';
          if (role === 'PM') return trf.status === 'HR_APPROVED';
          return false;
        }).map(t => ({...t, employee: get().employees.find(e => e.id === t.employeeId)}));
      },

      getTRFsForProcessing: () => {
        return get().trfs.filter((t) => t.status === 'PM_APPROVED')
          .map(t => ({...t, employee: get().employees.find(e => e.id === t.employeeId)}));
      },

      handleVerify: async (trfId: string, currentUser: User, action: WorkflowAction, remarks?: string) => {
        const trf = get().trfs.find((t) => t.id === trfId);
        if (!trf) return false;

        try {
          const nextStatus = getNextStatus(trf.status, currentUser.role, action as Parameters<typeof getNextStatus>[2]);
          
          await supabase.from('trfs').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', trfId);
          await get().addStatusHistory({ trfId, changedBy: currentUser.id, changedByName: 
            currentUser.username, oldStatus: trf.status, newStatus: nextStatus, remarks: remarks || `Verified by ${currentUser.role}` });
          
          await get().fetchAllData();
          return true;
        } catch (error) {
          console.error("Verify Error:", error);
          return false;
        }
      },

      handleApproval: async (trfId: string, currentUser: User, action: WorkflowAction, remarks?: string) => {
        const trf = get().trfs.find((t) => t.id === trfId);
        if (!trf) return false;

        try {
          const nextStatus = getNextStatus(trf.status, currentUser.role, action as Parameters<typeof getNextStatus>[2]);
          await supabase.from('trfs').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', trfId);
          await get().addStatusHistory({ trfId, changedBy: currentUser.id, changedByName: currentUser.username,
            oldStatus: trf.status, newStatus: nextStatus, remarks: remarks || `${action} by ${currentUser.role}` });
          
          await get().fetchAllData();
          return true;
        } catch (error) {
          console.error("Workflow Error:", error);
          return false;
        }
      },

      // ============================================
      // USER MANAGEMENT (SUPER ADMIN)
      // ============================================

      fetchUsers: async () => {
        if (!isSupabaseEnabled()) return;
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const rows = data as DBUserRow[];
          const formattedUsers = rows.map(transformUserFromDB);
          set({ users: formattedUsers });
        }
      },

      createUser: async (payload) => {
        if (!isSupabaseEnabled()) return;

        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', payload.email)
          .maybeSingle();

        if (existing) {
          throw new Error("Email sudah memiliki akun");
        }

        const templatePassword = "mmspanicsmp123!";
        const password_hash = await bcrypt.hash(templatePassword, 10);

        const { error } = await supabase
          .from("users")
          .insert({
            username: payload.username,
            email: payload.email,
            role: payload.role,
            department: payload.department ?? null,
            employee_id: payload.employee_id ?? null,
            password_hash,
            must_change_password: true,
            is_active: true
          });

        if (error) throw error;
        await get().fetchUsers();
      },

      updateUser: async (id, payload) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('users')
          .update({
            username: payload.username,
            email: payload.email,
            role: payload.role,
            department: payload.department,
            employee_id: payload.employee_id
          })
          .eq('id', id);

        if (error) throw error;
        await get().fetchUsers();
      },

      deleteUser: async (id) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('users')
          .update({ is_active: false })
          .eq('id', id);

        if (error) throw error;
        await get().fetchUsers();
      },

      getPendingApprovals: () => [],
      submitTRF: async () => false,

      getStatusHistory: (trfId) => {
        return get().statusHistory.filter((sh) => sh.trfId === trfId).sort((a, b) => new Date(b.changedAt || '').getTime() - new Date(a.changedAt || '').getTime());
      },

      addStatusHistory: async (entry) => {
        if (!isSupabaseEnabled()) return;
        await supabase.from('status_history').insert([{
          trf_id: entry.trfId, changed_by: entry.changedBy, changed_by_name: entry.changedByName,
          old_status: entry.oldStatus, new_status: entry.newStatus, remarks: entry.remarks
        }]);
      },

      getEmployeeById: (id) => get().employees.find((e) => e.id === id),
      getEmployeesByType: (type) => get().employees.filter((e) => e.employeeType === type),
      getUserById: (id) => get().users.find((u) => u.id === id)
    }),
    { name: 'trf-storage' }
  )
);

// ============================================
// DASHBOARD STORE
// ============================================

interface DashboardState {
  stats: {
    totalTravelIn: number;
    totalTravelOut: number;
    siteEntry: number;
    onSiteActive: number;
  };
  roomAvailability: {
    hotelName: string;
    total: number;
    occupied: number;
    available: number;
  }[];
  weeklyTravel: {
    day: string;
    travelIn: number;
    travelOut: number;
  }[];
}

export const useDashboardStore = create<DashboardState>()(() => ({
  stats: {
    totalTravelIn: 156,
    totalTravelOut: 142,
    siteEntry: 23,
    onSiteActive: 89
  },
  roomAvailability: [
    { hotelName: 'Grand Mining Hotel', total: 120, occupied: 98, available: 22 },
    { hotelName: 'Camp Residence', total: 80, occupied: 45, available: 35 },
    { hotelName: 'Site C Camp', total: 60, occupied: 52, available: 8 },
    { hotelName: 'City Center Hotel', total: 40, occupied: 28, available: 12 }
  ],
  weeklyTravel: [
    { day: 'Mon', travelIn: 12, travelOut: 8 },
    { day: 'Tue', travelIn: 15, travelOut: 10 },
    { day: 'Wed', travelIn: 8, travelOut: 12 },
    { day: 'Thu', travelIn: 20, travelOut: 15 },
    { day: 'Fri', travelIn: 18, travelOut: 14 },
    { day: 'Sat', travelIn: 5, travelOut: 6 },
    { day: 'Sun', travelIn: 3, travelOut: 4 }
  ]
}));