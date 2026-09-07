'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { useTranslation } from '../I18nProvider';
import { editGroupAction, deleteGroupsAction, saveGroupSortAction } from '../../actions/groupActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Edit2, Trash2, Folder, Loader2, Check, X, GripVertical, Move } from 'lucide-react';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface GroupType {
  id: number;
  title: string;
  icon: string;
  groupType: string;
  tabId: number;
}

interface ViewTabType {
  id: number;
  name: string;
  type: 'card' | 'list';
  sort: number;
}

interface GroupManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupType[];
  tabs: ViewTabType[];
  activeTabId: number;
  onRefresh: () => void;
}

interface SortableGroupItemProps {
  group: GroupType;
  deletingGroupId: number | null;
  setDeletingGroupId: (id: number | null) => void;
  movingTabId: number | null;
  setMovingTabId: (id: number | null) => void;
  tabs: ViewTabType[];
  setMoveTargetTab: (id: number | null) => void;
  moveTargetTab: number | null;
  handleStartEdit: (group: GroupType) => void;
  handleDelete: (id: number) => void;
  handleConfirmDelete: (id: number) => void;
  handleMoveGroup: (groupId: number, tabId: number) => void;
  isPending: boolean;
  t: any;
}

function SortableGroupItem({
  group,
  deletingGroupId,
  setDeletingGroupId,
  movingTabId,
  setMovingTabId,
  tabs,
  setMoveTargetTab,
  moveTargetTab,
  handleStartEdit,
  handleDelete,
  handleConfirmDelete,
  handleMoveGroup,
  isPending,
  t,
}: SortableGroupItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: deletingGroupId === group.id || movingTabId === group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const otherTabs = tabs.filter((tb) => tb.id !== group.tabId);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-xl hover:border-indigo-500/20 hover:bg-white/8 transition-all duration-200 shadow-sm ${
        isDragging ? 'border-indigo-500/30 bg-white/10' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* 拖拽把手 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/30 hover:text-white/60 transition"
        >
          <GripVertical size={14} />
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-indigo-400 flex-shrink-0">
          <Folder size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white/90 truncate">{group.title}</h4>
          <p className="text-[10px] text-white/30 capitalize mt-0.5">
            {group.groupType === 'webpage' ? t.tabTypeList : t.tabTypeCard}
          </p>
        </div>
      </div>

      {/* 移动到其他 Tab */}
      {movingTabId === group.id ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={moveTargetTab || ''}
            onChange={(e) => setMoveTargetTab(Number(e.target.value))}
            className="h-7 px-2 mr-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-white outline-none focus:border-indigo-500/40"
          >
            <option value="" disabled className="bg-[#12131a] text-white">
              {t.targetTab}
            </option>
            {otherTabs.map((tb) => (
              <option key={tb.id} value={tb.id} className="bg-[#12131a] text-white">
                {tb.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setMovingTabId(null);
              setMoveTargetTab(null);
            }}
            className="px-2 py-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition cursor-pointer"
          >
            <X size={12} />
          </button>
          <button
            onClick={() => moveTargetTab && handleMoveGroup(group.id, moveTargetTab)}
            disabled={isPending || !moveTargetTab}
            className="px-2 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-medium transition cursor-pointer disabled:opacity-40"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          {deletingGroupId === group.id ? (
            <>
              <button
                onClick={() => setDeletingGroupId(null)}
                className="px-2 py-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleConfirmDelete(group.id)}
                disabled={isPending}
                className="px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium transition cursor-pointer disabled:opacity-40"
              >
                {t.delete}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMovingTabId(group.id)}
                disabled={otherTabs.length === 0}
                className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                title={t.groupMoveTab}
              >
                <Move size={13} />
              </button>
              <button
                onClick={() => handleStartEdit(group)}
                className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
                title={t.cardMenuEdit}
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={() => handleDelete(group.id)}
                disabled={isPending}
                className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer disabled:opacity-40"
                title={t.cardMenuDelete}
              >
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function GroupManageModal({
  isOpen,
  onClose,
  groups,
  tabs,
  activeTabId,
  onRefresh,
}: GroupManageModalProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  // 状态
  const [localGroups, setLocalGroups] = useState<GroupType[]>(groups);
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('lucide:folder');
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [movingTabId, setMovingTabId] = useState<number | null>(null);
  const [moveTargetTab, setMoveTargetTab] = useState<number | null>(null);

  const [localTabs, setLocalTabs] = useState<ViewTabType[]>(tabs);
  const [activeManageTabId, setActiveManageTabId] = useState<number>(activeTabId || tabs[0]?.id || 0);

  const currentTab = localTabs.find((x) => x.id === activeManageTabId) || localTabs[0];
  const filteredLocalGroups = localGroups.filter((g) => g.tabId === (currentTab?.id ?? -1));

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  useEffect(() => {
    setLocalTabs(tabs);
    if (tabs.length > 0 && !tabs.some((x) => x.id === activeManageTabId)) {
      setActiveManageTabId(tabs[0].id);
    }
  }, [tabs]);

  useEffect(() => {
    if (isOpen) {
      setActiveManageTabId(activeTabId && tabs.some((x) => x.id === activeTabId) ? activeTabId : tabs[0]?.id || 0);
      setIsEditing(false);
      setSelectedGroup(null);
      setDeletingGroupId(null);
      setMovingTabId(null);
      setErrorMsg('');
    }
  }, [isOpen, activeTabId, tabs]);

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

    const oldIndex = filteredLocalGroups.findIndex((g) => g.id === active.id);
    const newIndex = filteredLocalGroups.findIndex((g) => g.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedFiltered = [...filteredLocalGroups];
      const [removed] = reorderedFiltered.splice(oldIndex, 1);
      reorderedFiltered.splice(newIndex, 0, removed);

      const otherGroups = localGroups.filter((g) => g.tabId !== currentTab?.id);
      const newLocalGroups = [...otherGroups, ...reorderedFiltered];
      setLocalGroups(newLocalGroups);

      startTransition(async () => {
        try {
          const sortItems = reorderedFiltered.map((g, index) => ({
            id: g.id,
            sort: index + 1,
          }));
          await saveGroupSortAction(sortItems, currentTab?.id);
          onRefresh();
        } catch (e: any) {
          setErrorMsg(e.message || t.saveFailed);
        }
      });
    }
  };

  const handleStartAdd = () => {
    setSelectedGroup(null);
    setIsEditing(true);
    setTitle('');
    setIcon('lucide:folder');
    setErrorMsg('');
  };

  const handleStartEdit = (group: GroupType) => {
    setSelectedGroup(group);
    setIsEditing(true);
    setTitle(group.title);
    setIcon(group.icon || 'lucide:folder');
    setErrorMsg('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setErrorMsg('');

    startTransition(async () => {
      try {
        await editGroupAction({
          id: selectedGroup?.id,
          title,
          icon,
          groupType: currentTab?.type === 'list' ? 'webpage' : 'website',
          tabId: selectedGroup?.tabId ?? currentTab?.id,
        });
        setIsEditing(false);
        onRefresh();
      } catch (e: any) {
        setErrorMsg(e.message || t.saveFailed);
      }
    });
  };

  const handleDelete = (id: number) => {
    setDeletingGroupId(id);
  };

  const handleConfirmDelete = (id: number) => {
    setDeletingGroupId(null);
    startTransition(async () => {
      try {
        await deleteGroupsAction([id]);
        onRefresh();
      } catch (e: any) {
        setErrorMsg(e.message || t.saveFailed);
      }
    });
  };

  const handleMoveGroup = (groupId: number, targetTabId: number) => {
    setMovingTabId(null);
    startTransition(async () => {
      try {
        const target = localTabs.find((x) => x.id === targetTabId);
        await editGroupAction({
          id: groupId,
          title: localGroups.find((g) => g.id === groupId)?.title || '',
          icon: localGroups.find((g) => g.id === groupId)?.icon || 'lucide:folder',
          groupType: target?.type === 'list' ? 'webpage' : 'website',
          tabId: targetTabId,
        });
        onRefresh();
      } catch (e: any) {
        setErrorMsg(e.message || t.saveFailed);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[520px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center justify-between pr-8">
            <span>{t.groupManage}</span>
            {!isEditing && (
              <button
                onClick={handleStartAdd}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                <Plus size={14} />
                <span>{t.addFolder}</span>              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="text-xs font-semibold px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Tab 切换栏 */}
        {!isEditing && (
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs text-white/50 overflow-x-auto scrollbar-none">
            {localTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveManageTabId(tab.id)}
                className={`flex-1 min-w-[80px] py-1.5 rounded-lg font-medium transition cursor-pointer text-center whitespace-nowrap ${
                  activeManageTabId === tab.id
                    ? 'bg-white/10 text-white font-semibold'
                    : 'hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        )}

        {isEditing ? (
          /* 编辑/添加分组表单 */
          <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.title}</Label>
              <Input
                type="text"
                required
                placeholder={t.groupNamePlaceholder}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">分组图标</Label>
              <Input
                type="text"
                placeholder={t.iconPlaceholder}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.group}</Label>
              <select
                value={activeManageTabId}
                onChange={(e) => setActiveManageTabId(Number(e.target.value))}
                className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
              >
                {localTabs.map((tab) => (
                  <option key={tab.id} value={tab.id} className="bg-[#12131a] text-white">
                    {tab.name}（{tab.type === 'list' ? t.tabTypeList : t.tabTypeCard}）
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-white/30">
                分组展示形态跟随所属导航（{currentTab?.type === 'list' ? t.tabTypeList : t.tabTypeCard}）
              </p>
            </div>

            <DialogFooter className="gap-2 mt-5">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 rounded-xl border border-white/5 hover:bg-white/5 transition text-xs text-white/70 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isPending || !title.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-medium text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                <span>{t.save}</span>
              </button>
            </DialogFooter>
          </form>
        ) : (
          /* 分组列表展示 */
          <div className="space-y-3.5 mt-2">
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1.5 pt-0.5">
              <DndContext
                id={`group-sort-dnd-${activeManageTabId}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={filteredLocalGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                    {filteredLocalGroups.length === 0 && (
                      <div className="text-center py-8 text-white/30 text-xs">
                        {t.noGroupsInTab}
                      </div>
                    )}
                  {filteredLocalGroups.map((group) => (
                    <SortableGroupItem
                      key={group.id}
                      group={group}
                      deletingGroupId={deletingGroupId}
                      setDeletingGroupId={setDeletingGroupId}
                      movingTabId={movingTabId}
                      setMovingTabId={setMovingTabId}
                      tabs={localTabs}
                      setMoveTargetTab={setMoveTargetTab}
                      moveTargetTab={moveTargetTab}
                      handleStartEdit={handleStartEdit}
                      handleDelete={handleDelete}
                      handleConfirmDelete={handleConfirmDelete}
                      handleMoveGroup={handleMoveGroup}
                      isPending={isPending}
                      t={t}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
