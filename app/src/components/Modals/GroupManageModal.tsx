'use client';

import React, { useState, useTransition } from 'react';
import { useTranslation } from '../I18nProvider';
import { editGroupAction, deleteGroupsAction } from '../../actions/groupActions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Plus, Edit2, Trash2, Folder, Loader2, Check, X } from 'lucide-react';

interface GroupType {
  id: number;
  title: string;
  icon: string;
  groupType: string;
}

interface GroupManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupType[];
  onRefresh: () => void;
}

export default function GroupManageModal({
  isOpen,
  onClose,
  groups,
  onRefresh,
}: GroupManageModalProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  // 状态
  const [selectedGroup, setSelectedGroup] = useState<GroupType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('lucide:folder');
  const [groupType, setGroupType] = useState('website');
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

  const handleStartAdd = () => {
    setSelectedGroup(null);
    setIsEditing(true);
    setTitle('');
    setIcon('lucide:folder');
    setGroupType('website');
    setErrorMsg('');
  };

  const handleStartEdit = (group: GroupType) => {
    setSelectedGroup(group);
    setIsEditing(true);
    setTitle(group.title);
    setIcon(group.icon || 'lucide:folder');
    setGroupType(group.groupType);
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
          groupType,
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
      const res = await deleteGroupsAction([id]);
      if (res.success) {
        onRefresh();
      } else {
        setErrorMsg(res.message || t.saveFailed);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center justify-between pr-8">
            <span>分组管理</span>
            {!isEditing && (
              <button
                onClick={handleStartAdd}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer shadow-md shadow-indigo-500/10"
              >
                <Plus size={14} />
                <span>新建分组</span>
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
          /* 编辑/添加分组表单 */
          <form onSubmit={handleSave} className="space-y-4 text-sm mt-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.title}</Label>
              <Input
                type="text"
                required
                placeholder="例如: 常用网站"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium">分组图标</Label>
                <Input
                  type="text"
                  placeholder="如: lucide:globe"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs font-medium">展示模式</Label>
                <select
                  value={groupType}
                  onChange={(e) => setGroupType(e.target.value)}
                  className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
                >
                  <option value="website" className="bg-[#12131a] text-white">
                    {t.website}
                  </option>
                  <option value="webpage" className="bg-[#12131a] text-white">
                    {t.webpage}
                  </option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-5">
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
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1.5 mt-2">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-xl hover:border-indigo-500/20 hover:bg-white/8 hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-indigo-500/5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-indigo-400">
                    <Folder size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/90">{group.title}</h4>
                    <p className="text-[10px] text-white/30 capitalize mt-0.5">
                      {group.groupType === 'webpage' ? t.webpage : t.website}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
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
                        onClick={() => handleStartEdit(group)}
                        className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition text-white/50 cursor-pointer"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        disabled={isPending}
                        className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/50 cursor-pointer disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
