import { create } from 'zustand'

interface GlobalStore {
  dateRange: { from: string; to: string }
  department: string | null
  setDepartment: (d: string | null) => void
  setDateRange: (r: { from: string; to: string }) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  pendingActionsCount: number
}

export const useGlobalStore = create<GlobalStore>((set) => ({
  dateRange: { from: '2025-03-06', to: '2025-04-05' },
  department: null,
  setDepartment: (d) => set({ department: d }),
  setDateRange: (r) => set({ dateRange: r }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  pendingActionsCount: 3,
}))
