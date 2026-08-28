import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from './translations';
import { api } from '../api/client';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  isRtl: boolean;
}

export type { LocaleContextType };

export const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children, initialLocale = 'en' }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.dir = locale === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      await api.request('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ locale: newLocale }),
      });
    } catch {
      // Ignore network errors on offline/local persist failure
    }
  };

  const t = (key: string, vars?: Record<string, string | number>): string => {
    const dict = translations[locale] || translations.en;
    let template = dict[key] || translations.en[key] || key;
    if (vars) {
      for (const [name, val] of Object.entries(vars)) {
        template = template.split(`{${name}}`).join(String(val));
      }
    }
    return template;
  };

  const isRtl = locale === 'ur';

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, isRtl }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
}
