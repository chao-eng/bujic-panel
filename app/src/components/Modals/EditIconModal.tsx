'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslation } from '../I18nProvider';
import { editItemIconAction } from '../../actions/iconActions';
import { DynamicIcon } from '../IconGrid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Loader2, Globe, Sparkles, Upload } from 'lucide-react';

interface GroupType {
  id: number;
  title: string;
  icon: string;
  groupType: string;
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
}

interface EditIconModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: GroupType[];
  editingIcon: ItemIconType | null;
  activeGroupId: number;
  onSave: (saved: any) => void;
}

export default function EditIconModal({
  isOpen,
  onClose,
  groups,
  editingIcon,
  activeGroupId,
  onSave,
}: EditIconModalProps) {
  const { t } = useTranslation();
  const [isPending, startTransition] = useTransition();

  // 表单状态
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [lanUrl, setLanUrl] = useState('');
  const [description, setDescription] = useState('');
  const [openMethod, setOpenMethod] = useState(1);
  const [pinned, setPinned] = useState(false);
  const [groupId, setGroupId] = useState(activeGroupId);
  const [iconSrc, setIconSrc] = useState('lucide:globe');
  const [iconType, setIconType] = useState(1);

  // 抓取状态与上传状态
  const [isCrawling, setIsCrawling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 初始化编辑数据
  useEffect(() => {
    if (editingIcon) {
      setTitle(editingIcon.title);
      setUrl(editingIcon.url);
      setLanUrl(editingIcon.lanUrl || '');
      setDescription(editingIcon.description || '');
      setOpenMethod(editingIcon.openMethod);
      setPinned(editingIcon.pinned);
      setGroupId(editingIcon.itemIconGroupId);
      setIconSrc(editingIcon.icon.src || 'lucide:globe');
      setIconType(editingIcon.icon.itemType || 1);
    } else {
      setTitle('');
      setUrl('');
      setLanUrl('');
      setDescription('');
      setOpenMethod(1);
      setPinned(false);
      setGroupId(activeGroupId || (groups[0]?.id ?? 0));
      setIconSrc('lucide:globe');
      setIconType(1);
    }
    setErrorMsg('');
  }, [editingIcon, isOpen, activeGroupId, groups]);

  // 网页标题及 Favicon 爬虫抓取
  const handleAutoFetch = async () => {
    if (!url.trim()) return;
    setIsCrawling(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/favicon/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok && data.code === 0) {
        if (data.data.pageTitle) setTitle(data.data.pageTitle);
        if (data.data.iconUrl) {
          setIconSrc(data.data.iconUrl);
          setIconType(1); // 文件/物理相对地址
        }
      } else {
        setErrorMsg(data.message || t.fetchFailed);
      }
    } catch (e) {
      setErrorMsg(t.fetchFailed);
    } finally {
      setIsCrawling(false);
    }
  };

  // 本地图标物理上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', 'icon');

    try {
      const res = await fetch('/api/file/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.code === 0) {
        setIconSrc(data.data.src);
        setIconType(1); // 标识为物理上传图
      } else {
        setErrorMsg(data.message || t.saveFailed);
      }
    } catch (e) {
      setErrorMsg(t.saveFailed);
    } finally {
      setIsUploading(false);
    }
  };

  const handleIconSrcChange = (val: string) => {
    const isSvg = /^\s*<svg[\s\S]*<\/svg>\s*$/i.test(val);
    if (isSvg) {
      try {
        const cleanedSvg = val.trim();
        const base64 = window.btoa(unescape(encodeURIComponent(cleanedSvg)));
        setIconSrc(`data:image/svg+xml;base64,${base64}`);
        setIconType(1); // 标识为外部图片模式
      } catch (err) {
        setIconSrc(val);
      }
    } else {
      setIconSrc(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || groupId === 0) return;

    setErrorMsg('');

    startTransition(async () => {
      try {
        const saved = await editItemIconAction({
          id: editingIcon?.id,
          title,
          url,
          lanUrl,
          description,
          openMethod,
          pinned,
          itemIconGroupId: Number(groupId),
          icon: { itemType: iconType, src: iconSrc },
        });
        onSave(saved);
        onClose();
      } catch (e: any) {
        setErrorMsg(e.message || t.saveFailed);
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold text-white">
            {editingIcon ? t.editBookmark : t.addBookmark}
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="text-xs font-semibold px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* 目标链接 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">{t.url}</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                required
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
              <button
                type="button"
                onClick={handleAutoFetch}
                disabled={isCrawling || !url.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-medium text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isCrawling ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                <span>{t.fetchTitleAndIcon}</span>
              </button>
            </div>
          </div>

          {/* 标题 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">{t.title}</Label>
            <Input
              type="text"
              required
              placeholder={t.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
            />
          </div>

          {/* 描述/备注 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">{t.description}</Label>
            <Input
              type="text"
              placeholder={t.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
            />
          </div>

          {/* 选择分组 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.group}</Label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(Number(e.target.value))}
                className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#12131a] text-white">
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs font-medium">{t.openMethod}</Label>
              <select
                value={openMethod}
                onChange={(e) => setOpenMethod(Number(e.target.value))}
                className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
              >
                <option value={1} className="bg-[#12131a] text-white">
                  {t.openNewTab}
                </option>
                <option value={2} className="bg-[#12131a] text-white">
                  {t.openCurrentTab}
                </option>
              </select>
            </div>
          </div>

          {/* 图标与上传 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">图标素材 (支持链接、本地上传、内置标识，或粘贴 SVG 代码)</Label>
            <div className="flex items-center gap-3">
              {/* 实时预览 */}
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-indigo-400 flex-shrink-0">
                {iconSrc.startsWith('/') || iconSrc.startsWith('http') || iconSrc.startsWith('data:image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconSrc}
                    alt=""
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <DynamicIcon name={iconSrc} className="text-indigo-400" size={20} />
                )}
              </div>

              <div className="flex-1 flex gap-2">
                <Input
                  type="text"
                  placeholder="图片链接 / lucide:图标 / 直接粘贴 SVG 代码"
                  value={iconSrc}
                  onChange={(e) => handleIconSrcChange(e.target.value)}
                  className="flex-1 bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                    id="icon-upload-input"
                  />
                  <label
                    htmlFor="icon-upload-input"
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 rounded-xl text-xs font-medium text-white/80 transition cursor-pointer select-none"
                  >
                    {isUploading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    <span>上传</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 是否置顶 */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 mt-1">
            <div className="space-y-0.5">
              <Label className="text-white/90 text-xs font-semibold">{t.pinned}</Label>
              <p className="text-[10px] text-white/30">置顶显示在面板的第一排</p>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} />
          </div>

          {/* 确认/取消 */}
          <DialogFooter className="gap-2 sm:gap-0 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/5 hover:bg-white/5 transition text-xs text-white/70 cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isPending || !title.trim() || !url.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-medium text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
            >
              {isPending && <Loader2 size={13} className="animate-spin" />}
              <span>{t.save}</span>
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
