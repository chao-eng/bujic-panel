'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '../../actions/userActions';
import { useTranslation } from '../../components/I18nProvider';
import { Languages, User, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { encryptSensitive } from '../../lib/client-crypto';

export default function LoginPage() {
  const { t, locale, setLocale } = useTranslation();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setErrorMsg('');

    startTransition(async () => {
      // 提交前对密码加密，防止明文出现在网络请求体中
      const encryptedPassword = await encryptSensitive(password);
      const res = await loginAction({ username, password: encryptedPassword });
      if (res.success) {
        // 登录成功，跳转到仪表盘主页
        router.push('/');
        router.refresh();
      } else {
        if (res.code === 1003) {
          setErrorMsg(t.loginFailed);
        } else {
          setErrorMsg(res.message || '登录失败');
        }
      }
    });
  };

  const toggleLanguage = () => {
    setLocale(locale === 'zh' ? 'en' : 'zh');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-6">
      {/* 宇宙极光背景装饰 */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* 顶部语言切换悬浮按钮 */}
      <button
        onClick={toggleLanguage}
        className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 active:scale-95 transition text-sm text-white/80 cursor-pointer"
      >
        <Languages size={15} />
        <span>{locale === 'zh' ? 'English' : '简体中文'}</span>
      </button>

      {/* 登录卡片 */}
      <div className="w-full max-w-[420px] z-10 animate-fade-in duration-700">
        <div className="glass-panel p-8 rounded-2xl glow-effect">
          {/* Logo 区域 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg mb-4 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 2V3M7 11V12M2 7H3M11 7H12" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                <path d="M18 20C17.5 15.5 16 11.5 13 9" />
                <path d="M13 9C10.5 8.5 8 9.5 7 11.5" />
                <path d="M13 9C11 7 9.5 5 11 3" />
                <path d="M13 9C14.5 7 16.5 6.5 18.5 7.5" />
                <path d="M13 9C15.5 10 17 11.5 17.5 13.5" />
                <path d="M13 9C13 11 12 13 10.5 14" />
                <path d="M2 20C5 18 13 17 22 20" />
                <path d="M4 22C6 21.5 8 21.5 10 22C12 22.5 14 22.5 16 22C18 21.5 20 21.5 22 22" strokeWidth="1.5" opacity="0.8" />
              </svg>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white mb-2">
              {t.loginTitle}
            </h1>
            <p className="text-xs text-white/40 tracking-wider">
              {t.loginSubtitle}
            </p>
          </div>

          {/* 表单区域 */}
          <form onSubmit={handleLogin} className="space-y-5">
            {errorMsg && (
              <div className="text-xs font-semibold px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 animate-shake">
                {errorMsg}
              </div>
            )}

            {/* 用户名 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 tracking-wide uppercase px-1">
                {t.username}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30 group-focus-within:text-indigo-400 transition-colors">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  required
                  disabled={isPending}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/5 hover:border-white/10 focus:border-indigo-500/40 rounded-xl text-white text-sm placeholder-white/25 outline-none transition-all"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 tracking-wide uppercase px-1">
                {t.password}
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/30 group-focus-within:text-indigo-400 transition-colors">
                  <Lock size={16} />
                </div>
                <input
                  type="password"
                  required
                  disabled={isPending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/5 hover:border-white/10 focus:border-indigo-500/40 rounded-xl text-white text-sm placeholder-white/25 outline-none transition-all"
                />
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isPending || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm transition-all duration-300 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-98 disabled:opacity-40 disabled:pointer-events-none cursor-pointer mt-2"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t.fetching}</span>
                </>
              ) : (
                <>
                  <span>{t.login}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
