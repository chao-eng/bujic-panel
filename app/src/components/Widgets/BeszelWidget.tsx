import React from 'react';
import { Server } from 'lucide-react';

interface BeszelStats {
  status: 'up' | 'down';
  cpu: number;
  memory: number;
  disk: number;
  uptime: number;
  temperature?: number;
}

interface BeszelWidgetProps {
  title: string;
  stats?: BeszelStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}天${hours}时`;
  }
  if (hours > 0) {
    return `${hours}时${mins}分`;
  }
  return `${mins}分`;
}

export default function BeszelWidget({ title, stats, url, error, isLoading }: BeszelWidgetProps) {
  // 处理错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <Server size={15} />
          </div>
          <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
        </div>
        <div className="text-[10px] text-red-400/80 leading-snug mt-2 truncate-2-lines" title={error}>
          {error}
        </div>
      </div>
    );
  }

  // 兜底空状态
  if (!stats) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-white/20">
            <Server size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载监控数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  const isOnline = stats.status === 'up';

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 顶部标题行与在线状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/20 transition-all duration-300">
            <Server size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/95 truncate group-hover:text-indigo-300 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' : 'bg-white/25'}`} />
              <span className="text-[9px] text-white/40 font-medium">
                {isOnline ? '在线' : '离线'}
              </span>
            </div>
          </div>
        </div>
        
        {isOnline && stats.uptime > 0 && (
          <span className="text-[9px] text-white/30 font-mono tracking-tighter" title={`系统运行时间: ${stats.uptime} 秒`}>
            {formatUptime(stats.uptime)}
          </span>
        )}
      </div>

      {/* 底部指标区 */}
      {isOnline ? (
        <div className="space-y-1.5 mt-3">
          {/* CPU 进度条 */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-white/40 font-medium">
              <span>CPU</span>
              <span className="font-mono text-white/80">{stats.cpu.toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.cpu > 80 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                  stats.cpu > 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(stats.cpu, 100)}%` }}
              />
            </div>
          </div>

          {/* 内存进度条 */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-white/40 font-medium">
              <span>内存</span>
              <span className="font-mono text-white/80">{stats.memory.toFixed(0)}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.memory > 85 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                  stats.memory > 60 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                  'bg-gradient-to-r from-indigo-500 to-purple-500'
                }`}
                style={{ width: `${Math.min(stats.memory, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-white/25 text-center py-2 italic">
          服务器离线，无法获取指标
        </div>
      )}
    </div>
  );
}
