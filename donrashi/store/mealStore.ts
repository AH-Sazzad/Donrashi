/**
 * Zustand store for meal module client state.
 *
 * Only client-only state lives here:
 *  - activeMealBookId: persists which mess the user is in across navigation
 *  - selectedMonth: the YYYY-MM string being viewed (not fetched, just coordinated)
 *
 * Server state (balances, records, members, etc.) stays in component useState.
 * We deliberately avoid caching server responses here — they live on the backend.
 */
import { create } from 'zustand';

interface MealStore {
  /** The meal book currently open — set when user enters a book, cleared on exit */
  activeMealBookId: number | null;
  setActiveMealBookId: (id: number | null) => void;

  /** The month being viewed in YYYY-MM format */
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;

  /** Whether the current user is manager of the active book */
  isManager: boolean;
  setIsManager: (v: boolean) => void;
}

export const useMealStore = create<MealStore>((set) => ({
  activeMealBookId: null,
  setActiveMealBookId: (id) => set({ activeMealBookId: id }),

  selectedMonth: new Date().toISOString().slice(0, 7),
  setSelectedMonth: (month) => set({ selectedMonth: month }),

  isManager: false,
  setIsManager: (v) => set({ isManager: v }),
}));
