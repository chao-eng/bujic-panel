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
            <div>
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="glass-panel glow-effect relative flex flex-col p-5 rounded-2xl cursor-pointer hover:-translate-y-1.5 group select-none h-32 active:scale-97"
    >
      {/* 鼠标悬浮显现操作面板 */}
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

      {iconItem.widgetType === 'beszel' ? (
        <BeszelWidget
          title={iconItem.title}
          stats={statsObj?.data}
          url={iconItem.url}
          error={statsObj?.success === false ? statsObj.error : undefined}
          isLoading={!!isWidgetsLoading}
        />
      ) : (
        <>
          {/* 置顶标识 */}
          {iconItem.pinned && (
            <div className="absolute top-3 right-3 text-yellow-400 group-hover:opacity-0 transition-opacity">
              <Pin size={11} fill="currentColor" className="rotate-45" />
            </div>
          )}

          {/* 图标与基本控制 */}
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/5 transition-all">
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
          </div>

          {/* 书签标题与描述 */}
          <div className="mt-auto min-w-0">
            <h4 className="text-xs font-semibold text-white/95 truncate group-hover:text-indigo-300 transition-colors">
              {iconItem.title}
            </h4>
            <p className="text-[10px] text-white/30 truncate mt-0.5" title={iconItem.description || iconItem.url}>
              {iconItem.description || iconItem.url}
            </p>
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
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
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
