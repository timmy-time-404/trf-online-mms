import { create } from 'zustand';
import { apiRequest } from '@/api/client';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import {
  clearAppSessionToken,
  getCurrentAppSession,
  logoutAppSession,
} from '@/lib/appSession';
import bcrypt from 'bcryptjs';
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
  TravelArrangement,
} from '@/types';

import { findNextActiveStatus, type WorkflowAction, type LumpsumInput } from '@trf/shared';

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
  is_active?: boolean;
}

interface DBEmployeeRow {
  id: string;
  user_id?: string;
  employee_code: string;
  employee_type?: string; // kolom ini TIDAK ada di skema DB asli, selalu undefined
  employee_name: string;
  job_title: string;
  department: string;
  section: string;
  email?: string; // kolom ini TIDAK ada di skema DB asli, selalu undefined
  phone: string;
  join_date?: string; // nama kolom asli di DB (bukan date_of_hire)
  point_of_hire: string;
  employee_level?: string;
}

export interface LocationRow {
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
  is_active?: boolean;
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
  department: dbUser.department,
  is_active: dbUser.is_active,
});

const transformEmployeeFromDB = (dbEmp: DBEmployeeRow): Employee => ({
  id: dbEmp.id,
  userId: dbEmp.user_id || undefined,
  employeeCode: dbEmp.employee_code,
  employeeType: (dbEmp.employee_type as EmployeeType) || 'EMPLOYEE',
  employeeName: dbEmp.employee_name,
  jobTitle: dbEmp.job_title,
  department: dbEmp.department,
  section: dbEmp.section,
  email: dbEmp.email ?? '',
  phone: dbEmp.phone,
  dateOfHire: dbEmp.join_date,
  pointOfHire: dbEmp.point_of_hire,
  employeeLevel: dbEmp.employee_level,
});

// ============================================
// AUTH STORE
// ============================================

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  invalidateSession: () => void;
  switchRole: (role: UserRole) => void;
  loadUserFromSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: true,

      login: (user) => {
        useTRFStore.setState({ trfs: [], employees: [], users: [], statusHistory: [] });
        set({
          currentUser: user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: async () => {
        try {
          await logoutAppSession();
        } catch (error) {
          console.warn(
            'Server logout failed:',
            error,
          );
        } finally {
          clearAppSessionToken();
          useTRFStore.setState({ trfs: [], employees: [], users: [], statusHistory: [] });

          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      /*
       * Dipanggil oleh handler session pusat ketika salah satu
       * authenticated Edge Function mengembalikan HTTP 401.
       * Tidak memanggil app-logout lagi karena session server
       * sudah invalid/revoked/expired.
       */
      invalidateSession: () => {
        clearAppSessionToken();
        useTRFStore.setState({ trfs: [], employees: [], users: [], statusHistory: [] });

        set({
          currentUser: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      /*
       * Dipertahankan sementara agar MainLayout lama tetap build.
       * Jangan gunakan role switcher untuk authorization.
       * Edge Function tetap menentukan role dari server session.
       */
      switchRole: () => {
        console.warn(
          'Client-side role switching is disabled.',
        );
      },

      loadUserFromSession: async () => {
        set({ isLoading: true });

        try {
          const session =
            await getCurrentAppSession();

          set({
            currentUser: session.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          clearAppSessionToken();

          set({
            currentUser: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'trf-auth-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated:
          state.isAuthenticated,
      }),
    },
  ),
);


// ============================================
// TRF STORE
// ============================================

interface TRFState {
  trfs: TRF[];
  statusHistory: StatusHistory[];
  employees: Employee[];
  users: User[];
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
  updateEmployee: (
    id: string,
    payload: Partial<EmployeePayload>,
  ) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  fetchTRFs: () => Promise<void>;

  getTRFById: (id: string) => TRF | undefined;
  getTRFsByEmployee: (employeeId: string) => TRF[];
  getTRFsByStatus: (status: TRFStatus) => TRF[];
  getTRFsByDepartment: (department: string) => TRF[];
  createTRF: (input: CreateTRFInput) => Promise<TRF | null>;
  updateTRF: (id: string, input: UpdateTRFInput) => Promise<boolean>;
  resubmitTRF: (
  id: string,
  changedBy: string,
  changedByName: string,
  updates: UpdateTRFInput,
) => Promise<boolean>;
  deleteTRF: (id: string, hardDelete?: boolean) => Promise<boolean>;
  editAndApproveTRF: (
    id: string,
    currentUser: User,
    updates: UpdateTRFInput,
    note: string,
    lumpsum?: LumpsumInput,
  ) => Promise<boolean>;
  getVisibleTRFs: (user: User) => TRF[];
  getTRFsForVerification: (department: string) => TRF[];
  getTRFsForApproval: (role: UserRole, department?: string) => TRF[];
  getTRFsForProcessing: () => TRF[];
  getPendingApprovals: () => TRF[];
  submitTRF: (
    id: string,
    changedBy: string,
    changedByName: string,
  ) => Promise<boolean>;
  getStatusHistory: (trfId: string) => StatusHistory[];
  addStatusHistory: (
    entry: Omit<StatusHistory, 'id' | 'changedAt'>,
  ) => Promise<void>;
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeesByType: (type: 'EMPLOYEE' | 'VISITOR') => Employee[];
  getUserById: (id: string) => User | undefined;
  handleVerify: (
    trfId: string,
    currentUser: User,
    action: WorkflowAction,
    remarks?: string,
  ) => Promise<boolean>;
  handleApproval: (
    trfId: string,
    currentUser: User,
    action: WorkflowAction,
    remarks?: string,
    lumpsum?: LumpsumInput,
  ) => Promise<boolean>;

  findNextActiveStatus: (
    targetStatus: string,
    trfDepartment?: string,
  ) => TRFStatus;

  fetchUsers: () => Promise<void>;
  createUser: (payload: UserPayload) => Promise<void>;
  updateUser: (id: string, payload: Partial<UserPayload>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  enableUser: (id: string) => Promise<void>;
}

export const useTRFStore = create<TRFState>()(
  persist(
    (set, get) => ({
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
        accommodations: [],
      },

      fetchReferenceMaster: async () => {
        if (!isSupabaseEnabled()) return;

        const { data, error } = await supabase
          .from('reference_master')
          .select('*')
          .eq('is_active', true);

        if (error) {
          console.error('Reference load error:', error);
          return;
        }

        const grouped = {
          departments: [] as string[],
          purposes: [] as string[],
          transports: [] as string[],
          accommodations: [] as string[],
        };

        data?.forEach((item) => {
          switch (item.category) {
            case 'DEPARTMENT':
              grouped.departments.push(item.name);
              break;
            case 'TRAVEL_PURPOSE':
              grouped.purposes.push(item.name);
              break;
            case 'TRANSPORT':
              grouped.transports.push(item.name);
              break;
            case 'ACCOMMODATION':
              grouped.accommodations.push(item.name);
              break;
          }
        });

        set({ referenceMaster: grouped });
      },

      searchLocations: async (keyword: string, type: string) => {
        if (!isSupabaseEnabled()) return [];

        const { data, error } = await supabase
          .from('locations')
          .select('*')
          .ilike('name', `%${keyword}%`)
          .eq('type', type)
          .limit(10);

        if (error) {
          console.error('Search locations error:', error);
          return [];
        }

        return (data as LocationRow[]) || [];
      },

      fetchAllData: async () => {
        if (import.meta.env.VITE_API_BASE_URL) {
          set({ isLoading: true });
          try { await get().fetchTRFs(); } finally { set({ isLoading: false }); }
          return;
        }
        if (!isSupabaseEnabled()) return;
        set({ isLoading: true });
        try {
          await get().fetchReferenceMaster();
          await get().fetchEmployees();
          await get().fetchTRFs();
          await get().fetchUsers();
        } catch (error) {
          console.error('Fetch all data error:', error);
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
        const { error } = await supabase.from('employees').insert({
          employee_name: payload.employeeName,
          employee_code: payload.employeeCode,
          department: payload.department,
          section: payload.section,
          job_title: payload.jobTitle,
          phone: payload.phone,
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
            phone: payload.phone,
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
        const userId = useAuthStore.getState().currentUser?.id;
        const [trfs, context] = await Promise.all([
          apiRequest<TRF[]>('/trfs'),
          apiRequest<{ employees: Employee[] }>('/trfs/context'),
        ]);
        if (useAuthStore.getState().currentUser?.id !== userId) return;
        const employees = new Map(context.employees.map((employee) => [employee.id, employee]));
        for (const trf of trfs) if (trf.employee) employees.set(trf.employee.id, trf.employee);
        set({ trfs, employees: [...employees.values()] });
      },

      getTRFById: (id) => {
        const trf = get().trfs.find((t) => t.id === id);
        return trf
          ? {
              ...trf,
              employee: trf.employee ?? get().employees.find((e) => e.id === trf.employeeId),
            }
          : undefined;
      },

      getTRFsByEmployee: (employeeId) => {
        return get()
          .trfs.filter((t) => t.employeeId === employeeId)
          .map((t) => ({
            ...t,
            employee: t.employee ?? get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsByStatus: (status) => {
        return get()
          .trfs.filter((t) => t.status === status)
          .map((t) => ({
            ...t,
            employee: t.employee ?? get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsByDepartment: (department) => {
        const normalizedDepartment =
          department
            ?.trim()
            .toLocaleLowerCase('id-ID') ??
          '';

        if (!normalizedDepartment) {
          return [];
        }

        return get()
          .trfs.filter(
            (trf) =>
              (
                trf.department
                  ?.trim()
                  .toLocaleLowerCase(
                    'id-ID',
                  ) ?? ''
              ) ===
              normalizedDepartment,
          )
          .map((trf) => ({
            ...trf,
            employee: get().employees.find(
              (employee) =>
                employee.id ===
                trf.employeeId,
            ),
          }));
      },

      createTRF: async (trfData) => {
        const userId = useAuthStore.getState().currentUser?.id;
        try {
          const trf = await apiRequest<TRF>('/trfs', { method: 'POST', body: trfData });
          if (useAuthStore.getState().currentUser?.id !== userId) return null;
          set((state) => ({ trfs: [trf, ...state.trfs] }));
          return trf;
        } catch (error) { console.error('Create TRF failed:', error); return null; }
      },

      updateTRF: async (id, updates) => {
        const userId = useAuthStore.getState().currentUser?.id;
        try {
          const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id), { method: 'PUT', body: updates });
          if (useAuthStore.getState().currentUser?.id !== userId) return false;
          set((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
          return true;
        } catch (error) { console.error('Update TRF failed:', error); return false; }
      },
      resubmitTRF: async (id, _changedBy, _changedByName, updates) => {
        const userId = useAuthStore.getState().currentUser?.id;
        try {
          const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id) + '/resubmit', { method: 'POST', body: updates });
          if (useAuthStore.getState().currentUser?.id !== userId) return false;
          set((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
          return true;
        } catch (error) { console.error('Resubmit TRF failed:', error); return false; }
      },
      deleteTRF: async (id) => {
        try {
          const result = await apiRequest<{ id: string }>('/trfs/' + encodeURIComponent(id), { method: 'DELETE' });
          if (result.id !== id) return false;
          set((state) => ({ trfs: state.trfs.filter((trf) => trf.id !== id),
            statusHistory: state.statusHistory.filter((entry) => entry.trfId !== id) }));
          return true;
        } catch (error) { console.error('Delete TRF failed:', error); return false; }
      },

      editAndApproveTRF: async (id, _currentUser, updates, note, lumpsum) =>
        applyWorkflow(id, 'edit-approve', { updates, note, lumpsum }),

      getVisibleTRFs: (user) => {
  const allTRFs = get().trfs;
  const employees = get().employees;

  let filtered: TRF[] = [];

  switch (user.role) {
    /*
     * EMPLOYEE:
     * hanya dapat melihat TRF milik employee_id
     * yang terhubung ke personal account tersebut.
     */
    case 'EMPLOYEE': {
      const employeeId =
        user.employeeId ??
        employees.find(
          (employee) => employee.userId === user.id,
        )?.id;

      filtered = employeeId
        ? allTRFs.filter(
            (trf) => trf.employeeId === employeeId,
          )
        : [];

      break;
    }

    /*
     * ADMIN_DEPT & HOD:
     * hanya dapat melihat TRF dari department akun.
     */
    case 'ADMIN_DEPT':
    case 'HOD': {
      const userDepartment =
        user.department?.trim().toLowerCase();

      filtered = userDepartment
        ? allTRFs.filter(
            (trf) =>
              trf.department
                ?.trim()
                .toLowerCase() === userDepartment,
          )
        : [];

      break;
    }

    /*
     * HR, PM, GA, SUPER_ADMIN:
     * dapat melihat seluruh department.
     */
    case 'HR':
    case 'PM':
    case 'GA':
    case 'SUPER_ADMIN':
      filtered = allTRFs;
      break;

    default:
      filtered = [];
  }

  return filtered.map((trf) => ({
    ...trf,
    employee: trf.employee ?? employees.find((employee) => employee.id === trf.employeeId),
  }));
},

      getTRFsForVerification: (
        department: string,
      ) => {
        const normalizedDepartment =
          department
            ?.trim()
            .toLocaleLowerCase('id-ID') ??
          '';

        if (!normalizedDepartment) {
          return [];
        }

        return get()
          .trfs.filter(
            (trf) =>
              trf.status ===
                'SUBMITTED' &&
              (
                trf.department
                  ?.trim()
                  .toLocaleLowerCase(
                    'id-ID',
                  ) ?? ''
              ) ===
                normalizedDepartment,
          )
          .map((trf) => ({
            ...trf,
            employee: get().employees.find(
              (employee) =>
                employee.id ===
                trf.employeeId,
            ),
          }));
      },

            getTRFsForApproval: (role: UserRole, department?: string) => {
        return get()
          .trfs
          .filter((trf) => {
            if (role === 'HOD') {
              const normalizedDepartment =
                department
                  ?.trim()
                  .toLocaleLowerCase(
                    'id-ID',
                  ) ?? '';

              return (
                trf.status ===
                  'PENDING_APPROVAL' &&
                Boolean(
                  normalizedDepartment,
                ) &&
                (
                  trf.department
                    ?.trim()
                    .toLocaleLowerCase(
                      'id-ID',
                    ) ?? ''
                ) ===
                  normalizedDepartment
              );
            }

            if (role === 'HR') return trf.status === 'HOD_APPROVED';
            if (role === 'PM') return trf.status === 'HR_APPROVED';
            return false;
          })
          .map((t) => ({
            ...t,
            employee: t.employee ?? get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsForProcessing: () => {
        return get()
          .trfs.filter((t) => t.status === 'PM_APPROVED')
          .map((t) => ({
            ...t,
            employee: t.employee ?? get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      handleVerify: async (id, _currentUser, action, remarks) => {
        const verification = action === 'VERIFY' || action === 'REVISE';
        const endpoint = verification ? 'verify' : action === 'REJECT' ? 'reject' : 'approve';
        return applyWorkflow(id, endpoint, verification ? { decision: action === 'VERIFY' ? 'YES' : 'NO', remarks } : { remarks });
      },
      handleApproval: async (id, _currentUser, action, remarks, lumpsum) => {
        const endpoint = action === 'APPROVE' ? 'approve' : action === 'REJECT' ? 'reject' : action === 'REVISE' ? 'revise' : 'verify';
        return applyWorkflow(id, endpoint, action === 'VERIFY' ? { decision: 'YES', remarks } : { remarks, ...(lumpsum ? { lumpsum } : {}) });
      },
      findNextActiveStatus: (target, department) => findNextActiveStatus(target, get().users, department) as TRFStatus,
      // ============================================
      // USER MANAGEMENT (SUPER ADMIN)
      // ============================================

      fetchUsers: async () => {
        if (!isSupabaseEnabled()) return;
        const { data, error = null } = await supabase
          .from('users')
          .select('*')
          // .eq('is_active', true)
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
          throw new Error('Email sudah memiliki akun');
        }

        const templatePassword = 'mmspanicsmp123!';
        const password_hash = await bcrypt.hash(templatePassword, 10);

        const { error } = await supabase.from('users').insert({
          username: payload.username,
          email: payload.email,
          role: payload.role,
          department: payload.department ?? null,
          employee_id: payload.employee_id ?? null,
          password_hash,
          must_change_password: true,
          is_active: true,
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
            employee_id: payload.employee_id,
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

      enableUser: async (id) => {
        if (!isSupabaseEnabled()) return;
        const { error } = await supabase
          .from('users')
          .update({ is_active: true }) // 🔑 Mengubah kembali menjadi TRUE
          .eq('id', id);

        if (error) throw error;
        await get().fetchUsers();
      },

      getPendingApprovals: () => [],
      submitTRF: async () => false,

      getStatusHistory: (trfId) => {
        return get()
          .statusHistory.filter((sh) => sh.trfId === trfId)
          .sort(
            (a, b) =>
              new Date(b.changedAt || '').getTime() -
              new Date(a.changedAt || '').getTime(),
          );
      },

      addStatusHistory: async (entry) => {
        if (!isSupabaseEnabled()) return;

        const { error } = await supabase
          .from('status_history')
          .insert([
            {
              trf_id: entry.trfId,
              changed_by: entry.changedBy,
              changed_by_name: entry.changedByName,
              old_status: entry.oldStatus,
              new_status: entry.newStatus,
              remarks: entry.remarks,
            },
          ]);

        if (error) {
          console.error(
            'Add status history error:',
            error,
          );
        }

      },

      getEmployeeById: (id) => get().employees.find((e) => e.id === id),
      getEmployeesByType: (type) =>
        get().employees.filter((e) => e.employeeType === type),
      getUserById: (id) => get().users.find((u) => u.id === id),
    }),
    { name: 'trf-storage', version: 1, migrate: () => ({}), partialize: () => ({}) },
  ),
);

// ============================================
// DASHBOARD STORE
// ============================================

interface DashboardTRFRow {
  id: string;
  employee_id: string;
  department?: string | null;
  status?: string;
  travel_arrangements?: TravelArrangement[] | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface DashboardState {
  stats: {
    totalTravelIn: number;
    totalTravelOut: number;
    siteEntry: number;
    onSiteActive: number;
    daysInSite: number;
  };

  isLoadingStats: boolean;

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

  fetchDashboardStats: (
    user: User,
  ) => Promise<void>;

  fetchWeeklyTravel: (
    user: User,
  ) => Promise<void>;
}

const EMPTY_DASHBOARD_STATS = {
  totalTravelIn: 0,
  totalTravelOut: 0,
  siteEntry: 0,
  onSiteActive: 0,
  daysInSite: 0,
};

const createEmptyWeeklyTravel = () => [
  { day: 'Mon', travelIn: 0, travelOut: 0 },
  { day: 'Tue', travelIn: 0, travelOut: 0 },
  { day: 'Wed', travelIn: 0, travelOut: 0 },
  { day: 'Thu', travelIn: 0, travelOut: 0 },
  { day: 'Fri', travelIn: 0, travelOut: 0 },
  { day: 'Sat', travelIn: 0, travelOut: 0 },
  { day: 'Sun', travelIn: 0, travelOut: 0 },
];

export const useDashboardStore =
  create<DashboardState>()((set) => ({
    stats: EMPTY_DASHBOARD_STATS,

    isLoadingStats: false,

    roomAvailability: [
      {
        hotelName: 'Grand Mining Hotel',
        total: 120,
        occupied: 98,
        available: 22,
      },
      {
        hotelName: 'Camp Residence',
        total: 80,
        occupied: 45,
        available: 35,
      },
      {
        hotelName: 'Site C Camp',
        total: 60,
        occupied: 52,
        available: 8,
      },
      {
        hotelName: 'City Center Hotel',
        total: 40,
        occupied: 28,
        available: 12,
      },
    ],

    weeklyTravel: createEmptyWeeklyTravel(),

    // ============================================
    // STAT CARDS
    // ============================================

    fetchDashboardStats: async (user) => {
      if (!isSupabaseEnabled()) {
        return;
      }

      set({ isLoadingStats: true });

      try {
        /*
         * Query starts with GA_PROCESSED because these
         * cards represent completed/processed travel.
         */
        let query = supabase
          .from('trfs')
          .select(
            `
              id,
              employee_id,
              department,
              status,
              travel_arrangements,
              start_date,
              end_date
            `,
          )
          .eq('status', 'GA_PROCESSED');

        /*
         * EMPLOYEE:
         * only own employee_id.
         */
        if (user.role === 'EMPLOYEE') {
          if (!user.employeeId) {
            set({
              stats: EMPTY_DASHBOARD_STATS,
              isLoadingStats: false,
            });

            return;
          }

          query = query.eq(
            'employee_id',
            user.employeeId,
          );
        }

        /*
         * ADMIN_DEPT & HOD:
         * only their department.
         */
        if (
          user.role === 'ADMIN_DEPT' ||
          user.role === 'HOD'
        ) {
          if (!user.department) {
            set({
              stats: EMPTY_DASHBOARD_STATS,
              isLoadingStats: false,
            });

            return;
          }

          query = query.eq(
            'department',
            user.department,
          );
        }

        /*
         * HR, PM, GA, SUPER_ADMIN:
         * no additional filter = all departments.
         */
        const { data, error } = await query;

        if (error) {
          console.error(
            'Error fetching dashboard stats:',
            error,
          );

          set({
            stats: EMPTY_DASHBOARD_STATS,
            isLoadingStats: false,
          });

          return;
        }

        const rows =
          (data ?? []) as DashboardTRFRow[];

        const today =
          new Date().toISOString().split('T')[0];

        let totalTravelIn = 0;
        let totalTravelOut = 0;
        let onSiteActive = 0;
        let daysInSite = 0;

        rows.forEach((trf) => {
          const arrangements =
            trf.travel_arrangements ?? [];

          const hasTravelIn =
            arrangements.some(
              (arrangement) =>
                arrangement.travelType ===
                'TRAVEL_IN',
            );

          const hasTravelOut =
            arrangements.some(
              (arrangement) =>
                arrangement.travelType ===
                'TRAVEL_OUT',
            );

          if (hasTravelIn) {
            totalTravelIn += 1;
          }

          if (hasTravelOut) {
            totalTravelOut += 1;
          }

          const startDate = trf.start_date;
          const endDate = trf.end_date;

          if (
            startDate &&
            endDate &&
            startDate <= today &&
            endDate >= today
          ) {
            onSiteActive += 1;

            const start = new Date(startDate);
            const end = new Date(endDate);

            const diffTime = Math.max(
              0,
              end.getTime() - start.getTime(),
            );

            daysInSite += Math.ceil(
              diffTime /
                (1000 * 60 * 60 * 24),
            );
          }
        });

        set({
          stats: {
            totalTravelIn,
            totalTravelOut,
            siteEntry: 0,
            onSiteActive,
            daysInSite,
          },
          isLoadingStats: false,
        });
      } catch (error) {
        console.error(
          'fetchDashboardStats error:',
          error,
        );

        set({
          stats: EMPTY_DASHBOARD_STATS,
          isLoadingStats: false,
        });
      }
    },

    // ============================================
    // WEEKLY TRAVEL CHART
    // ============================================

    fetchWeeklyTravel: async (user) => {
      if (!isSupabaseEnabled()) {
        return;
      }

      try {
        const now = new Date();

        /*
         * getDay():
         * 0 = Sunday
         * 1 = Monday
         * ...
         * 6 = Saturday
         */
        const dayOfWeek = now.getDay();

        const diffToMonday =
          dayOfWeek === 0
            ? -6
            : 1 - dayOfWeek;

        const monday = new Date(now);

        monday.setDate(
          now.getDate() + diffToMonday,
        );

        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);

        sunday.setDate(
          monday.getDate() + 6,
        );

        sunday.setHours(
          23,
          59,
          59,
          999,
        );

        const mondayStr =
          monday.toISOString().split('T')[0];

        const sundayStr =
          sunday.toISOString().split('T')[0];

        let query = supabase
          .from('trfs')
          .select(
            `
              id,
              employee_id,
              department,
              travel_arrangements
            `,
          );

        /*
         * EMPLOYEE:
         * only own employee_id.
         */
        if (user.role === 'EMPLOYEE') {
          if (!user.employeeId) {
            set({
              weeklyTravel:
                createEmptyWeeklyTravel(),
            });

            return;
          }

          query = query.eq(
            'employee_id',
            user.employeeId,
          );
        }

        /*
         * ADMIN_DEPT & HOD:
         * only their department.
         */
        if (
          user.role === 'ADMIN_DEPT' ||
          user.role === 'HOD'
        ) {
          if (!user.department) {
            set({
              weeklyTravel:
                createEmptyWeeklyTravel(),
            });

            return;
          }

          query = query.eq(
            'department',
            user.department,
          );
        }

        /*
         * HR, PM, GA, SUPER_ADMIN:
         * no additional filter.
         */
        const { data, error } = await query;

        if (error) {
          console.error(
            'Error fetching weekly travel:',
            error,
          );

          set({
            weeklyTravel:
              createEmptyWeeklyTravel(),
          });

          return;
        }

        const rows =
          (data ?? []) as DashboardTRFRow[];

        const dailyMap: Record<
          string,
          {
            travelInTRFs: Set<string>;
            travelOutTRFs: Set<string>;
          }
        > = {};

        for (let index = 0; index < 7; index++) {
          const date = new Date(monday);

          date.setDate(
            monday.getDate() + index,
          );

          const key =
            date.toISOString().split('T')[0];

          dailyMap[key] = {
            travelInTRFs: new Set<string>(),
            travelOutTRFs: new Set<string>(),
          };
        }

        rows.forEach((trf) => {
          const arrangements =
            trf.travel_arrangements ?? [];

          arrangements.forEach(
            (arrangement) => {
              const travelDate =
                arrangement.travelDate;

              if (
                !travelDate ||
                travelDate < mondayStr ||
                travelDate > sundayStr
              ) {
                return;
              }

              const dayEntry =
                dailyMap[travelDate];

              if (!dayEntry) {
                return;
              }

              if (
                arrangement.travelType ===
                'TRAVEL_IN'
              ) {
                dayEntry.travelInTRFs.add(
                  trf.id,
                );
              }

              if (
                arrangement.travelType ===
                'TRAVEL_OUT'
              ) {
                dayEntry.travelOutTRFs.add(
                  trf.id,
                );
              }
            },
          );
        });

        const dayLabels = [
          'Mon',
          'Tue',
          'Wed',
          'Thu',
          'Fri',
          'Sat',
          'Sun',
        ];

        const weeklyTravel = dayLabels.map(
          (day, index) => {
            const date = new Date(monday);

            date.setDate(
              monday.getDate() + index,
            );

            const key =
              date.toISOString().split('T')[0];

            const entry = dailyMap[key];

            return {
              day,
              travelIn:
                entry?.travelInTRFs.size ?? 0,
              travelOut:
                entry?.travelOutTRFs.size ?? 0,
            };
          },
        );

        set({ weeklyTravel });
      } catch (error) {
        console.error(
          'fetchWeeklyTravel error:',
          error,
        );

        set({
          weeklyTravel:
            createEmptyWeeklyTravel(),
        });
      }
    },
  }));

async function applyWorkflow(id: string, endpoint: string, body: unknown): Promise<boolean> {
  const userId = useAuthStore.getState().currentUser?.id;
  try {
    const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id) + '/' + endpoint, { method: 'POST', body });
    if (useAuthStore.getState().currentUser?.id !== userId) return false;
    useTRFStore.setState((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
    return true;
  } catch (error) { console.error('TRF workflow failed:', error); return false; }
}
