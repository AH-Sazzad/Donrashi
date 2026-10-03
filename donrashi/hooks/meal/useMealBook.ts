/**
 * Loads a meal book, its dashboard, meal types, and members in one shot.
 * Sets the Zustand store so other tabs know the active book and role.
 */
import { useCallback, useEffect, useState } from 'react';

import { useMealStore } from '@/store/mealStore';
import { mealBooksApi, mealMembersApi, mealTypesApi } from '@/services/mealApi';
import { MealBook, MealBookDashboard, MealBookMember, MealType } from '@/types';

interface State {
  book:     MealBook | null;
  dash:     MealBookDashboard | null;
  types:    MealType[];
  members:  MealBookMember[];
  loading:  boolean;
  refreshing: boolean;
  error:    string | null;
}

export function useMealBook(mealBookId: number) {
  const setActiveMealBookId = useMealStore(s => s.setActiveMealBookId);
  const setIsManager        = useMealStore(s => s.setIsManager);
  const selectedMonth       = useMealStore(s => s.selectedMonth);

  const [state, setState] = useState<State>({
    book: null, dash: null, types: [], members: [],
    loading: true, refreshing: false, error: null,
  });

  const load = useCallback(async (refresh = false) => {
    setState(s => ({ ...s, loading: !refresh, refreshing: refresh, error: null }));
    try {
      const [book, dash, types, members] = await Promise.all([
        mealBooksApi.get(mealBookId),
        mealBooksApi.dashboard(mealBookId, selectedMonth),
        mealTypesApi.list(mealBookId),
        mealMembersApi.list(mealBookId),
      ]);
      setActiveMealBookId(mealBookId);
      setIsManager(dash.my_role === 'manager');
      setState({
        book, dash, types,
        members: Array.isArray(members) ? members : [],
        loading: false, refreshing: false, error: null,
      });
    } catch (e: unknown) {
      setState(s => ({
        ...s, loading: false, refreshing: false,
        error: e instanceof Error ? e.message : 'Failed to load meal book.',
      }));
    }
  }, [mealBookId, selectedMonth, setActiveMealBookId, setIsManager]);

  useEffect(() => { load(); }, [load]);

  return { ...state, reload: () => load(true) };
}
