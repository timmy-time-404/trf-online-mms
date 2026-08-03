import { create } from 'zustand';
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
  Accommodation,
  TravelArrangement,
  AdminDeptVerify,
  PMApproval,
  GAProcess,
} from '@/types';

import { getNextStatus, type WorkflowAction } from '@/workflow/trfWorkflow';
import { useNotificationStore } from '@/store/notificationStore';
import { notifyEmployeeStatusChangeWA } from '@/lib/notifyStatusChangeWA';

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
  // ── NEW PATCH FIELDS ──
  purpose_entries?: NonNullable<TRF['purposeEntries']>;
  accommodations?: NonNullable<TRF['accommodations']>;
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

const transformTRFFromDB = (dbTRF: DBTRFRow, employees: Employee[]): TRF => {
  return {
    id: dbTRF.id,
    trfNumber: dbTRF.trf_number,
    employeeId: dbTRF.employee_id,
    employee: employees.find((e) => e.id === dbTRF.employee_id) ?? {
      id: dbTRF.employee_id,
      employeeCode: '-',
      employeeName: 'Unknown Employee',
      employeeType: 'EMPLOYEE',
      jobTitle: '-',
      department: 'Unknown',
      section: '-',
      email: '-',
      phone: '-',
      pointOfHire: '-',
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
    gaDocuments: dbTRF.ga_documents
      ? (dbTRF.ga_documents as TRF['gaDocuments'])
      : {},
    submittedAt: dbTRF.submitted_at,
    createdAt: dbTRF.created_at,
    updatedAt: dbTRF.updated_at,
    purposeEntries: dbTRF.purpose_entries ?? [],
    accommodations: dbTRF.accommodations ?? [],
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

      login: (user) =>
        set({
          currentUser: user,
          isAuthenticated: true,
          isLoading: false,
        }),

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
        if (!isSupabaseEnabled()) return;
        const { data, error } = await supabase
          .from('trfs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Fetch TRFs error:', error);
          return;
        }

        if (data) {
          const rows = data as DBTRFRow[];
          const employees = get().employees;
          set({ trfs: rows.map((trf) => transformTRFFromDB(trf, employees)) });
        }
      },

      getTRFById: (id) => {
        const trf = get().trfs.find((t) => t.id === id);
        return trf
          ? {
              ...trf,
              employee: get().employees.find((e) => e.id === trf.employeeId),
            }
          : undefined;
      },

      getTRFsByEmployee: (employeeId) => {
        return get()
          .trfs.filter((t) => t.employeeId === employeeId)
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsByStatus: (status) => {
        return get()
          .trfs.filter((t) => t.status === status)
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsByDepartment: (department) => {
        return get()
          .trfs.filter((t) => t.department === department)
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      createTRF: async (trfData) => {
        if (!isSupabaseEnabled()) {
          console.error('Supabase is not enabled');
          return null;
        }

        try {
          const employee = get().employees.find(
            (item) => item.id === trfData.employeeId,
          );

          const department = employee?.department ?? null;
          const submittedAt = new Date().toISOString();

          const { data, error } = await supabase
            .from('trfs')
            .insert([
              {
                employee_id: trfData.employeeId,
                department,
                travel_purpose: trfData.travelPurpose,
                start_date: trfData.startDate,
                end_date: trfData.endDate,
                purpose_remarks: trfData.purposeRemarks || null,
                status: 'SUBMITTED',

                // Nama kolom database menggunakan snake_case.
                submitted_at: submittedAt,

                accommodation: trfData.accommodation || null,
                travel_arrangements:
                  trfData.travelArrangements || [],
                purpose_entries:
                  (trfData as any).purposeEntries || [],
                accommodations:
                  (trfData as any).accommodations || [],
              },
            ])
            .select()
            .single();

          if (error) {
            console.error('Create TRF Supabase error:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            });
            return null;
          }

          if (!data) {
            console.error(
              'Supabase did not return the newly created TRF.',
            );
            return null;
          }

          const row = data as DBTRFRow;

          const newTRF: TRF = {
            ...trfData,
            id: row.id,
            department: department ?? undefined,
            trfNumber: row.trf_number,
            status: 'SUBMITTED',
            submittedAt: row.submitted_at ?? submittedAt,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            accommodation:
              trfData.accommodation || undefined,
            travelArrangements:
              trfData.travelArrangements || [],
            purposeEntries:
              (trfData as any).purposeEntries || [],
            accommodations:
              (trfData as any).accommodations || [],
          };

          set((state) => ({
            trfs: [newTRF, ...state.trfs],
          }));

          await get().addStatusHistory({
            trfId: row.id,
            changedBy: trfData.employeeId,
            changedByName:
              employee?.employeeName ?? 'System',
            newStatus: 'SUBMITTED',
            remarks: 'TRF created and submitted',
          });

          return newTRF;
        } catch (error) {
          console.error('Create TRF error:', error);
          return null;
        }
      },

      updateTRF: async (id, updates) => {
        if (!isSupabaseEnabled()) return false;

        try {
          const updatePayload: Record<string, unknown> = {
            travel_purpose: updates.travelPurpose,
            start_date: updates.startDate,
            end_date: updates.endDate,
            purpose_remarks:
              updates.purposeRemarks || null,
            accommodation:
              updates.accommodation || null,
            travel_arrangements:
              updates.travelArrangements || [],
            purpose_entries:
              (updates as any).purposeEntries || [],
            accommodations:
              (updates as any).accommodations || [],
            updated_at: new Date().toISOString(),
          };

          if (updates.status) {
            updatePayload.status = updates.status;
          }

          const { error } = await supabase
            .from('trfs')
            .update(updatePayload)
            .eq('id', id);

          if (error) {
            console.error(
              'Update TRF Supabase error:',
              error,
            );
            return false;
          }

          await get().fetchTRFs();
          return true;
        } catch (error) {
          console.error('Update TRF error:', error);
          return false;
        }
      },
      resubmitTRF: async (
  id: string,
  changedBy: string,
  changedByName: string,
  updates: UpdateTRFInput,
) => {
  if (!isSupabaseEnabled()) return false;
  try {
    const { error } = await supabase
      .from('trfs')
      .update({
        travel_purpose: updates.travelPurpose,
        start_date: updates.startDate,
        end_date: updates.endDate,
        purpose_remarks: updates.purposeRemarks,
        accommodation: updates.accommodation,
        travel_arrangements: updates.travelArrangements,
        purpose_entries: (updates as any).purposeEntries || [],
        accommodations: (updates as any).accommodations || [],
        status: 'SUBMITTED',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    await get().addStatusHistory({
      trfId: id,
      changedBy,
      changedByName,
      oldStatus: 'NEEDS_REVISION',
      newStatus: 'SUBMITTED',
      remarks: 'TRF revised and resubmitted by employee',
    });

    await get().fetchAllData();
    return true;
  } catch (error) {
    console.error('Resubmit TRF error:', error);
    return false;
  }
},

      deleteTRF: async (id) => {
        if (!isSupabaseEnabled()) return false;
        await supabase.from('trfs').delete().eq('id', id);
        return true;
      },

      editAndApproveTRF: async (id, currentUser, updates, note) => {
        if (!isSupabaseEnabled()) return false;

        const trf = get().trfs.find((t) => t.id === id);
        if (!trf) return false;

        if (currentUser.role !== 'HR' && currentUser.role !== 'GA') {
          console.error('editAndApproveTRF: role tidak diizinkan', currentUser.role);
          return false;
        }

        const expectedStatus: TRFStatus =
          currentUser.role === 'HR' ? 'HOD_APPROVED' : 'PM_APPROVED';

        if (trf.status !== expectedStatus) {
          console.error(
            `editAndApproveTRF: status tidak sesuai. Expected ${expectedStatus}, got ${trf.status}`,
          );
          return false;
        }

        try {
          const now = new Date().toISOString();

          const actorEmployee = currentUser.employeeId
            ? get().employees.find((e) => e.id === currentUser.employeeId)
            : undefined;
          const actorDisplayName = actorEmployee?.employeeName ?? currentUser.username;

          const baseUpdatePayload: Record<string, unknown> = {
            travel_purpose: updates.travelPurpose,
            start_date: updates.startDate,
            end_date: updates.endDate,
            purpose_remarks: updates.purposeRemarks,
            accommodation: updates.accommodation,
            travel_arrangements: updates.travelArrangements,
            purpose_entries: (updates as any).purposeEntries || [],
            accommodations: (updates as any).accommodations || [],
            updated_at: now,
          };

          // ============================================
          // HR: edit TRF DAN langsung approve ke tahap berikutnya
          // (lumpsum sudah disimpan terpisah oleh pemanggil sebelum ini).
          // ============================================
          if (currentUser.role === 'HR') {
            const nextStatus = get().findNextActiveStatus('HR_APPROVED', trf.department);

            const { error } = await supabase
              .from('trfs')
              .update({
                ...baseUpdatePayload,
                status: nextStatus,
                parallel_approval: {
                  ...(trf.parallelApproval || {}),
                  hr: {
                    status: 'APPROVED' as const,
                    actionAt: now,
                    actionById: currentUser.id,
                    actionByName: actorDisplayName,
                    remarks: note || '',
                  },
                },
              })
              .eq('id', id);

            if (error) throw error;

            await get().addStatusHistory({
              trfId: id,
              changedBy: currentUser.id,
              changedByName: actorDisplayName,
              oldStatus: trf.status,
              newStatus: nextStatus,
              remarks: note?.trim() || `TRF diedit dan disetujui otomatis oleh HR`,
            });

            const ownerEmployee = get().employees.find((e) => e.id === trf.employeeId);
            if (ownerEmployee?.userId) {
              await useNotificationStore.getState().createNotification({
                userId: ownerEmployee.userId,
                trfId: id,
                trfNumber: trf.trfNumber,
                title: `TRF ${trf.trfNumber} diperbarui & disetujui oleh HR`,
                message:
                  note?.trim() ||
                  `${actorDisplayName} (HR) telah memperbarui dan menyetujui TRF ini.`,
                createdBy: currentUser.id,
                createdByName: actorDisplayName,
              });
            }

            await get().fetchAllData();
            return true;
          }

          // ============================================
          // GA: edit TRF SAJA, TIDAK auto-approve. Status tetap PM_APPROVED.
          // GA tetap wajib upload dokumen lewat halaman Process untuk benar-benar
          // menyelesaikan (approve) TRF-nya.
          // ============================================
          const { error } = await supabase
            .from('trfs')
            .update(baseUpdatePayload)
            .eq('id', id);

          if (error) throw error;

          // Audit trail: status tidak berubah, ini murni pencatatan edit.
          await supabase.from('status_history').insert([
            {
              trf_id: id,
              changed_by: currentUser.id,
              changed_by_name: actorDisplayName,
              old_status: trf.status,
              new_status: trf.status,
              remarks:
                note?.trim() ||
                `Detail TRF diedit oleh GA (${actorDisplayName}), menunggu proses dokumen.`,
            },
          ]);

          // Notifikasi WA + in-app: "diedit", BUKAN "disetujui" — supaya
          // employee tidak salah kira TRF-nya sudah final.
          void notifyEmployeeStatusChangeWA({
            trfId: id,
            newStatus: trf.status,
            actorName: actorDisplayName,
            remarks: note,
            editedOnly: true,
          });

          const ownerEmployee = get().employees.find((e) => e.id === trf.employeeId);
          if (ownerEmployee?.userId) {
            await useNotificationStore.getState().createNotification({
              userId: ownerEmployee.userId,
              trfId: id,
              trfNumber: trf.trfNumber,
              title: `TRF ${trf.trfNumber} diedit oleh GA`,
              message:
                note?.trim() ||
                `${actorDisplayName} (GA) memperbarui detail TRF ini. TRF masih menunggu proses dokumen (voucher/tiket) sebelum final disetujui.`,
              createdBy: currentUser.id,
              createdByName: actorDisplayName,
            });
          }

          await get().fetchAllData();
          return true;
        } catch (error) {
          console.error('editAndApproveTRF error:', error);
          return false;
        }
      },

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
    employee: employees.find(
      (employee) => employee.id === trf.employeeId,
    ),
  }));
},

      getTRFsForVerification: (department: string) => {
        return get()
          .trfs.filter(
            (t) => t.department === department && t.status === 'SUBMITTED',
          )
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

            getTRFsForApproval: (role: UserRole, department?: string) => {
        return get()
          .trfs
          .filter((trf) => {
            if (role === 'HOD') {
              return (
                trf.status === 'PENDING_APPROVAL' &&
                !!department &&
                trf.department === department
              );
            }

            if (role === 'HR') return trf.status === 'HOD_APPROVED';
            if (role === 'PM') return trf.status === 'HR_APPROVED';
            return false;
          })
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

      getTRFsForProcessing: () => {
        return get()
          .trfs.filter((t) => t.status === 'PM_APPROVED')
          .map((t) => ({
            ...t,
            employee: get().employees.find((e) => e.id === t.employeeId),
          }));
      },

handleVerify: async (
  trfId: string,
  currentUser: User,
  action: WorkflowAction,
  remarks?: string,
) => {
  const trf = get().trfs.find((t) => t.id === trfId);
  if (!trf) return false;

  try {
    let nextStatus = getNextStatus(trf.status, currentUser.role, action);

    if (action === 'APPROVE' || action === 'VERIFY') {
      nextStatus = get().findNextActiveStatus(nextStatus, trf.department);
    }

    const now = new Date().toISOString();

    // 🔑 Resolve nama asli dari tabel employees via employeeId
    const verifierEmployee = currentUser.employeeId
      ? get().employees.find((e) => e.id === currentUser.employeeId)
      : undefined;
    const verifierDisplayName = verifierEmployee?.employeeName ?? currentUser.username;

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    };

    if (action === 'VERIFY') {
      updatePayload.admin_dept_verify = {
        verified: true,
        verifiedAt: now,
        verifierId: currentUser.id,
        verifierName: verifierDisplayName,
        remarks: remarks || '',
      };
    }

    const { error: updateError } = await supabase
      .from('trfs')
      .update(updatePayload)
      .eq('id', trfId);

    if (updateError) {
      throw updateError;
    }

    await get().addStatusHistory({
      trfId,
      changedBy: currentUser.id,
      changedByName: verifierDisplayName,
      oldStatus: trf.status,
      newStatus: nextStatus,
      remarks: remarks || `Verified by ${currentUser.role}`,
    });

    await get().fetchAllData();
    return true;
  } catch (error) {
    console.error('Verify Error:', error);
    return false;
  }
},

handleApproval: async (
  trfId: string,
  currentUser: User,
  action: WorkflowAction,
  remarks?: string,
) => {
  const trf = get().trfs.find((t) => t.id === trfId);
  if (!trf) return false;

  try {
    let nextStatus = getNextStatus(
      trf.status,
      currentUser.role,
      action as Parameters<typeof getNextStatus>[2],
    );

    if (action === 'APPROVE' || action === 'VERIFY') {
      nextStatus = get().findNextActiveStatus(nextStatus, trf.department);
    }

    const now = new Date().toISOString();

    // 🔑 Resolve nama asli dari tabel employees via employeeId,
    // fallback ke username kalau tidak ketemu (misal HR/PM tidak punya employee_id)
    const approverEmployee = currentUser.employeeId
      ? get().employees.find((e) => e.id === currentUser.employeeId)
      : undefined;
    const approverDisplayName = approverEmployee?.employeeName ?? currentUser.username;

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updated_at: now,
    };

    if (action === 'APPROVE') {
      const approvalAction = {
        status: 'APPROVED' as const,
        actionAt: now,
        actionById: currentUser.id,
        actionByName: approverDisplayName,
        remarks: remarks || '',
      };

      if (currentUser.role === 'HOD') {
        updatePayload.parallel_approval = {
          ...(trf.parallelApproval || {}),
          hod: approvalAction,
        };
      } else if (currentUser.role === 'HR') {
        updatePayload.parallel_approval = {
          ...(trf.parallelApproval || {}),
          hr: approvalAction,
        };
      } else if (currentUser.role === 'PM') {
        updatePayload.pm_approval = {
          approved: true,
          approvedAt: now,
          approverId: currentUser.id,
          approverName: approverDisplayName,
          remarks: remarks || '',
        };
      }
    }

    const { error: updateError } = await supabase
      .from('trfs')
      .update(updatePayload)
      .eq('id', trfId);

    if (updateError) {
      throw updateError;
    }

    await get().addStatusHistory({
      trfId,
      changedBy: currentUser.id,
      changedByName: approverDisplayName,
      oldStatus: trf.status,
      newStatus: nextStatus,
      remarks: remarks || `${action} by ${currentUser.role}`,
    });

    await get().fetchAllData();
    return true;
  } catch (error) {
    console.error('Workflow Error:', error);
    return false;
  }
},
// ➕ WAJIB ADA: dipanggil oleh handleVerify & handleApproval untuk skip role yang tidak aktif
      findNextActiveStatus: (
        targetStatus: string,
        trfDepartment?: string,
      ): TRFStatus => {
        const activeUsers = get().users;

        const statusToRoleMap: Record<string, string> = {
          PENDING_APPROVAL: 'HOD',
          HOD_APPROVED: 'HR',
          HR_APPROVED: 'PM',
          PM_APPROVED: 'GA',
        };

        let currentStatus = targetStatus;

        for (let i = 0; i < 5; i++) {
          const requiredRole = statusToRoleMap[currentStatus];
          if (!requiredRole) break;

          const isApproverActive = activeUsers.some((u) => {
            const matchesRole = u.role === requiredRole;
            const matchesDept =
              requiredRole === 'ADMIN_DEPT'
                ? u.department === trfDepartment
                : true;

            return matchesRole && matchesDept && u.is_active !== false;
          });
                    if (!isApproverActive) {
            console.warn(
              `Role ${requiredRole} sedang tidak aktif. Mengalihkan approval otomatis...`,
            );

            if (currentStatus === 'PENDING_APPROVAL') currentStatus = 'HOD_APPROVED';
            else if (currentStatus === 'HOD_APPROVED') currentStatus = 'HR_APPROVED';
            else if (currentStatus === 'HR_APPROVED') currentStatus = 'PM_APPROVED';
            else if (currentStatus === 'PM_APPROVED') currentStatus = 'APPROVED';
          } else {
            break;
          }
        }

        return currentStatus as TRFStatus;
      },
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

        // Kirim notifikasi WA ke employee untuk setiap transisi status nyata
        // (verify, approve, reject, revise, edit&approve). Dilewati untuk
        // penciptaan TRF awal (oldStatus belum ada). Sengaja tidak di-await
        // supaya latensi WA/Fonnte tidak menghambat alur approval utama.
        if (entry.oldStatus) {
          void notifyEmployeeStatusChangeWA({
            trfId: entry.trfId,
            newStatus: entry.newStatus as TRFStatus,
            actorName: entry.changedByName,
            remarks: entry.remarks,
          });
        }
      },

      getEmployeeById: (id) => get().employees.find((e) => e.id === id),
      getEmployeesByType: (type) =>
        get().employees.filter((e) => e.employeeType === type),
      getUserById: (id) => get().users.find((u) => u.id === id),
    }),
    { name: 'trf-storage' },
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
