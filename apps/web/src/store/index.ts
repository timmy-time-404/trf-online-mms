import { normalizeDepartment, businessWeekStart } from '@trf/shared';
import { create } from 'zustand';
import { apiRequest } from '@/api/client';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import {
  clearAppSessionToken,
  getCurrentAppSession,
  logoutAppSession,
} from '@/lib/appSession';
import { useNotificationStore } from './notificationStore';
import type {
  User,
  UserRole,
  TRF,
  TRFStatus,
  Employee,
  StatusHistory,
  CreateTRFInput,
  UpdateTRFInput,
} from '@/types';

import { findNextActiveStatus, type WorkflowAction, type LumpsumInput } from '@trf/shared';

// ============================================
// DATABASE ROW & PAYLOAD INTERFACES
// ============================================

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
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: true,

      login: (user) => {
        clearBusinessData();
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
          clearBusinessData();

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
        clearBusinessData();

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

          if (get().currentUser?.id !== session.user.id) clearBusinessData();

          set({
            currentUser: session.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          clearAppSessionToken();
          clearBusinessData();

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
  deleteTRF: (id: string, version?: number) => Promise<boolean>;
  editAndApproveTRF: (
    id: string,
    currentUser: User,
    updates: UpdateTRFInput,
    note: string,
    lumpsum?: LumpsumInput,
    version?: number,
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
    version?: number,
  ) => Promise<boolean>;
  handleApproval: (
    trfId: string,
    currentUser: User,
    action: WorkflowAction,
    remarks?: string,
    lumpsum?: LumpsumInput,
    version?: number,
  ) => Promise<boolean>;

  findNextActiveStatus: (
    targetStatus: string,
    trfDepartment?: string,
  ) => TRFStatus;

  fetchUsers: () => Promise<void>;
  createUser: (payload: UserPayload) => Promise<string>;
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
        const userId = useAuthStore.getState().currentUser?.id;
        const referenceMaster = await apiRequest<TRFState['referenceMaster']>('/reference');
        if (useAuthStore.getState().currentUser?.id === userId) set({ referenceMaster });
      },
      searchLocations: (keyword, type) => apiRequest<LocationRow[]>('/locations?' + new URLSearchParams({ keyword, type })),
      fetchAllData: async () => {
        set({ isLoading: true });
        try {
          await Promise.all([get().fetchReferenceMaster(), get().fetchTRFs()]);
          await get().fetchEmployees();
          if (useAuthStore.getState().currentUser?.role === 'SUPER_ADMIN') await get().fetchUsers();
        } catch (error) { console.error('Fetch all data failed:', error); }
        finally { set({ isLoading: false }); }
      },

      forceRefreshTRFs: async () => {
        await get().fetchTRFs();
        set({ trfs: [...get().trfs] });
      },

      // ============================================
      // EMPLOYEE MANAGEMENT
      // ============================================

      fetchEmployees: async () => {
        const userId = useAuthStore.getState().currentUser?.id;
        const employees = await apiRequest<Employee[]>('/employees');
        if (useAuthStore.getState().currentUser?.id === userId) set({ employees });
      },
      createEmployee: async (payload) => {
        await apiRequest('/employees', { method: 'POST', body: { employee_name: payload.employeeName,
          employee_code: payload.employeeCode, department: payload.department, section: payload.section,
          job_title: payload.jobTitle, phone: payload.phone } });
        await get().fetchEmployees();
      },
      updateEmployee: async (id, payload) => {
        await apiRequest('/employees/' + encodeURIComponent(id), { method: 'PUT', body: {
          employee_name: payload.employeeName, department: payload.department, section: payload.section,
          job_title: payload.jobTitle, phone: payload.phone } });
        await get().fetchEmployees();
      },
      deleteEmployee: async (id) => {
        await apiRequest('/employees/' + encodeURIComponent(id), { method: 'DELETE' });
        await get().fetchEmployees();
      },

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
          normalizeDepartment(department);

        if (!normalizedDepartment) {
          return [];
        }

        return get()
          .trfs.filter(
            (trf) =>
              (
                normalizeDepartment(trf.department)
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
          const trf = await apiRequest<TRF>('/trfs', { method: 'POST', version: 0, body: trfData });
          if (useAuthStore.getState().currentUser?.id !== userId) return null;
          set((state) => ({ trfs: [trf, ...state.trfs] }));
          return trf;
        } catch (error) { console.error('Create TRF failed:', error); return null; }
      },

      updateTRF: async (id, updates) => {
        const userId = useAuthStore.getState().currentUser?.id;
        try {
          const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id), { method: 'PUT', version: updates.expectedVersion ?? get().getTRFById(id)?.version ?? 0, body: (({expectedVersion: _version,...data}) => data)(updates) });
          if (useAuthStore.getState().currentUser?.id !== userId) return false;
          set((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
          return true;
        } catch (error) { console.error('Update TRF failed:', error); return false; }
      },
      resubmitTRF: async (id, _changedBy, _changedByName, updates) => {
        const userId = useAuthStore.getState().currentUser?.id;
        try {
          const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id) + '/resubmit', { method: 'POST', version: updates.expectedVersion ?? get().getTRFById(id)?.version ?? 0, body: (({expectedVersion: _version,...data}) => data)(updates) });
          if (useAuthStore.getState().currentUser?.id !== userId) return false;
          set((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
          return true;
        } catch (error) { console.error('Resubmit TRF failed:', error); return false; }
      },
      deleteTRF: async (id,version) => {
        try {
          const result = await apiRequest<{ id: string }>('/trfs/' + encodeURIComponent(id), { method: 'DELETE', version: version ?? get().getTRFById(id)?.version ?? 0 });
          if (result.id !== id) return false;
          set((state) => ({ trfs: state.trfs.filter((trf) => trf.id !== id),
            statusHistory: state.statusHistory.filter((entry) => entry.trfId !== id) }));
          return true;
        } catch (error) { console.error('Delete TRF failed:', error); return false; }
      },

      editAndApproveTRF: async (id, _currentUser, updates, note, lumpsum, version) =>
        applyWorkflow(id, 'edit-approve', { updates: (({expectedVersion: _version,...data}) => data)(updates), note, lumpsum },version ?? updates.expectedVersion),

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
        normalizeDepartment(user.department);

      filtered = userDepartment
        ? allTRFs.filter(
            (trf) =>
              normalizeDepartment(trf.department) === userDepartment,
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
          normalizeDepartment(department);

        if (!normalizedDepartment) {
          return [];
        }

        return get()
          .trfs.filter(
            (trf) =>
              trf.status ===
                'SUBMITTED' &&
              (
                normalizeDepartment(trf.department)
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
                normalizeDepartment(department);

              return (
                trf.status ===
                  'PENDING_APPROVAL' &&
                Boolean(
                  normalizedDepartment,
                ) &&
                (
                  normalizeDepartment(trf.department)
                ) ===
                  normalizedDepartment
              );
            }

            if (role === 'HR') return trf.status === 'HOD_APPROVED';
            if (role === 'PM') return trf.status === 'HR_APPROVED';
            if (role === 'SUPER_ADMIN') return !!trf.blockedBy;
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

      handleVerify: async (id, _currentUser, action, remarks, version) => {
        const verification = action === 'VERIFY' || action === 'REVISE';
        const endpoint = verification ? 'verify' : action === 'REJECT' ? 'reject' : 'approve';
        return applyWorkflow(id, endpoint, verification ? { decision: action === 'VERIFY' ? 'YES' : 'NO', remarks } : { remarks },version);
      },
      handleApproval: async (id, _currentUser, action, remarks, lumpsum, version) => {
        const endpoint = action === 'APPROVE' ? 'approve' : action === 'REJECT' ? 'reject' : action === 'REVISE' ? 'revise' : 'verify';
        return applyWorkflow(id, endpoint, action === 'VERIFY' ? { decision: 'YES', remarks } : { remarks, ...(lumpsum ? { lumpsum } : {}) },version);
      },
      findNextActiveStatus: (target, department) => findNextActiveStatus(target, get().users, department) as TRFStatus,
      // ============================================
      // USER MANAGEMENT (SUPER ADMIN)
      // ============================================

      fetchUsers: async () => {
        const userId = useAuthStore.getState().currentUser?.id;
        const users = await apiRequest<User[]>('/users');
        if (useAuthStore.getState().currentUser?.id === userId) set({ users });
      },
      createUser: async (payload) => {
        const userId = useAuthStore.getState().currentUser?.id;
        const result = await apiRequest<{ user: User; temporaryPassword: string }>('/users', { method: 'POST', body: {
          username: payload.username, email: payload.email, role: payload.role,
          department: payload.department, employee_id: payload.employee_id } });
        if (useAuthStore.getState().currentUser?.id !== userId) throw new Error('Sesi telah berubah.');
        set((state) => ({ users: [result.user, ...state.users] }));
        return result.temporaryPassword;
      },
      updateUser: async (id, payload) => {
        const userId = useAuthStore.getState().currentUser?.id;
        const user = await apiRequest<User>('/users/' + encodeURIComponent(id), { method: 'PUT', body: {
          username: payload.username, email: payload.email, role: payload.role,
          department: payload.department, employee_id: payload.employee_id } });
        if (useAuthStore.getState().currentUser?.id === userId) set((state) => ({ users: state.users.map((item) => item.id === id ? user : item) }));
      },
      deleteUser: async (id) => {
        const userId = useAuthStore.getState().currentUser?.id;
        const user = await apiRequest<User>('/users/' + encodeURIComponent(id), { method: 'DELETE' });
        if (useAuthStore.getState().currentUser?.id === userId) set((state) => ({ users: state.users.map((item) => item.id === id ? user : item) }));
      },
      enableUser: async (id) => {
        const userId = useAuthStore.getState().currentUser?.id;
        const user = await apiRequest<User>('/users/' + encodeURIComponent(id) + '/enable', { method: 'POST' });
        if (useAuthStore.getState().currentUser?.id === userId) set((state) => ({ users: state.users.map((item) => item.id === id ? user : item) }));
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

interface DashboardState {
  stats: {
    totalTravelIn: number;
    totalTravelOut: number;
    siteEntry: number;
    onSiteActive: number;
    daysInSite: number;
  };

  isLoadingStats: boolean;


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


    weeklyTravel: createEmptyWeeklyTravel(),

    fetchDashboardStats: async (_user) => {
      const userId = useAuthStore.getState().currentUser?.id;
      set({ isLoadingStats: true });
      try {
        const stats = await apiRequest<DashboardState['stats']>('/dashboard/stats');
        if (useAuthStore.getState().currentUser?.id === userId) set({ stats });
      } catch (error) {
        console.error('Dashboard failed:', error);
        if (useAuthStore.getState().currentUser?.id === userId) set({ stats: EMPTY_DASHBOARD_STATS });
      }
      finally { if (useAuthStore.getState().currentUser?.id === userId) set({ isLoadingStats: false }); }
    },
    fetchWeeklyTravel: async (_user) => {
      const userId = useAuthStore.getState().currentUser?.id;
      const weekStart = businessWeekStart();
      try {
        const weeklyTravel = await apiRequest<DashboardState['weeklyTravel']>('/dashboard/weekly?' + new URLSearchParams({ weekStart }));
        if (useAuthStore.getState().currentUser?.id === userId) set({ weeklyTravel });
      } catch (error) {
        console.error('Weekly travel failed:', error);
        if (useAuthStore.getState().currentUser?.id === userId) set({ weeklyTravel: createEmptyWeeklyTravel() });
      }
    },
  }));

function clearBusinessData() {
  useTRFStore.setState({ trfs: [], employees: [], users: [], statusHistory: [],
    referenceMaster: { departments: [], purposes: [], transports: [], accommodations: [] } });
  useDashboardStore.setState({ stats: EMPTY_DASHBOARD_STATS, weeklyTravel: createEmptyWeeklyTravel(), isLoadingStats: false });
  useNotificationStore.getState().reset();
}

async function applyWorkflow(id: string, endpoint: string, body: unknown, version?: number): Promise<boolean> {
  const userId = useAuthStore.getState().currentUser?.id;
  try {
    const trf = await apiRequest<TRF>('/trfs/' + encodeURIComponent(id) + '/' + endpoint, { method: 'POST', body, version: version ?? useTRFStore.getState().getTRFById(id)?.version ?? 0 });
    if (useAuthStore.getState().currentUser?.id !== userId) return false;
    useTRFStore.setState((state) => ({ trfs: state.trfs.map((item) => item.id === id ? trf : item) }));
    return true;
  } catch (error) { console.error('TRF workflow failed:', error); return false; }
}
