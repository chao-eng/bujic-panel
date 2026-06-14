import React from 'react';
import { Shield, ArrowDown, ArrowUp, Users } from 'lucide-react';
import { formatBytes } from './QbittorrentWidget';

interface WgEasyStats {
  totalClients: number;
  enabledClients: number;
  connectedClients: number;
  totalRx: number;
  totalTx: number;
}

interface WgEasyWidgetProps {
  title: string;
  stats?: WgEasyStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

export default function WgEasyWidget({ title, stats, url, error, isLoading }: WgEasyWidgetProps) {
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <Shield size={15} />
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
            <Shield size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载 VPN 监控数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  const hasActiveConnections = stats.connectedClients > 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 顶部标题行与连接状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10 text-emerald-400 flex-shrink-0 group-hover:border-emerald-500/30 group-hover:bg-emerald-500/20 transition-all duration-300">
            <Shield size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/95 truncate group-hover:text-emerald-300 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasActiveConnections
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse'
                    : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                }`}
              />
              <span className="text-[9px] text-white/40 font-medium">
                {hasActiveConnections ? '活动连接中' : '服务在线'}
              </span>
            </div>
          </div>
        </div>

        {/* 客户端数量标志 */}
        <div className="flex items-center gap-1 text-[8px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
          <Users size={8} />
          <span>客户端: {stats.enabledClients}/{stats.totalClients}</span>
        </div>
      </div>

      {/* 核心指标统计区 */}
      <div className="grid grid-cols-3 gap-2.5 mt-2.5">
        {/* 活动连接 */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <Users size={9} className="text-emerald-400" />
            <span>活动连接</span>
          </div>
          <span className="font-mono font-extrabold text-emerald-400 text-center text-sm truncate" title={`当前活动连接: ${stats.connectedClients}`}>
            {stats.connectedClients}
          </span>
        </div>

        {/* 下行流量 (Tx) */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <ArrowDown size={9} className="text-indigo-400" />
            <span>下载流量</span>
          </div>
          <span className="font-mono font-extrabold text-indigo-400 text-center text-sm truncate" title={`总下行流量: ${formatBytes(stats.totalTx)}`}>
            {formatBytes(stats.totalTx)}
          </span>
        </div>

        {/* 上行流量 (Rx) */}
        <div className="bg-white/5 py-1.5 px-2 rounded-xl border border-white/5 flex flex-col justify-between h-13 transition-all duration-300 hover:bg-white/10 hover:border-white/10">
          <div className="flex items-center justify-center gap-1 text-[8px] text-white/30 scale-95 origin-center">
            <ArrowUp size={9} className="text-purple-400" />
            <span>上传流量</span>
          </div>
          <span className="font-mono font-extrabold text-purple-400 text-center text-sm truncate" title={`总上行流量: ${formatBytes(stats.totalRx)}`}>
            {formatBytes(stats.totalRx)}
          </span>
        </div>
      </div>
    </div>
  );
}
