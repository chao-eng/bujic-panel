'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '../../actions/userActions';
import { useTranslation } from '../../components/I18nProvider';
import { Languages, User, Lock, ArrowRight, Loader2 } from 'lucide-react';

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
      const res = await loginAction({ username, password });
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-lg mb-4">
              <span className="font-heading font-extrabold text-2xl text-white select-none">AG</span>
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
