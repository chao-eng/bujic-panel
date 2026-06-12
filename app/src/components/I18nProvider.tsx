'use client';

import React, { useState, useEffect } from 'react';
import { I18nContext, Locale, dictionaries } from '../lib/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('locale') as Locale;
    if (saved && (saved === 'zh' || saved === 'en')) {
      setLocaleState(saved);
    } else {
      // 检查浏览器默认语言
      const navLang = navigator.language.toLowerCase();
      if (navLang.startsWith('en')) {
        setLocaleState('en');
      }
    }
    setMounted(true);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('locale', l);
    // 写入 Cookie 供服务端组件做语言对齐
    document.cookie = `locale=${l}; path=/; max-age=31536000`;
  };

  const t = dictionaries[locale];

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return React.useContext(I18nContext);
}
