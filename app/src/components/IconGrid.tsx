'use client';

import React, { useState, useTransition } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { Pin, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTranslation } from './I18nProvider';
import BeszelWidget from './Widgets/BeszelWidget';
import QbittorrentWidget, { formatSpeed } from './Widgets/QbittorrentWidget';

// 动态图标解析器
export function DynamicIcon({ name, className, size = 18 }: { name: string; className?: string; size?: number }) {
  if (!name) return <Icons.Globe className={className} size={size} />;

  let cleanName = name.toLowerCase().replace('lucide:', '').replace('material-symbols:', '').replace('material:', '');
  
  // 映射常见名称至 PascalCase
  const lookup: { [key: string]: string } = {
    'language': 'Globe',
    'web-asset': 'Layout',
    'web': 'Layout',
    'book': 'BookOpen',
    'settings': 'Settings',
    'admin': 'Shield',
    'folder': 'Folder',
    'globe': 'Globe',
    'link': 'Link2',
    'star': 'Star',
    'mail': 'Mail',
  };

  const mappedName = lookup[cleanName] || cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  const IconComponent = (Icons as any)[mappedName] || Icons.Globe;

  return <IconComponent className={className} size={size} />;
}

interface ItemIconType {
  id: number;
  title: string;
  url: string;
  lanUrl?: string | null;
  description?: string | null;
  openMethod: number;
  pinned: boolean;
  itemIconGroupId: number;
  sort: number;
  icon: { itemType: number; src: string };
  widgetType?: string;
  widgetSettings?: string;
}

interface IconGridProps {
  groupId: number;
  groupType: 'website' | 'webpage';
  icons: ItemIconType[];
  onReorder: (newIcons: ItemIconType[]) => void;
  onEdit: (icon: ItemIconType) => void;
  onDelete: (id: number) => void;
  widgetsStats?: Record<number, any>;
  isWidgetsLoading?: boolean;
}

// 单个可排序的书签项组件
function SortableItem({
  iconItem,
  groupType,
  onEdit,
  onDelete,
  widgetsStats,
  isWidgetsLoading,
}: {
  iconItem: ItemIconType;
  groupType: 'website' | 'webpage';
  onEdit: (icon: ItemIconType) => void;
  onDelete: (id: number) => void;
  widgetsStats?: Record<number, any>;
  isWidgetsLoading?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: iconItem.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleClick = (e: React.MouseEvent) => {
    // 阻止拖拽和控制按钮点击引发的默认跳转
    if ((e.target as HTMLElement).closest('.controls-btn')) return;
    
    const openUrl = iconItem.url;
    const link = document.createElement('a');
    link.href = openUrl;
    link.referrerPolicy = 'no-referrer';
    link.rel = 'noopener noreferrer';
    if (iconItem.openMethod === 1) {
      link.target = '_blank';
    } else {
      link.target = '_self';
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLocalIcon =
    iconItem.icon.src.startsWith('/') ||
    iconItem.icon.src.startsWith('http') ||
    iconItem.icon.src.startsWith('data:image/');

  if (groupType === 'webpage') {
    const isWidget = !!iconItem.widgetType;
    const statsObj = widgetsStats?.[iconItem.id];

    // 网页模式：扁平信息流样式
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className="glass-panel glow-effect relative flex items-center justify-between p-4 rounded-xl cursor-pointer hover:-translate-y-0.5 group active:scale-99"
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-24 flex-1">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
            {isLocalIcon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconItem.icon.src}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <DynamicIcon name={iconItem.icon.src} className="text-indigo-400" size={18} />
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-white/90 truncate group-hover:text-indigo-300 transition-colors">
                {iconItem.title}
              </h4>
              {iconItem.description && (
                <p className="text-xs text-white/40 truncate mt-0.5">
                  {iconItem.description}
                </p>
              )}
            </div>

            {/* Widget inline stats */}
            {isWidget && (
              <div className="flex items-center gap-4 text-[10px] text-white/50 bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                {statsObj?.success ? (
                  iconItem.widgetType === 'beszel' ? (
                    statsObj.data.status === 'up' ? (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          在线
                        </span>
                        <span>CPU: <span className="font-mono text-white/80">{statsObj.data.cpu.toFixed(0)}%</span></span>
                        <span>内存: <span className="font-mono text-white/80">{statsObj.data.memory.toFixed(0)}%</span></span>
                      </>
                    ) : (
                      <span className="text-white/30">服务器离线</span>
                    )
                  ) : iconItem.widgetType === 'qbittorrent' ? (
                    statsObj.data.status === 'connected' || statsObj.data.status === 'online' || statsObj.data.status === 'firewalled' ? (
                      <>
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${statsObj.data.status === 'firewalled' ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                          {statsObj.data.status === 'firewalled' ? '限流' : '在线'}
                        </span>
                        <span className="text-emerald-400 font-bold">↓ {formatSpeed(statsObj.data.dlSpeed)}</span>
                        <span className="text-indigo-300 font-bold">↑ {formatSpeed(statsObj.data.upSpeed)}</span>
                        <span className="text-white/30">|</span>
                        <span>下载中: <span className="font-mono text-emerald-400 font-semibold">{statsObj.data.downloadingCount ?? 0}</span></span>
                        <span>已完成: <span className="font-mono text-indigo-300 font-semibold">{statsObj.data.completedCount ?? 0}</span></span>
                      </>
                    ) : (
                      <span className="text-white/30">未连接</span>
                    )
                  ) : (
                    <span className="text-white/30">就绪</span>
                  )
                ) : (
                  <span className="text-red-400/80 truncate max-w-[150px]">
                    {statsObj?.error || (isWidgetsLoading ? '数据加载中...' : '服务连接中')}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 控制面板 */}
        <div className="absolute right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {iconItem.pinned && (
            <div className="p-1.5 text-yellow-500/70" title="已置顶">
              <Pin size={13} fill="currentColor" />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(iconItem); }}
            className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(iconItem.id); }}
            className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  // 网站模式：监控组件或者普通书签卡片
  const statsObj = widgetsStats?.[iconItem.id];
  const isWidget = !!iconItem.widgetType;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`glass-panel glow-effect relative flex flex-col p-5 rounded-2xl cursor-pointer hover:-translate-y-1.5 group select-none h-32 active:scale-97 ${
        isWidget ? 'col-span-2' : ''
      }`}
    >
      {/* 鼠标悬浮显现操作面板 (仅适用于监控组件) */}
      {isWidget && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {iconItem.pinned && (
            <div className="p-1 text-yellow-400">
              <Pin size={11} fill="currentColor" className="rotate-45" />
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(iconItem); }}
            className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
          >
            <Edit2 size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(iconItem.id); }}
            className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {iconItem.widgetType === 'beszel' ? (
        <BeszelWidget
          title={iconItem.title}
          stats={statsObj?.data}
          url={iconItem.url}
          error={statsObj?.success === false ? statsObj.error : undefined}
          isLoading={!!isWidgetsLoading}
        />
      ) : iconItem.widgetType === 'qbittorrent' ? (
        <QbittorrentWidget
          title={iconItem.title}
          stats={statsObj?.data}
          url={iconItem.url}
          error={statsObj?.success === false ? statsObj.error : undefined}
          isLoading={!!isWidgetsLoading}
        />
      ) : (
        <>
          {/* 默认未悬停状态：核心信息水平和垂直居中分布 */}
          <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center opacity-100 scale-100 group-hover:opacity-0 group-hover:scale-95 group-hover:pointer-events-none transition-all duration-300 ease-out">
            {/* 图标与图钉 */}
            <div className="relative mb-2">
              <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                {isLocalIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconItem.icon.src}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <DynamicIcon name={iconItem.icon.src} className="text-indigo-400" size={22} />
                )}
              </div>
              {iconItem.pinned && (
                <span className="absolute -top-1 -right-1 text-yellow-400 bg-[#12131a]/90 border border-white/5 rounded-full p-0.5 shadow-sm">
                  <Pin size={8} fill="currentColor" className="rotate-45" />
                </span>
              )}
            </div>

            {/* 标题与描述 */}
            <div className="min-w-0 w-full px-2">
              <h4 className="text-xs font-semibold text-white/95 flex items-center justify-center gap-0.5 w-full min-w-0">
                <span className="truncate min-w-0">{iconItem.title}</span>
              </h4>
              <p className="text-[10px] text-white/30 truncate mt-0.5" title={iconItem.description || iconItem.url}>
                {iconItem.description || iconItem.url}
              </p>
            </div>
          </div>

          {/* 鼠标悬停状态：信息左移、左对齐，右侧滑入纵向功能按钮 */}
          <div className="absolute inset-0 p-5 flex items-center justify-between opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-300 ease-out">
            {/* 左侧：图标与文本垂直叠放，左对齐 */}
            <div className="flex flex-col h-full justify-between min-w-0 flex-1 pr-4">
              {/* 图标与图钉 */}
              <div className="relative w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 self-start">
                {isLocalIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconItem.icon.src}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <DynamicIcon name={iconItem.icon.src} className="text-indigo-400" size={22} />
                )}
                {iconItem.pinned && (
                  <span className="absolute -top-1 -right-1 text-yellow-400 bg-[#12131a]/90 border border-white/5 rounded-full p-0.5 shadow-sm">
                    <Pin size={8} fill="currentColor" className="rotate-45" />
                  </span>
                )}
              </div>

              {/* 标题与描述 */}
              <div className="min-w-0 w-full text-left">
                <h4 className="text-xs font-semibold text-white/95 truncate flex items-center gap-0.5">
                  <span className="truncate">{iconItem.title}</span>
                </h4>
                <p className="text-[10px] text-white/30 truncate mt-0.5" title={iconItem.description || iconItem.url}>
                  {iconItem.description || iconItem.url}
                </p>
              </div>
            </div>

            {/* 右侧：纵向排列的编辑/删除按钮 */}
            <div className="flex flex-col gap-2 flex-shrink-0 pl-1">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(iconItem); }}
                className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
                title="编辑"
              >
                <Edit2 size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(iconItem.id); }}
                className="controls-btn p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer"
                title="删除"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function IconGrid({
  groupId,
  groupType,
  icons,
  onReorder,
  onEdit,
  onDelete,
  widgetsStats,
  isWidgetsLoading,
}: IconGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 只有移动超过 8px 才激活拖动，防止误触导致点击失败
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = icons.findIndex((i) => i.id === active.id);
    const newIndex = icons.findIndex((i) => i.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = [...icons];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);
      onReorder(reordered);
    }
  };

  return (
    <DndContext
      id={`dnd-group-${groupId}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={icons.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div
          className={
            groupType === 'webpage'
              ? 'grid grid-cols-1 gap-3'
              : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
          }
        >
          {icons.map((icon) => (
            <SortableItem
              key={icon.id}
              iconItem={icon}
              groupType={groupType}
              onEdit={onEdit}
              onDelete={onDelete}
              widgetsStats={widgetsStats}
              isWidgetsLoading={isWidgetsLoading}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
