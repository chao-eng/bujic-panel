import React from 'react';
import { Activity, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';

interface UptimeKumaStats {
  totalMonitors: number;
  upMonitors: number;
  downMonitors: number;
  avgPing: number;
}

interface UptimeKumaWidgetProps {
  title: string;
  stats?: UptimeKumaStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

export default function UptimeKumaWidget({ title, stats, url, error, isLoading }: UptimeKumaWidgetProps) {
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <Activity size={15} />
          </div>
          <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
        </div>
        <div className="text-[10px] text-red-400/80 leading-snug mt-2 truncate-2-lines" title={error}>
          {error}
        </div>
      </div>
    );
  }

  // 待配置 / 加载状态
  if (!stats) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-white/20">
            <Activity size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载监控数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  const hasErrors = stats.downMonitors > 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 顶部标题行与在线率状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 flex-shrink-0 ${
              hasErrors
                ? 'bg-rose-500/10 border-rose-500/10 text-rose-400 group-hover:border-rose-500/30 group-hover:bg-rose-500/20'
                : 'bg-emerald-500/10 border-emerald-500/10 text-emerald-400 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/20'
            }`}
          >
            <Activity size={15} />
          </div>
          <div className="min-w-0">
            <h4
              className={`text-xs font-bold text-white/95 truncate transition-colors ${
                hasErrors ? 'group-hover:text-rose-300' : 'group-hover:text-emerald-300'
              }`}
            >
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasErrors
                    ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                }`}
              />
              <span className="text-[9px] text-white/40 font-medium">
                {hasErrors ? `${stats.downMonitors} 项服务离线` : '服务运行正常'}
              </span>
            </div>
          </div>
        </div>

        {/* 响应时间角标 */}
        {stats.avgPing > 0 && (
          <div className="flex items-center gap-1 text-[8px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
            <Clock size={8} />
            <span>平均延迟: {stats.avgPing} ms</span>
          </div>
        )}
      </div>

      {/* 核心指标统计区 */}
      <div className="grid grid-cols-3 gap-2.5 mt-2.5">
        {/* 服务健康率 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <ShieldCheck size={9} className="text-emerald-400" />
            <span>正常监控</span>
          </div>
          <span className="font-mono font-extrabold text-emerald-400 text-center text-sm truncate" title={`正常运行数: ${stats.upMonitors}`}>
            {stats.upMonitors} / {stats.totalMonitors}
          </span>
        </div>

        {/* 异常服务数 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <ShieldAlert size={9} className={hasErrors ? 'text-rose-400' : 'text-white/20'} />
            <span>离线监控</span>
          </div>
          <span
            className={`font-mono font-extrabold text-center text-sm truncate ${
              hasErrors ? 'text-rose-400 animate-pulse' : 'text-white/30'
            }`}
            title={`当前异常服务数: ${stats.downMonitors}`}
          >
            {stats.downMonitors}
          </span>
        </div>

        {/* 响应延迟 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <Clock size={9} className="text-indigo-400" />
            <span>平均响应</span>
          </div>
          <span className="font-mono font-extrabold text-indigo-400 text-center text-sm truncate" title={`平均响应时间: ${stats.avgPing}ms`}>
            {stats.avgPing > 0 ? `${stats.avgPing} ms` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
