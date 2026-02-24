// TRF Online System - Zustand Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole, TRF, TRFStatus, Employee, StatusHistory } from '@/types';
import { 
  mockEmployees, 
  mockTRFs, 
  mockStatusHistory,
  referenceData 
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
  referenceData: typeof referenceData;
  
  // CRUD Operations
  getTRFById: (id: string) => TRF | undefined;
  getTRFsByEmployee: (employeeId: string) => TRF[];
  getTRFsByStatus: (status: TRFStatus) => TRF[];
  getPendingApprovals: () => TRF[];
  createTRF: (trf: Omit<TRF, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt' | 'status'>) => TRF;
  updateTRF: (id: string, updates: Partial<TRF>) => void;
  deleteTRF: (id: string) => void;
  
  // Status Operations
  submitTRF: (id: string) => void;
  approveTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  rejectTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  reviseTRF: (id: string, approverId: string, approverName: string, remarks?: string) => void;
  
  // Status History
  getStatusHistory: (trfId: string) => StatusHistory[];
  
  // Reference Data
  getEmployeeById: (id: string) => Employee | undefined;
  getEmployeesByType: (type: 'EMPLOYEE' | 'VISITOR') => Employee[];
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
      referenceData,

      getTRFById: (id) => {
        const trf = get().trfs.find((t) => t.id === id);
        if (trf) {
          // Attach employee data
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

      getPendingApprovals: () => {
        return get().trfs
          .filter((t) => t.status === 'SUBMITTED')
          .map((trf) => {
            const employee = get().employees.find((e) => e.id === trf.employeeId);
            return { ...trf, employee };
          })
          .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
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
        const historyEntry: StatusHistory = {
          id: `sh-${Date.now()}`,
          trfId: newTRF.id,
          changedBy: trfData.employeeId,
          changedByName: newTRF.employee?.employeeName || 'Unknown',
          newStatus: 'DRAFT',
          changedAt: now
        };

        set((state) => ({
          statusHistory: [historyEntry, ...state.statusHistory]
        }));

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

      submitTRF: (id) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'DRAFT') return;

        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { ...t, status: 'SUBMITTED' as TRFStatus, submittedAt: now, updatedAt: now }
              : t
          )
        }));

        // Add status history
        const historyEntry: StatusHistory = {
          id: `sh-${Date.now()}`,
          trfId: id,
          changedBy: trf.employeeId,
          changedByName: trf.employee?.employeeName || 'Unknown',
          oldStatus: 'DRAFT',
          newStatus: 'SUBMITTED',
          changedAt: now
        };

        set((state) => ({
          statusHistory: [historyEntry, ...state.statusHistory]
        }));
      },

      approveTRF: (id, approverId, approverName, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'SUBMITTED') return;

        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'APPROVED' as TRFStatus, 
                  approvedAt: now, 
                  approvedBy: approverId,
                  approverName,
                  updatedAt: now 
                }
              : t
          )
        }));

        // Add status history
        const historyEntry: StatusHistory = {
          id: `sh-${Date.now()}`,
          trfId: id,
          changedBy: approverId,
          changedByName: approverName,
          oldStatus: 'SUBMITTED',
          newStatus: 'APPROVED',
          remarks,
          changedAt: now
        };

        set((state) => ({
          statusHistory: [historyEntry, ...state.statusHistory]
        }));
      },

      rejectTRF: (id, approverId, approverName, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'SUBMITTED') return;

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

        // Add status history
        const historyEntry: StatusHistory = {
          id: `sh-${Date.now()}`,
          trfId: id,
          changedBy: approverId,
          changedByName: approverName,
          oldStatus: 'SUBMITTED',
          newStatus: 'REJECTED',
          remarks,
          changedAt: now
        };

        set((state) => ({
          statusHistory: [historyEntry, ...state.statusHistory]
        }));
      },

      reviseTRF: (id, approverId, approverName, remarks) => {
        const now = new Date().toISOString();
        const trf = get().trfs.find((t) => t.id === id);
        
        if (!trf || trf.status !== 'SUBMITTED') return;

        set((state) => ({
          trfs: state.trfs.map((t) =>
            t.id === id
              ? { 
                  ...t, 
                  status: 'REVISED' as TRFStatus,
                  approvedBy: approverId,
                  approverName,
                  updatedAt: now 
                }
              : t
          )
        }));

        // Add status history
        const historyEntry: StatusHistory = {
          id: `sh-${Date.now()}`,
          trfId: id,
          changedBy: approverId,
          changedByName: approverName,
          oldStatus: 'SUBMITTED',
          newStatus: 'REVISED',
          remarks,
          changedAt: now
        };

        set((state) => ({
          statusHistory: [historyEntry, ...state.statusHistory]
        }));
      },

      getStatusHistory: (trfId) => {
        return get().statusHistory
          .filter((sh) => sh.trfId === trfId)
          .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
      },

      getEmployeeById: (id) => {
        return get().employees.find((e) => e.id === id);
      },

      getEmployeesByType: (type) => {
        return get().employees.filter((e) => e.employeeType === type);
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
