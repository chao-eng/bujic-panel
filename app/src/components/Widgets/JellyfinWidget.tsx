import React from 'react';
import { Film, Play, Pause } from 'lucide-react';

interface NowPlayingItem {
  id: string;
  userName: string;
  client: string;
  deviceName: string;
  itemName: string;
  itemType: string;
  seriesName: string | null;
  isPaused: boolean;
}

interface JellyfinStats {
  moviesCount: number;
  seriesCount: number;
  episodesCount: number;
  nowPlaying: NowPlayingItem[];
}

interface JellyfinWidgetProps {
  title: string;
  stats?: JellyfinStats;
  url: string;
  error?: string;
  isLoading: boolean;
}

export default function JellyfinWidget({ title, stats, url, error, isLoading }: JellyfinWidgetProps) {
  // 处理错误状态
  if (error) {
    return (
      <div className="flex flex-col justify-between h-full min-h-[100px]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/10 text-red-400">
            <Film size={15} />
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
            <Film size={15} />
          </div>
          <span className="text-xs font-semibold text-white/40">{title}</span>
        </div>
        <div className="text-[10px] text-white/20 text-center py-2">
          {isLoading ? '加载媒体数据...' : '等待数据连接...'}
        </div>
      </div>
    );
  }

  const hasPlaying = stats.nowPlaying && stats.nowPlaying.length > 0;

  return (
    <div className="flex flex-col justify-between h-full min-h-[100px] select-none text-xs">
      {/* 顶部标题行与状态 */}
      <div className="flex items-start justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 text-indigo-400 flex-shrink-0 group-hover:border-indigo-500/30 group-hover:bg-indigo-500/20 transition-all duration-300">
            <Film size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white/95 truncate group-hover:text-indigo-300 transition-colors">
              {title}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
              <span className="text-[9px] text-white/40 font-medium">在线</span>
            </div>
          </div>
        </div>

        {/* 播放状态角标 */}
        {hasPlaying && (
          <div className="flex items-center gap-1 text-[9px] bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0 transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
            <Play size={9} fill="currentColor" />
            <span>播中: {stats.nowPlaying.length}</span>
          </div>
        )}
      </div>

      {/* 指标展示区 */}
      <div className="grid grid-cols-12 gap-3 mt-2.5 items-center">
        {/* 左侧：媒体库三个统计卡片 (占 6/12) */}
        <div className="col-span-6 flex gap-1.5">
          <div className="flex-1 bg-white/5 py-1 px-1 rounded-lg border border-white/5 text-center flex flex-col justify-center transition-all duration-300 hover:bg-white/10 hover:border-white/10">
            <span className="text-[8px] text-white/30 scale-95 origin-center">电影</span>
            <span className="font-mono font-bold text-indigo-300 text-[11px] mt-0.5 truncate" title={`电影: ${stats.moviesCount}部`}>
              {stats.moviesCount}
            </span>
          </div>
          <div className="flex-1 bg-white/5 py-1 px-1 rounded-lg border border-white/5 text-center flex flex-col justify-center transition-all duration-300 hover:bg-white/10 hover:border-white/10">
            <span className="text-[8px] text-white/30 scale-95 origin-center">系列</span>
            <span className="font-mono font-bold text-indigo-300 text-[11px] mt-0.5 truncate" title={`系列: ${stats.seriesCount}部`}>
              {stats.seriesCount}
            </span>
          </div>
          <div className="flex-1 bg-white/5 py-1 px-1 rounded-lg border border-white/5 text-center flex flex-col justify-center transition-all duration-300 hover:bg-white/10 hover:border-white/10">
            <span className="text-[8px] text-white/30 scale-95 origin-center">剧集</span>
            <span className="font-mono font-bold text-indigo-300 text-[11px] mt-0.5 truncate" title={`剧集: ${stats.episodesCount}集`}>
              {stats.episodesCount}
            </span>
          </div>
        </div>

        {/* 右侧：正在观看的会话信息 (占 6/12) */}
        <div className="col-span-6 flex flex-col justify-center h-10 min-w-0 pl-1 border-l border-white/5">
          {hasPlaying ? (
            <div className="text-[10px] min-w-0">
              <div className="flex items-center gap-1 text-[8px] text-white/40 truncate scale-95 origin-left">
                {stats.nowPlaying[0].isPaused ? (
                  <Pause size={8} className="text-amber-400 flex-shrink-0" />
                ) : (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse" />
                )}
                <span className="truncate">
                  {stats.nowPlaying[0].userName} ({stats.nowPlaying[0].deviceName || stats.nowPlaying[0].client})
                </span>
              </div>
              <div
                className="font-medium text-white/90 truncate mt-0.5 leading-tight"
                title={
                  stats.nowPlaying[0].seriesName
                    ? `${stats.nowPlaying[0].seriesName} - ${stats.nowPlaying[0].itemName}`
                    : stats.nowPlaying[0].itemName
                }
              >
                {stats.nowPlaying[0].seriesName ? (
                  <>
                    <span className="text-white/40 text-[9px]">{stats.nowPlaying[0].seriesName} </span>
                    <span className="text-indigo-300">{stats.nowPlaying[0].itemName}</span>
                  </>
                ) : (
                  <span>{stats.nowPlaying[0].itemName}</span>
                )}
              </div>
              {stats.nowPlaying.length > 1 && (
                <div className="text-[8px] text-indigo-400/80 mt-0.5 font-medium scale-90 origin-left truncate">
                  + 还有 {stats.nowPlaying.length - 1} 个会话正在播放
                </div>
              )}
            </div>
          ) : (
            <div className="text-[9px] text-white/20 text-center italic py-2">
              无活动播放会话
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
