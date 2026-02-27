// TRF Online System - Zustand Store with Supabase Integration

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import type { 
  User, 
  UserRole, 
  TRF, 
  TRFStatus, 
  Employee, 
  StatusHistory,
  AdminDeptVerification,
  PMApproval,
  GAProcess 
} from '@/types';
import {
  mockEmployees,
  mockTRFs,
  mockStatusHistory,
  referenceData,
  mockUsers
} from '@/mock/data';

import {
  processTRFApproval
} from './supabaseStore';

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
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: true,

      login: (user) => set({ currentUser: user, isAuthenticated: true, isLoading: false }),
      
      logout: () => {
        // Clear Supabase session if enabled
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

        // Check Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // Fetch user data from our users table
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
    {
      name: 'trf-auth-storage'
    }
  )
);

// ============================================
// TRF STORE
// ============================================

interface TRFState {
  trfs: TRF[];
  statusHistory: StatusHistory[];
  employees: Employee[];
  users: User[];
  referenceData: typeof referenceData;
  isLoading: boolean;
  
  // Fetch operations
  fetchAllData: () => Promise<void>;
  fetchEmployees: () => Promise<void>;
  fetchTRFs: () => Promise<void>;
  
  // CRUD Operations
  getTRFById: (id: string) => TRF | undefined;
  getTRFsByEmployee: (employeeId: string) => TRF[];
  getTRFsByStatus: (status: TRFStatus) => TRF[];
  getTRFsByDepartment: (department: string) => TRF[];
  createTRF: (input: CreateTRFInput) => Promise<TRF | null>;
  updateTRF: (id: string, input: UpdateTRFInput) => Promise<boolean>;
  deleteTRF: (id: string, hardDelete?: boolean) => Promise<boolean>;
  
  // Role-based visibility
  getVisibleTRFs: (user: User) => TRF[];
  
  // Admin Dept Verification
  getTRFsForVerification: (department: string) => TRF[];
  verifyTRF: (id: string, verifierId: string, verifierName: string, verified: boolean, remarks?: string) => Promise<boolean>;
  
  // Parallel Approval
  getTRFsForApproval: (user: User) => TRF[];
  hodApproveTRF: (id: string, hodId: string, hodName: string, approved: boolean, remarks?: string) => Promise<boolean>;
  hrApproveTRF: (id: string, hrId: string, hrName: string, approved: boolean, remarks?: string) => Promise<boolean>;
  
  // PM Final Approval
  getTRFsForPMApproval: () => TRF[];
  pmApproveTRF: (id: string, pmId: string, pmName: string, approved: boolean, remarks?: string) => Promise<boolean>;
  
  // GA Process
  getTRFsForProcessing: () => TRF[];
  gaProcessTRF: (id: string, gaId: string, gaName: string, voucherDetails: GAProcess['voucherDetails'], remarksToEmployee?: string, files?: string[]) => Promise<boolean>;
  
  // Legacy
  getPendingApprovals: () => TRF[];
  submitTRF: (id: string) => Promise<boolean>;
  
  // Status History
  getStatusHistory: (trfId: string) => StatusHistory[];
  addStatusHistory: (entry: Omit<StatusHistory, 'id' | 'changedAt'>) => Promise<void>;
  
  // Reference Data
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeesByType: (type: 'EMPLOYEE' | 'VISITOR') => Employee[];
  getUserById: (id: string) => User | undefined;
}

// Transformers
const transformUserFromDB = (dbUser: any): User => ({
  id: dbUser.id,
  username: dbUser.username,
  email: dbUser.email,
  role: dbUser.role as UserRole,
  employeeId: dbUser.employee_id,
  department: dbUser.department
});

const transformEmployeeFromDB = (dbEmp: any): Employee => ({
  id: dbEmp.id,
  userId: dbEmp.user_id || undefined,  // ✅ FIXED: Handle null
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
  return {
    id: dbTRF.id,
    trfNumber: dbTRF.trf_number,
    employeeId: dbTRF.employee_id,
    // ✅ Pake Fallback dari revisi sebelumnya
    employee: employees.find(e => e.id === dbTRF.employee_id) ?? {
      id: dbTRF.employee_id,
      employeeName: 'Unknown Employee',
      employeeType: 'EMPLOYEE'
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
    parallelApproval: dbTRF.parallel_approval,
    pmApproval: dbTRF.pm_approval,
    gaProcess: dbTRF.ga_process,
    submittedAt: dbTRF.submitted_at,
    createdAt: dbTRF.created_at,
    updatedAt: dbTRF.updated_at
  };
};

export const useTRFStore = create<TRFState>()(
  persist(
    (set, get) => ({
      trfs: mockTRFs, // Start with mock, replace after fetch
      statusHistory: mockStatusHistory,
      employees: mockEmployees,
      users: mockUsers,
      referenceData,
      isLoading: false,

      processTRFApproval: async (...args) => {
        return await processTRFApproval(...args);
      },
      
      // ============================================
      // FETCH OPERATIONS
      // ============================================

      fetchAllData: async () => {
        if (!isSupabaseEnabled()) {
          console.log('Supabase not enabled, using mock data');
          return;
        }

        set({ isLoading: true });
        
        try {
          await get().fetchEmployees();
          await get().fetchTRFs();
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchEmployees: async () => {
        if (!isSupabaseEnabled()) return;

        const { data, error } = await supabase
          .from('employees')
          .select('*');

        if (error) {
          console.error('Error fetching employees:', error);
          return;
        }

        if (data) {
          set({ employees: data.map(transformEmployeeFromDB) });
        }
      },

      fetchTRFs: async () => {
        if (!isSupabaseEnabled()) return;

        const { data, error } = await supabase
          .from('trfs')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching TRFs:', error);
          return;
        }

        if (data) {
          const employees = get().employees;
          set({ trfs: data.map(trf => transformTRFFromDB(trf, employees)) });
        }
      },

      // ============================================
      // CRUD OPERATIONS
      // ============================================

      getTRFById: (id) => {
        const trf = get().trfs.find((t) => t.id === id);
        if (trf) {
          const employee = get().employees.find((e) => e.id === trf.employeeId);
          return { ...trf, employee };
        }
        return undefined;
      },

      getTRFsByEmployee: (employeeId) => {
        return get().trfs
          .filter((t) => t.employeeId === employeeId)
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      getTRFsByStatus: (status) => {
        return get().trfs
          .filter((t) => t.status === status)
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      getTRFsByDepartment: (department) => {
        return get().trfs
          .filter((t) => t.department === department)
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      // ============================================
      // FUNGSI createTRF YANG SUDAH DIREVISI LAGI
      // ============================================
      createTRF: async (trfData) => {
        if (!isSupabaseEnabled()) return null;

        const now = new Date().toISOString();

        // ✅ REVISI: Cari tahu departemen dari data karyawan yang dipilih
        const employee = get().employees.find(
          e => e.id === trfData.employeeId
        );
        const department = employee?.department ?? null;

        // ✅ INSERT KE SUPABASE DULU
        const { data, error } = await supabase
          .from('trfs')
          .insert([{
            employee_id: trfData.employeeId,
            department: department, // ⭐ FIX: pakai department si karyawan
            travel_purpose: trfData.travelPurpose,
            start_date: trfData.startDate,
            end_date: trfData.endDate,
            purpose_remarks: trfData.purposeRemarks || null,
            status: 'SUBMITTED', // ⭐ Sesuai revisi dari teman Anda
            accommodation: trfData.accommodation || null,
            travel_arrangements: trfData.travelArrangements || []
          }])
          .select()
          .single();

        if (error || !data) {
          console.error(error);
          return null;
        }

        // ✅ pakai UUID asli dari DB
        const newTRF: TRF = {
          ...trfData,
          id: data.id,
          department: department || undefined, // Update local trfData dengan departemen yang benar
          trfNumber: data.trf_number,
          status: 'SUBMITTED', // ⭐ Sesuai revisi dari teman Anda
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          travelArrangements: trfData.travelArrangements || []
        };

        // update local store
        set((state) => ({
          trfs: [newTRF, ...state.trfs]
        }));

        // ✅ SEKARANG trf_id VALID UUID
        await get().addStatusHistory({
          trfId: data.id,
          changedBy: trfData.employeeId,
          changedByName: "System",
          newStatus: "SUBMITTED",
          remarks: "TRF created and submitted"
        });

        return newTRF;
      },

      updateTRF: async (id, updates) => {
        const now = new Date().toISOString();
        
        // Local update
        set((state) => ({
          trfs: state.trfs.map((trf) =>
            trf.id === id ? { ...trf, ...updates, updatedAt: now } : trf
          )
        }));

        // Supabase update
        if (isSupabaseEnabled()) {
          const dbUpdates: any = {};
          if (updates.travelPurpose) dbUpdates.travel_purpose = updates.travelPurpose;
          if (updates.startDate) dbUpdates.start_date = updates.startDate;
          if (updates.endDate) dbUpdates.end_date = updates.endDate;
          if (updates.purposeRemarks) dbUpdates.purpose_remarks = updates.purposeRemarks;
          if (updates.accommodation) dbUpdates.accommodation = updates.accommodation;
          if (updates.travelArrangements) dbUpdates.travel_arrangements = updates.travelArrangements;
          if (updates.status) dbUpdates.status = updates.status;

          const { error } = await supabase
            .from('trfs')
            .update(dbUpdates)
            .eq('id', id);

          if (error) {
            console.error('Error updating TRF:', error);
            return false;
          }
        }

        return true;
      },

      deleteTRF: async (id) => {
        // Local delete
        set((state) => ({
          trfs: state.trfs.filter((trf) => trf.id !== id),
          statusHistory: state.statusHistory.filter((sh) => sh.trfId !== id)
        }));

        // Supabase delete
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .delete()
            .eq('id', id);

          if (error) {
            console.error('Error deleting TRF:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // ROLE-BASED VISIBILITY
      // ============================================

      getVisibleTRFs: (user) => {
        let filtered = get().trfs;

        switch (user.role) {
          case 'EMPLOYEE':
            if (user.employeeId) {
              filtered = get().getTRFsByEmployee(user.employeeId);
            }
            break;
          case 'ADMIN_DEPT':
          case 'HOD':
            if (user.department) {
              filtered = get().getTRFsByDepartment(user.department);
            }
            break;
          case 'HR':
          case 'PM':
          case 'GA':
          case 'SUPER_ADMIN':
            break;
          default:
            filtered = [];
        }

        return filtered.map((trf) => {
          const employee = get().employees.find((e) => e.id === trf.employeeId);
          return { ...trf, employee };
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },

      // ============================================
      // ADMIN DEPT VERIFICATION
      // ============================================

      getTRFsForVerification: (department: string) => {
        const normalize = (v?: string) =>
          (v || '').trim().toLowerCase();

        return get().trfs.filter((trf) => {
          const sameDept =
            normalize(trf.department) === normalize(department);

          const isSubmitted =
            normalize(trf.status) === 'submitted';

          return sameDept && isSubmitted;
        });
      },

      verifyTRF: async (id, verifierId, verifierName, verified, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'SUBMITTED') return false;

        const verification: AdminDeptVerification = {
          verified,
          verifiedAt: now,
          verifiedBy: verifierId,
          verifierName,
          remarks
        };

        const newStatus: TRFStatus = verified ? 'PENDING_APPROVAL' : 'NEEDS_REVISION';

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: newStatus,
                  adminDeptVerify: verification,
                  parallelApproval: verified ? {
                    hod: { status: 'PENDING' },
                    hr: { status: 'PENDING' }
                  } : undefined,
                  updatedAt: now 
                }
              : t
          )
        }));
        
        
        get().addStatusHistory({
          trfId: id,
          changedBy: verifierId,
          changedByName: verifierName,
          oldStatus: 'SUBMITTED',
          newStatus,
          remarks: verified ? `Verified: ${remarks || 'OK'}` : `Not verified: ${remarks}`
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: newStatus,
              admin_dept_verify: verification,
              parallel_approval: verified ? {
                hod: { status: 'PENDING' },
                hr: { status: 'PENDING' }
              } : null
            })
            .eq('id', id);

          if (error) {
            console.error('Error verifying TRF:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // PARALLEL APPROVAL
      // ============================================

      getTRFsForApproval: (user) => {
        const { trfs } = get();
        
        return trfs.filter((t) => {
          if (user.role === 'HOD' && user.department) {
            return (
              t.department === user.department &&
              (t.status === 'PENDING_APPROVAL' || t.status === 'HR_APPROVED') &&
              t.parallelApproval?.hod?.status !== 'APPROVED'
            );
          }
          
          if (user.role === 'HR') {
            return (
              (t.status === 'PENDING_APPROVAL' || t.status === 'HOD_APPROVED') &&
              t.parallelApproval?.hr?.status !== 'APPROVED'
            );
          }
          
          return false;
        }).map((trf) => {
          const employee = get().employees.find((e) => e.id === trf.employeeId);
          return { ...trf, employee };
        });
      },

      hodApproveTRF: async (id, hodId, hodName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || !trf.parallelApproval) return false;

        const hodApproval = {
          status: approved ? 'APPROVED' as const : 'REJECTED' as const,
          actionAt: now,
          actionBy: hodId,
          actionByName: hodName,
          remarks
        };

        const newStatus: TRFStatus = approved 
          ? (trf.parallelApproval.hr?.status === 'APPROVED' ? 'PARALLEL_APPROVED' : 'HOD_APPROVED')
          : 'REJECTED';

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: newStatus,
                  parallelApproval: {
                    ...t.parallelApproval,
                    hod: hodApproval
                  },
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: hodId,
          changedByName: hodName,
          oldStatus: trf.status,
          newStatus,
          remarks: approved ? 'Approved by HoD' : `Rejected by HoD: ${remarks}`
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: newStatus,
              parallel_approval: {
                ...trf.parallelApproval,
                hod: hodApproval
              }
            })
            .eq('id', id);

          if (error) {
            console.error('Error HoD approval:', error);
            return false;
          }
        }

        return true;
      },

      hrApproveTRF: async (id, hrId, hrName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || !trf.parallelApproval) return false;

        const hrApproval = {
          status: approved ? 'APPROVED' as const : 'REJECTED' as const,
          actionAt: now,
          actionBy: hrId,
          actionByName: hrName,
          remarks
        };

        const newStatus: TRFStatus = approved 
          ? (trf.parallelApproval.hod?.status === 'APPROVED' ? 'PARALLEL_APPROVED' : 'HR_APPROVED')
          : 'NEEDS_REVISION';

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: newStatus,
                  parallelApproval: {
                    ...t.parallelApproval,
                    hr: hrApproval
                  },
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: hrId,
          changedByName: hrName,
          oldStatus: trf.status,
          newStatus,
          remarks: approved ? 'Approved by HR' : `Revision required by HR: ${remarks}`
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: newStatus,
              parallel_approval: {
                ...trf.parallelApproval,
                hr: hrApproval
              }
            })
            .eq('id', id);

          if (error) {
            console.error('Error HR approval:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // PM FINAL APPROVAL
      // ============================================

      getTRFsForPMApproval: () => {
        return get().trfs
          .filter((t) => t.status === 'PARALLEL_APPROVED')
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      pmApproveTRF: async (id, pmId, pmName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'PARALLEL_APPROVED') return false;

        const pmApproval: PMApproval = {
          approved,
          approvedAt: now,
          approvedBy: pmId,
          approverName: pmName,
          remarks
        };

        const newStatus: TRFStatus = approved ? 'PM_APPROVED' : 'REJECTED';

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: newStatus,
                  pmApproval,
                  approvedAt: approved ? now : undefined,
                  approvedBy: approved ? pmId : undefined,
                  approverName: approved ? pmName : undefined,
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: pmId,
          changedByName: pmName,
          oldStatus: 'PARALLEL_APPROVED',
          newStatus,
          remarks: remarks || (approved ? 'Final approval by PM' : 'Rejected by PM')
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: newStatus,
              pm_approval: pmApproval
            })
            .eq('id', id);

          if (error) {
            console.error('Error PM approval:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // GA PROCESS
      // ============================================

      getTRFsForProcessing: () => {
        return get().trfs
          .filter((t) => t.status === 'PM_APPROVED')
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      gaProcessTRF: async (id, gaId, gaName, voucherDetails, remarksToEmployee, files) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'PM_APPROVED') return false;

        const gaProcess: GAProcess = {
          processed: true,
          processedAt: now,
          processedBy: gaId,
          processorName: gaName,
          voucherDetails,
          files,
          remarksToEmployee
        };

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'GA_PROCESSED',
                  gaProcess,
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: gaId,
          changedByName: gaName,
          oldStatus: 'PM_APPROVED',
          newStatus: 'GA_PROCESSED',
          remarks: `Processed: ${remarksToEmployee || 'Voucher issued'}`
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: 'GA_PROCESSED',
              ga_process: gaProcess
            })
            .eq('id', id);

          if (error) {
            console.error('Error GA process:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // LEGACY
      // ============================================

      getPendingApprovals: () => {
        return get().trfs
          .filter((t) => t.status === 'SUBMITTED')
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      submitTRF: async (id) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'DRAFT') return false;

        // Local update
        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'SUBMITTED' as TRFStatus, 
                  submittedAt: now, 
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: trf.employeeId,
          changedByName: trf.employee?.employeeName || 'Unknown',
          oldStatus: 'DRAFT',
          newStatus: 'SUBMITTED'
        });

        // Supabase update
        if (isSupabaseEnabled()) {
          const { error } = await supabase
            .from('trfs')
            .update({
              status: 'SUBMITTED',
              submitted_at: now
            })
            .eq('id', id);

          if (error) {
            console.error('Error submitting TRF:', error);
            return false;
          }
        }

        return true;
      },

      // ============================================
      // STATUS HISTORY
      // ============================================

      getStatusHistory: (trfId) => {
        return get().statusHistory
          .filter((sh) => sh.trfId === trfId)
          .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
      },

      addStatusHistory: async (entry) => {
        const now = new Date().toISOString();
        const newEntry: StatusHistory = {
          ...entry,
          id: `sh-${Date.now()}`,
          changedAt: now
        };

        set((state) => ({
          statusHistory: [newEntry, ...state.statusHistory]
        }));

        // Supabase insert
        if (isSupabaseEnabled()) {
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
        }
      },

      // ============================================
      // REFERENCE DATA
      // ============================================

      getEmployeeById: (id) => {
        return get().employees.find((e) => e.id === id);
      },

      getEmployeesByType: (type) => {
        return get().employees.filter((e) => e.employeeType === type);
      },

      getUserById: (id) => {
        return get().users.find((u) => u.id === id);
      }
    }),
    {
      name: 'trf-storage'
    }
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