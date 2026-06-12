'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { I18nContext, Locale, dictionaries } from '../lib/i18n';
import { ThemeId, DEFAULT_THEME, THEME_STORAGE_KEY } from '../lib/themes';

const ThemeContext = createContext<{
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
}>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved && (saved === 'zh' || saved === 'en')) {
      setLocaleState(saved);
    } else {
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('en')) {
        setLocaleState('en');
      }
    }

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId;
    if (savedTheme) {
      setThemeState(savedTheme);
      if (savedTheme !== DEFAULT_THEME) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
    document.cookie = `locale=${l}; path=/; max-age=31536000`;
  };

  const setTheme = (id: ThemeId) => {
    setThemeState(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    if (id === DEFAULT_THEME) {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', id);
    }
  };

  const t = dictionaries[locale];

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        {children}
      </ThemeContext.Provider>
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return React.useContext(I18nContext);
}

export function useTheme() {
  return useContext(ThemeContext);
}
