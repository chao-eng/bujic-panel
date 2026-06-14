import React from 'react';
import { DownloadCloud, ArrowDown, ArrowUp } from 'lucide-react';

interface QbittorrentStats {
  dlSpeed: number;
  upSpeed: number;
  dlData: number;
  upData: number;
  status: 'connected' | 'firewalled' | 'disconnected' | string;
  downloadingCount?: number;
  completedCount?: number;
}

interface QbittorrentWidgetProps {
  title: string;
  stats?: QbittorrentStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '0 KB/s';
  const kb = bytesPerSecond / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB/s`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB/s`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function QbittorrentWidget({ title, stats, url, error, isLoading }: QbittorrentWidgetProps) {
  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <DownloadCloud size={15} />
          </div>
          <span className="text-xs font-semibold text-white/90 truncate">{title}</span>
        </div>
        <div className="text-[10px] text-red-400/80 leading-snug mt-2 truncate-2-lines" title={error}>
          {error}
        </div>
      </div>
    );
  }

  // 加载中/空状态
  if (!stats) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-white/20">
            <DownloadCloud size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载传输数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  const isOnline = stats.status === 'connected' || stats.status === 'online' || stats.status === 'firewalled';

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 标题及状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/20 transition-all duration-300">
            <DownloadCloud size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/95 truncate group-hover:text-indigo-300 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span 
                className={`w-1.5 h-1.5 rounded-full ${
                  stats.status === 'firewalled' ? 'bg-amber-500' :
                  isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse' :
                  'bg-white/25'
                }`} 
              />
              <span className="text-[9px] text-white/40 font-medium">
                {stats.status === 'firewalled' ? '防火墙限制' : isOnline ? '在线' : '未连接'}
              </span>
            </div>
          </div>
        </div>

        {isOnline && (
          <div className="text-[10px] text-white/40 font-medium tracking-tight text-right flex items-center gap-3 mt-1.5 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>下载中:</span>
              <span className="font-mono font-bold text-emerald-400">{stats.downloadingCount ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>已完成:</span>
              <span className="font-mono font-bold text-indigo-300">{stats.completedCount ?? 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* 速率展示区 */}
      {isOnline ? (
        <div className="space-y-1.5 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {/* 下载速率 */}
            <div className="flex items-center justify-between text-[10px] bg-white/5 py-1.5 px-3 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-white/50">
                <ArrowDown size={11} className="text-emerald-500" />
                <span>下载</span>
              </div>
              <span className="font-mono font-bold text-emerald-400">{formatSpeed(stats.dlSpeed)}</span>
            </div>

            {/* 上传速率 */}
            <div className="flex items-center justify-between text-[10px] bg-white/5 py-1.5 px-3 rounded-lg border border-white/5">
              <div className="flex items-center gap-1.5 text-white/50">
                <ArrowUp size={11} className="text-indigo-400" />
                <span>上传</span>
              </div>
              <span className="font-mono font-bold text-indigo-300">{formatSpeed(stats.upSpeed)}</span>
            </div>
          </div>

          {/* 累计数据 */}
          <div className="flex justify-between text-[9px] text-white/30 px-1 font-mono tracking-tight">
            <span>总下载: {formatBytes(stats.dlData)}</span>
            <span>总上传: {formatBytes(stats.upData)}</span>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-white/25 text-center py-2 italic">
          服务未就绪，无法获取速率
        </div>
      )}
    </div>
  );
}
