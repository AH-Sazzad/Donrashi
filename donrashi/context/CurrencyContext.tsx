import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type SupportedCurrency = 'BDT' | 'USD' | 'EUR';

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
};

export const CURRENCY_NAMES: Record<SupportedCurrency, string> = {
  BDT: 'Bangladeshi Taka',
  USD: 'US Dollar',
  EUR: 'Euro',
};

/**
 * Static fallback rates (base = BDT).
 * Rates are updated from open.er-api.com on app start.
 * 1 BDT = x CURRENCY
 */
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  BDT: 1,
  USD: 0.0091,  // ~110 BDT = 1 USD
  EUR: 0.0084,  // ~119 BDT = 1 EUR
};

interface CurrencyContextValue {
  baseCurrency: SupportedCurrency;
  setBaseCurrency: (c: SupportedCurrency) => void;
  rates: Record<SupportedCurrency, number>;
  /** Convert an amount FROM a given currency TO the base currency */
  toBase: (amount: number, fromCurrency: SupportedCurrency) => number;
  /** Format a number in the base currency with symbol */
  formatBase: (amount: number) => string;
  /** Format in any given currency */
  formatCurrency: (amount: number, currency: SupportedCurrency) => string;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = '@donrashi_base_currency';

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBaseCurrencyState] = useState<SupportedCurrency>('BDT');
  const [rates, setRates] = useState<Record<SupportedCurrency, number>>(FALLBACK_RATES);

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'BDT' || saved === 'USD' || saved === 'EUR') {
        setBaseCurrencyState(saved);
      }
    });
  }, []);

  // Fetch live rates (base BDT) — silent fail, uses fallback
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/BDT')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          setRates({
            BDT: 1,
            USD: Number(data.rates['USD']) || FALLBACK_RATES.USD,
            EUR: Number(data.rates['EUR']) || FALLBACK_RATES.EUR,
          });
        }
      })
      .catch(() => {/* use fallback */});
  }, []);

  const setBaseCurrency = useCallback((c: SupportedCurrency) => {
    setBaseCurrencyState(c);
    AsyncStorage.setItem(STORAGE_KEY, c);
  }, []);

  /**
   * Convert amount from any currency to base currency.
   * rates are all relative to BDT (1 BDT = x USD).
   * So to go USD → BDT: amount / rates.USD
   * Then BDT → base: result * rates[base]
   */
  const toBase = useCallback(
    (amount: number, fromCurrency: SupportedCurrency): number => {
      if (fromCurrency === baseCurrency) return amount;
      // Convert to BDT first
      const inBDT = fromCurrency === 'BDT' ? amount : amount / rates[fromCurrency];
      // Then BDT to base
      if (baseCurrency === 'BDT') return inBDT;
      return inBDT * rates[baseCurrency];
    },
    [baseCurrency, rates]
  );

  const formatCurrency = useCallback(
    (amount: number, currency: SupportedCurrency): string => {
      const sym = CURRENCY_SYMBOLS[currency];
      const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(amount));
      return `${sym}${formatted}`;
    },
    []
  );

  const formatBase = useCallback(
    (amount: number) => formatCurrency(amount, baseCurrency),
    [formatCurrency, baseCurrency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency,
        setBaseCurrency,
        rates,
        toBase,
        formatBase,
        formatCurrency,
        symbol: CURRENCY_SYMBOLS[baseCurrency],
      }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider');
  return ctx;
}
