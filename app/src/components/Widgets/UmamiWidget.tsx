import React from 'react';
import { BarChart3, Users, MousePointerClick, Eye } from 'lucide-react';

interface UmamiStats {
  visitors: number;
  visits: number;
  pageviews: number;
}

interface UmamiWidgetProps {
  title: string;
  stats?: UmamiStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

export default function UmamiWidget({ title, stats, url, error, isLoading }: UmamiWidgetProps) {
  // 处理错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <BarChart3 size={15} />
          </div>
          <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
        </div>
        <div className="text-[10px] text-red-400/80 leading-snug mt-2 truncate-2-lines" title={error}>
          {error}
        </div>
      </div>
    );
  }

  // 兜底空状态 / 加载状态
  if (!stats) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-white/20">
            <BarChart3 size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载访问数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 顶部标题行与状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/20 transition-all duration-300">
            <BarChart3 size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/95 truncate group-hover:text-indigo-300 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
              <span className="text-[9px] text-white/40 font-medium">监测中</span>
            </div>
          </div>
        </div>

        {/* 最近 24 小时角标 */}
        <div className="flex items-center gap-1 text-[8px] bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
          <span>最近 24 小时</span>
        </div>
      </div>

      {/* 核心指标统计区 */}
      <div className="grid grid-cols-3 gap-2.5 mt-2.5">
        {/* 独立访客 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <Users size={9} className="text-indigo-400" />
            <span>独立访客 (UV)</span>
          </div>
          <span className="font-mono font-extrabold text-indigo-400 text-center text-sm truncate" title={`访客数: ${stats.visitors}`}>
            {stats.visitors.toLocaleString()}
          </span>
        </div>

        {/* 访问次数 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <MousePointerClick size={9} className="text-purple-400" />
            <span>访问次数</span>
          </div>
          <span className="font-mono font-extrabold text-purple-400 text-center text-sm truncate" title={`访问数: ${stats.visits}`}>
            {stats.visits.toLocaleString()}
          </span>
        </div>

        {/* 页面浏览量 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <Eye size={9} className="text-emerald-400" />
            <span>浏览量 (PV)</span>
          </div>
          <span className="font-mono font-extrabold text-emerald-400 text-center text-sm truncate" title={`浏览量: ${stats.pageviews}`}>
            {stats.pageviews.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
