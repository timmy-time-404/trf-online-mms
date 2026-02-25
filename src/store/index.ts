// TRF Online System - Zustand Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  UserRole, 
  TRF, 
  TRFStatus, 
  Employee, 
  StatusHistory,
  ParallelApproval,
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

// ============================================
// AUTH STORE
// ============================================

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isAuthenticated: false,
      login: (user) => set({ currentUser: user, isAuthenticated: true }),
      logout: () => set({ currentUser: null, isAuthenticated: false }),
      switchRole: (role) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, role } : null
      }))
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
  
  // CRUD Operations
  getTRFById: (id: string) => TRF | undefined;
  getTRFsByEmployee: (employeeId: string) => TRF[];
  getTRFsByStatus: (status: TRFStatus) => TRF[];
  getTRFsByDepartment: (department: string) => TRF[];
  createTRF: (trf: Omit<TRF, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt' | 'status'>) => TRF;
  updateTRF: (id: string, updates: Partial<TRF>) => void;
  deleteTRF: (id: string) => void;
  
  // NEW: Role-based visibility
  getVisibleTRFs: (user: User) => TRF[];
  
  // NEW: Admin Dept Verification
  getTRFsForVerification: (department: string) => TRF[];
  verifyTRF: (id: string, verifierId: string, verifierName: string, verified: boolean, remarks?: string) => void;
  
  // NEW: Parallel Approval (HoD & HR)
  getTRFsForApproval: (user: User) => TRF[];
  hodApproveTRF: (id: string, hodId: string, hodName: string, approved: boolean, remarks?: string) => void;
  hrApproveTRF: (id: string, hrId: string, hrName: string, approved: boolean, remarks?: string) => void;
  
  // NEW: PM Final Approval
  getTRFsForPMApproval: () => TRF[];
  pmApproveTRF: (id: string, pmId: string, pmName: string, approved: boolean, remarks?: string) => void;
  
  // NEW: GA Process
  getTRFsForProcessing: () => TRF[];
  gaProcessTRF: (id: string, gaId: string, gaName: string, voucherDetails: GAProcess['voucherDetails'], remarksToEmployee?: string, files?: string[]) => void;
  
  // Legacy (for backward compatibility)
  getPendingApprovals: () => TRF[];
  submitTRF: (id: string) => void;
  approveTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  rejectTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  reviseTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  
  // Status History
  getStatusHistory: (trfId: string) => StatusHistory[];
  addStatusHistory: (entry: Omit<StatusHistory, 'id' | 'changedAt'>) => void;
  
  // Reference Data
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeesByType: (type: 'EMPLOYEE' | 'VISITOR') => Employee[];
  getUserById: (id: string) => User | undefined;
}

const generateTRFNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 900) + 100;
  return `TRF-${date}-${random}`;
};

export const useTRFStore = create<TRFState>()(
  persist(
    (set, get) => ({
      trfs: mockTRFs,
      statusHistory: mockStatusHistory,
      employees: mockEmployees,
      users: mockUsers,
      referenceData,

      // ============================================
      // BASIC CRUD
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

      createTRF: (trfData) => {
        const now = new Date().toISOString();
        const newTRF: TRF = {
          ...trfData,
          id: `trf-${Date.now()}`,
          trfNumber: generateTRFNumber(),
          status: 'DRAFT',
          createdAt: now,
          updatedAt: now
        };

        set((state) => ({
          trfs: [newTRF, ...state.trfs]
        }));

        // Add status history
        get().addStatusHistory({
          trfId: newTRF.id,
          changedBy: trfData.employeeId,
          changedByName: newTRF.employee?.employeeName || 'Unknown',
          newStatus: 'DRAFT'
        });

        return newTRF;
      },

      updateTRF: (id, updates) => {
        const now = new Date().toISOString();
        set((state) => ({
          trfs: state.trfs.map((trf) =>
            trf.id === id ? { ...trf, ...updates, updatedAt: now } : trf
          )
        }));
      },

      deleteTRF: (id) => {
        set((state) => ({
          trfs: state.trfs.filter((trf) => trf.id !== id),
          statusHistory: state.statusHistory.filter((sh) => sh.trfId !== id)
        }));
      },

      // ============================================
      // ROLE-BASED VISIBILITY
      // ============================================

      getVisibleTRFs: (user) => {
        let filtered = get().trfs;

        switch (user.role) {
          case 'EMPLOYEE':
            // Employee hanya lihat TRF sendiri
            if (user.employeeId) {
              filtered = get().getTRFsByEmployee(user.employeeId);
            }
            break;

          case 'ADMIN_DEPT':
          case 'HOD':
            // Admin Dept & HoD hanya lihat TRF department mereka
            if (user.department) {
              filtered = get().getTRFsByDepartment(user.department);
            }
            break;

          case 'HR':
          case 'PM':
          case 'GA':
          case 'SUPER_ADMIN':
            // HR, PM, GA, Super Admin lihat semua
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

      getTRFsForVerification: (department) => {
        return get().trfs
          .filter((t) => 
            t.department === department && 
            t.status === 'SUBMITTED'
          )
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      verifyTRF: (id, verifierId, verifierName, verified, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'SUBMITTED') return;

        const verification: AdminDeptVerification = {
          verified,
          verifiedAt: now,
          verifiedBy: verifierId,
          verifierName,
          remarks
        };

        if (verified) {
          // Verified = lanjut ke parallel approval
          const newStatus: TRFStatus = 'PENDING_APPROVAL';
          
          set((state) => ({
            trfs: state.trfs.map((t) =>
              t.id === id
                ? { 
                    ...t, 
                    status: newStatus,
                    adminDeptVerify: verification,
                    parallelApproval: {
                      hod: { status: 'PENDING' },
                      hr: { status: 'PENDING' }
                    },
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
            remarks: `Verified: ${remarks || 'OK'}`
          });
        } else {
          // Not verified = kembali ke employee
          set((state) => ({
            trfs: state.trfs.map((t) =>
              t.id === id
                ? { 
                    ...t, 
                    status: 'NEEDS_REVISION',
                    adminDeptVerify: verification,
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
            newStatus: 'NEEDS_REVISION',
            remarks: `Not verified: ${remarks || 'Does not meet requirements'}`
          });
        }
      },

      // ============================================
      // PARALLEL APPROVAL (HoD & HR)
      // ============================================

      getTRFsForApproval: (user) => {
        const { trfs } = get();
        
        return trfs.filter((t) => {
          // HoD: lihat TRF dari department mereka yang pending HoD approval
          if (user.role === 'HOD' && user.department) {
            return (
              t.department === user.department &&
              (t.status === 'PENDING_APPROVAL' || t.status === 'HR_APPROVED') &&
              t.parallelApproval?.hod?.status !== 'APPROVED'
            );
          }
          
          // HR: lihat semua TRF yang pending HR approval
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

      hodApproveTRF: (id, hodId, hodName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || !trf.parallelApproval) return;

        const hodApproval = {
          status: approved ? 'APPROVED' as const : 'REJECTED' as const,
          actionAt: now,
          actionBy: hodId,
          actionByName: hodName,
          remarks
        };

        if (!approved) {
          // HoD reject = TRF rejected
          set((state) => ({
            trfs: state.trfs.map((t) =>
              t.id === id
                ? { 
                    ...t, 
                    status: 'REJECTED',
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
            newStatus: 'REJECTED',
            remarks: `Rejected by HoD: ${remarks}`
          });
          return;
        }

        // HoD approved - check if HR also approved
        const hrStatus = trf.parallelApproval.hr?.status;
        let newStatus: TRFStatus;

        if (hrStatus === 'APPROVED') {
          newStatus = 'PARALLEL_APPROVED';
        } else {
          newStatus = 'HOD_APPROVED';
        }

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
          remarks: remarks || 'Approved by HoD'
        });
      },

      hrApproveTRF: (id, hrId, hrName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || !trf.parallelApproval) return;

        const hrApproval = {
          status: approved ? 'APPROVED' as const : 'REJECTED' as const,
          actionAt: now,
          actionBy: hrId,
          actionByName: hrName,
          remarks
        };

        if (!approved) {
          // HR reject = TRF needs revision (bisa diperbaiki)
          set((state) => ({
            trfs: state.trfs.map((t) =>
              t.id === id
                ? { 
                    ...t, 
                    status: 'NEEDS_REVISION',
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
            newStatus: 'NEEDS_REVISION',
            remarks: `Revision required by HR: ${remarks}`
          });
          return;
        }

        // HR approved - check if HoD also approved
        const hodStatus = trf.parallelApproval.hod?.status;
        let newStatus: TRFStatus;

        if (hodStatus === 'APPROVED') {
          newStatus = 'PARALLEL_APPROVED';
        } else {
          newStatus = 'HR_APPROVED';
        }

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
          remarks: remarks || 'Approved by HR'
        });
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

      pmApproveTRF: (id, pmId, pmName, approved, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'PARALLEL_APPROVED') return;

        const pmApproval: PMApproval = {
          approved,
          approvedAt: now,
          approvedBy: pmId,
          approverName: pmName,
          remarks
        };

        const newStatus: TRFStatus = approved ? 'PM_APPROVED' : 'REJECTED';

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

      gaProcessTRF: (id, gaId, gaName, voucherDetails, remarksToEmployee, files) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'PM_APPROVED') return;

        const gaProcess: GAProcess = {
          processed: true,
          processedAt: now,
          processedBy: gaId,
          processorName: gaName,
          voucherDetails,
          files,
          remarksToEmployee
        };

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
      },

      // ============================================
      // LEGACY METHODS (Backward Compatibility)
      // ============================================

      getPendingApprovals: () => {
        // Legacy: return SUBMITTED TRFs
        return get().trfs
          .filter((t) => t.status === 'SUBMITTED')
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          });
      },

      submitTRF: (id) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'DRAFT') return;

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
      },

      approveTRF: (id, approverId, approverName, remarks) => {
        // Legacy method - redirect to pmApproveTRF for new flow
        get().pmApproveTRF(id, approverId, approverName, true, remarks);
      },

      rejectTRF: (id, approverId, approverName, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf) return;

        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'REJECTED' as TRFStatus, 
                  approvedBy: approverId,
                  approverName,
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: approverId,
          changedByName: approverName,
          oldStatus: trf.status,
          newStatus: 'REJECTED',
          remarks
        });
      },

      reviseTRF: (id, approverId, approverName, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf) return;

        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'NEEDS_REVISION' as TRFStatus,
                  approvedBy: approverId,
                  approverName,
                  updatedAt: now 
                }
              : t
          )
        }));

        get().addStatusHistory({
          trfId: id,
          changedBy: approverId,
          changedByName: approverName,
          oldStatus: trf.status,
          newStatus: 'NEEDS_REVISION',
          remarks
        });
      },

      // ============================================
      // STATUS HISTORY
      // ============================================

      getStatusHistory: (trfId) => {
        return get().statusHistory
          .filter((sh) => sh.trfId === trfId)
          .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
      },

      addStatusHistory: (entry) => {
        const now = new Date().toISOString();
        const newEntry: StatusHistory = {
          ...entry,
          id: `sh-${Date.now()}`,
          changedAt: now
        };

        set((state) => ({
          statusHistory: [newEntry, ...state.statusHistory]
        }));
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