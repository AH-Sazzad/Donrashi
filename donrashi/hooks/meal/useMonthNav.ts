/**
 * Provides prev/next month navigation synced to the Zustand store.
 * Screens import this to get a consistent month switcher without duplicating logic.
 */
import { useCallback } from 'react';

import { useMealStore } from '@/store/mealStore';

export function useMonthNav() {
  const { selectedMonth, setSelectedMonth } = useMealStore();

  const [year, month] = selectedMonth.split('-').map(Number);

  const prev = useCallback(() => {
    let m = month - 1, y = year;
    if (m < 1) { m = 12; y--; }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  }, [month, year, setSelectedMonth]);

  const next = useCallback(() => {
    let m = month + 1, y = year;
    if (m > 12) { m = 1; y++; }
    setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`);
  }, [month, year, setSelectedMonth]);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = `${MONTH_NAMES[month - 1]} ${year}`;

  return { selectedMonth, label, prev, next, year, month };
}
