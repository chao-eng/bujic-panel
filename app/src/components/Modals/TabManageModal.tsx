'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslation } from '../I18nProvider';
import { editTabAction, saveTabSortAction, deleteTabAction, migrateAndDeleteTabAction } from '../../actions/tabActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Edit2, Trash2, Loader2, Check, X, GripVertical, LayoutGrid, List } from 'lucide-react';
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

export interface ViewTabType {
  id: number;
  name: string;
  type: 'card' | 'list';
  sort: number;
}

interface TabManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: ViewTabType[];
  onRefresh: () => void;
}

function TabSortableRow({
  tab,
  tabs,
  migratingTabId,
  setMigratingTabId,
  migrateTarget,
  setMigrateTarget,
  handleStartEdit,
  handleDelete,
  handleMigrateDelete,
  isPending,
  t,
}: {
  tab: ViewTabType;
  tabs: ViewTabType[];
  migratingTabId: number | null;
  setMigratingTabId: (id: number | null) => void;
  migrateTarget: number | null;
  setMigrateTarget: (id: number | null) => void;
  handleStartEdit: (tab: ViewTabType) => void;
  handleDelete: (id: number) => void;
  handleMigrateDelete: (id: number, target: number) => void;
  isPending: boolean;
  t: any;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    disabled: migratingTabId === tab.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const others = tabs.filter((x) => x.id !== tab.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:border-indigo-500/20 hover:bg-white/8 transition-all duration-200 ${
        isDragging ? 'border-indigo-500/30 bg-white/10' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-white/30 hover:text-white/60 transition"
        >
          <GripVertical size={14} />
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-indigo-400 flex-shrink-0">
          {tab.type === 'list' ? <List size={15} /> : <LayoutGrid size={15} />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-bold text-white/90 truncate">{tab.name}</h4>
          <p className="text-[10px] text-white/30 mt-0.5 capitalize">
            {tab.type === 'list' ? t.tabTypeList : t.tabTypeCard}
          </p>
        </div>
      </div>

      {/* 迁移删除内联 UI */}
      {migratingTabId === tab.id ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={migrateTarget || ''}
            onChange={(e) => setMigrateTarget(Number(e.target.value))}
            className="h-7 px-2 mr-1 bg-white/5 border border-white/5 rounded-lg text-[10px] text-white outline-none focus:border-indigo-500/40"
          >
            <option value="" disabled className="bg-[#12131a] text-white">
              {t.migrateGroupsHint}
            </option>
            {others.map((o) => (
              <option key={o.id} value={o.id} className="bg-[#12131a] text-white">
                {o.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setMigratingTabId(null);
              setMigrateTarget(null);
            }}
            className="px-2 py-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/50 text-[10px] transition cursor-pointer"
          >
            <X size={12} />
          </button>
          <button
            onClick={() => migrateTarget && handleMigrateDelete(tab.id, migrateTarget)}
            disabled={isPending || !migrateTarget}
            className="px-2 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-medium transition cursor-pointer disabled:opacity-40"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => handleStartEdit(tab)}
            className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
            title={t.cardMenuEdit}
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => handleDelete(tab.id)}
            disabled={isPending || tabs.length <= 1}
            className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
            title={t.cardMenuDelete}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function TabManageModal({ isOpen, onClose, tabs, onRefresh }: TabManageModalProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();
  const [localTabs, setLocalTabs] = useState<ViewTabType[]>(tabs);

  const [isEditing, setIsEditing] = useState(false);
  const [editingTab, setEditingTab] = useState<ViewTabType | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'card' | 'list'>('card');
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingTabId, setDeletingTabId] = useState<number | null>(null);
  const [migratingTabId, setMigratingTabId] = useState<number | null>(null);
  const [migrateTarget, setMigrateTarget] = useState<number | null>(null);

  useEffect(() => {
    setLocalTabs(tabs);
  }, [tabs]);

  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      setEditingTab(null);
      setDeletingTabId(null);
      setMigratingTabId(null);
      setMigrateTarget(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localTabs.findIndex((x) => x.id === active.id);
    const newIndex = localTabs.findIndex((x) => x.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...localTabs];
    const [removed] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, removed);
    setLocalTabs(reordered);

    startTransition(async () => {
      try {
        await saveTabSortAction(reordered.map((x, i) => ({ id: x.id, sort: i + 1 })));
        onRefresh();
      } catch (e: any) {
        setErrorMsg(e.message || t.saveFailed);
      }
    });
  };

  const handleStartAdd = () => {
    setEditingTab(null);
    setIsEditing(true);
    setName('');
    setType('card');
    setErrorMsg('');
  };

  const handleStartEdit = (tab: ViewTabType) => {
    setEditingTab(tab);
    setIsEditing(true);
    setName(tab.name);
    setType(tab.type);
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(t.tabNameRequired);
      return;
    }
    if (name.trim().length > 20) {
      setErrorMsg(t.tabNameTooLong);
      return;
    }
    setErrorMsg('');
    startTransition(async () => {
      try {
        await editTabAction({ id: editingTab?.id, name, type });
        setIsEditing(false);
        onRefresh();
      } catch (err: any) {
        setErrorMsg(err.message || t.saveFailed);
      }
    });
  };

  const handleDelete = (id: number) => {
    if (localTabs.length <= 1) {
      setErrorMsg(t.atLeastOneTab);
      return;
    }
    // 弹出两选：连带删除 / 迁移分组后删除
    setDeletingTabId(id);
  };

  const handleChooseMigrate = (id: number) => {
    setDeletingTabId(null);
    setMigratingTabId(id);
    setMigrateTarget(null);
  };

  const handleConfirmDelete = (id: number) => {
    setDeletingTabId(null);
    startTransition(async () => {
      const res = await deleteTabAction(id);
      if (!res.success) {
        setErrorMsg(res.message || t.saveFailed);
      }
      onRefresh();
    });
  };

  const handleMigrateDelete = (id: number, target: number) => {
    setMigratingTabId(null);
    startTransition(async () => {
      await migrateAndDeleteTabAction(id, target);
      onRefresh();
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-[540px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center justify-between pr-8">
            <span>{t.manageTabs}</span>
            {!isEditing && (
              <button
                onClick={handleStartAdd}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                <Plus size={14} />
                <span>{t.addTab}</span>
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="text-xs font-semibold px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            {errorMsg}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.tabName}</Label>
              <Input
                type="text"
                required
                maxLength={20}
                placeholder="例如: 工作 / NAS 工具"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.tabType}</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('card')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition cursor-pointer ${
                    type === 'card'
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <LayoutGrid size={15} />
                  <span>{t.tabTypeCard}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType('list')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition cursor-pointer ${
                    type === 'list'
                      ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                      : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <List size={15} />
                  <span>{t.tabTypeList}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-white/5 hover:bg-white/5 transition text-xs text-white/70 cursor-pointer"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isPending || !name.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-medium text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isPending && <Loader2 size={13} className="animate-spin" />}
                <span>{t.save}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5 mt-2">
            <DndContext id="tab-sort-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localTabs.map((x) => x.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1.5 pt-0.5">
                  {localTabs.map((tab) => (
                    <TabSortableRow
                      key={tab.id}
                      tab={tab}
                      tabs={localTabs}
                      migratingTabId={migratingTabId}
                      setMigratingTabId={setMigratingTabId}
                      migrateTarget={migrateTarget}
                      setMigrateTarget={setMigrateTarget}
                      handleStartEdit={handleStartEdit}
                      handleDelete={handleDelete}
                      handleMigrateDelete={handleMigrateDelete}
                      isPending={isPending}
                      t={t}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {deletingTabId && (
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-xs text-white/80 space-y-2.5">
                <p className="text-red-300 font-medium">{t.confirmDeleteTab}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleChooseMigrate(deletingTabId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 font-medium transition cursor-pointer"
                  >
                    <List size={12} />
                    <span>{t.migrateToTab}</span>
                  </button>
                  <button
                    onClick={() => handleConfirmDelete(deletingTabId)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-300 font-medium rounded-lg transition cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 size={12} />
                    <span>{t.deleteTabAndItems}</span>
                  </button>
                  <button
                    onClick={() => setDeletingTabId(null)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/60 font-medium transition cursor-pointer"
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
