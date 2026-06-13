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
  widgetType?: string;
  widgetSettings?: string;
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
  const [widgetType, setWidgetType] = useState('');
  const [beszelEmail, setBeszelEmail] = useState('');
  const [beszelPassword, setBeszelPassword] = useState('');
  const [beszelSystemName, setBeszelSystemName] = useState('');
  const [qbUsername, setQbUsername] = useState('');
  const [qbPassword, setQbPassword] = useState('');
  const [jellyfinApiKey, setJellyfinApiKey] = useState('');
  const [umamiUsername, setUmamiUsername] = useState('');
  const [umamiPassword, setUmamiPassword] = useState('');
  const [umamiDomain, setUmamiDomain] = useState('');

  // 胶囊 Tab 切换状态 (website | webpage)
  const [activeGroupTab, setActiveGroupTab] = useState<'website' | 'webpage'>('website');

  const filteredGroups = groups.filter((g) => g.groupType === activeGroupTab);

  const handleTabChange = (tab: 'website' | 'webpage') => {
    setActiveGroupTab(tab);
    const tabGroups = groups.filter((g) => g.groupType === tab);
    if (tabGroups.length > 0) {
      setGroupId(tabGroups[0].id);
    }
  };

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
      const groupInfo = groups.find((g) => g.id === editingIcon.itemIconGroupId);
      if (editingIcon.widgetType === 'beszel' || editingIcon.widgetType === 'qbittorrent' || editingIcon.widgetType === 'jellyfin' || editingIcon.widgetType === 'umami') {
        setActiveGroupTab('website');
        if (groupInfo && groupInfo.groupType !== 'website') {
          const firstWebsiteGroup = groups.find((g) => g.groupType === 'website');
          if (firstWebsiteGroup) {
            setGroupId(firstWebsiteGroup.id);
          } else {
            setGroupId(editingIcon.itemIconGroupId);
          }
        } else {
          setGroupId(editingIcon.itemIconGroupId);
        }
      } else {
        setGroupId(editingIcon.itemIconGroupId);
        if (groupInfo) {
          setActiveGroupTab(groupInfo.groupType as 'website' | 'webpage');
        }
      }

      setIconSrc(editingIcon.icon.src || 'lucide:globe');
      setIconType(editingIcon.icon.itemType || 1);
      setWidgetType(editingIcon.widgetType || '');
      try {
        const settings = JSON.parse(editingIcon.widgetSettings || '{}');
        if (editingIcon.widgetType === 'beszel') {
          setBeszelEmail(settings.email || '');
          setBeszelPassword(settings.password || '');
          setBeszelSystemName(settings.systemName || '');
          setQbUsername('');
          setQbPassword('');
          setJellyfinApiKey('');
          setUmamiUsername('');
          setUmamiPassword('');
          setUmamiDomain('');
        } else if (editingIcon.widgetType === 'qbittorrent') {
          setQbUsername(settings.username || '');
          setQbPassword(settings.password || '');
          setBeszelEmail('');
          setBeszelPassword('');
          setBeszelSystemName('');
          setJellyfinApiKey('');
          setUmamiUsername('');
          setUmamiPassword('');
          setUmamiDomain('');
        } else if (editingIcon.widgetType === 'jellyfin') {
          setJellyfinApiKey(settings.apiKey || '');
          setBeszelEmail('');
          setBeszelPassword('');
          setBeszelSystemName('');
          setQbUsername('');
          setQbPassword('');
          setUmamiUsername('');
          setUmamiPassword('');
          setUmamiDomain('');
        } else if (editingIcon.widgetType === 'umami') {
          setUmamiUsername(settings.username || '');
          setUmamiPassword(settings.password || '');
          setUmamiDomain(settings.domain || '');
          setBeszelEmail('');
          setBeszelPassword('');
          setBeszelSystemName('');
          setQbUsername('');
          setQbPassword('');
          setJellyfinApiKey('');
        } else {
          setBeszelEmail('');
          setBeszelPassword('');
          setBeszelSystemName('');
          setQbUsername('');
          setQbPassword('');
          setJellyfinApiKey('');
          setUmamiUsername('');
          setUmamiPassword('');
          setUmamiDomain('');
        }
      } catch (e) {
        setBeszelEmail('');
        setBeszelPassword('');
        setBeszelSystemName('');
        setQbUsername('');
        setQbPassword('');
        setJellyfinApiKey('');
        setUmamiUsername('');
        setUmamiPassword('');
        setUmamiDomain('');
      }
    } else {
      setTitle('');
      setUrl('');
      setLanUrl('');
      setDescription('');
      setOpenMethod(1);
      setPinned(false);
      
      const defaultGroupId = activeGroupId || (groups[0]?.id ?? 0);
      setGroupId(defaultGroupId);
      const groupInfo = groups.find((g) => g.id === defaultGroupId);
      if (groupInfo) {
        setActiveGroupTab(groupInfo.groupType as 'website' | 'webpage');
      } else if (groups.length > 0) {
        setActiveGroupTab((groups[0]?.groupType || 'website') as 'website' | 'webpage');
      }

      setIconSrc('lucide:globe');
      setIconType(1);
      setWidgetType('');
      setBeszelEmail('');
      setBeszelPassword('');
      setBeszelSystemName('');
      setQbUsername('');
      setQbPassword('');
      setJellyfinApiKey('');
      setUmamiUsername('');
      setUmamiPassword('');
      setUmamiDomain('');
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
        let settingsObj: any = {};
        if (widgetType === 'beszel') {
          settingsObj = {
            email: beszelEmail,
            password: beszelPassword,
            systemName: beszelSystemName,
          };
        } else if (widgetType === 'qbittorrent') {
          settingsObj = {
            username: qbUsername,
            password: qbPassword,
          };
        } else if (widgetType === 'jellyfin') {
          settingsObj = {
            apiKey: jellyfinApiKey,
          };
        } else if (widgetType === 'umami') {
          settingsObj = {
            username: umamiUsername,
            password: umamiPassword,
            domain: umamiDomain,
          };
        }
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
          widgetType,
          widgetSettings: JSON.stringify(settingsObj),
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
      <DialogContent aria-describedby={undefined} className="sm:max-w-[480px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl">
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
          {/* 书签模式 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">书签模式</Label>
            <select
              value={widgetType}
              onChange={(e) => {
                const type = e.target.value;
                setWidgetType(type);
                if (type === 'beszel') {
                  if (!url || url.includes('example.com') || url.includes('8080') || url.includes('8096')) setUrl('http://localhost:8090');
                  setIconSrc('lucide:server');
                  handleTabChange('website');
                } else if (type === 'qbittorrent') {
                  if (!url || url.includes('example.com') || url.includes('8090') || url.includes('8096')) setUrl('http://localhost:8080');
                  setIconSrc('lucide:download-cloud');
                  handleTabChange('website');
                } else if (type === 'jellyfin') {
                  if (!url || url.includes('example.com') || url.includes('8090') || url.includes('8080')) setUrl('http://localhost:8096');
                  setIconSrc('lucide:video');
                  handleTabChange('website');
                } else if (type === 'umami') {
                  if (!url || url.includes('example.com') || url.includes('8090') || url.includes('8080') || url.includes('8096')) setUrl('http://localhost:3000');
                  setIconSrc('lucide:bar-chart-3');
                  handleTabChange('website');
                }
              }}
              className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
            >
              <option value="" className="bg-[#12131a] text-white">普通链接</option>
              <option value="beszel" className="bg-[#12131a] text-white">监控组件 (Beszel)</option>
              <option value="qbittorrent" className="bg-[#12131a] text-white">监控组件 (qBittorrent)</option>
              <option value="jellyfin" className="bg-[#12131a] text-white">监控组件 (Jellyfin)</option>
              <option value="umami" className="bg-[#12131a] text-white">监控组件 (Umami)</option>
            </select>
          </div>

          {/* 目标链接 */}
          <div className="space-y-1.5">
            <Label className="text-white/60 text-xs font-medium">
              {widgetType === 'beszel' ? 'Beszel Hub 地址' : widgetType === 'qbittorrent' ? 'qBittorrent 地址' : widgetType === 'umami' ? 'Umami 地址' : t.url}
            </Label>
            <div className="flex gap-2">
              <Input
                type="url"
                required
                placeholder={
                  widgetType === 'beszel'
                    ? 'http://localhost:8090'
                    : widgetType === 'qbittorrent'
                    ? 'http://localhost:8080'
                    : widgetType === 'jellyfin'
                    ? 'http://localhost:8096'
                    : widgetType === 'umami'
                    ? 'http://localhost:3000'
                    : 'https://example.com'
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
              />
              {widgetType === '' && (
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
              )}
            </div>
          </div>

          {/* Beszel 特定连接配置 */}
          {widgetType === 'beszel' && (
            <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-white/5 animate-fade-in">
              <h5 className="text-xs font-bold text-indigo-400">Beszel 连接凭证</h5>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">管理员邮箱 (Email)</Label>
                <Input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={beszelEmail}
                  onChange={(e) => setBeszelEmail(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">管理员密码 (Password)</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={beszelPassword}
                  onChange={(e) => setBeszelPassword(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">监控系统名称 (System Name)</Label>
                <Input
                  type="text"
                  required
                  placeholder="如: My Server 或 localhost"
                  value={beszelSystemName}
                  onChange={(e) => setBeszelSystemName(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
            </div>
          )}

          {/* qBittorrent 特定连接配置 */}
          {widgetType === 'qbittorrent' && (
            <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-white/5 animate-fade-in">
              <h5 className="text-xs font-bold text-indigo-400">qBittorrent 连接配置</h5>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">用户名 (Username)</Label>
                <Input
                  type="text"
                  required
                  placeholder="admin"
                  value={qbUsername}
                  onChange={(e) => setQbUsername(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">密码 (Password)</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={qbPassword}
                  onChange={(e) => setQbPassword(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
            </div>
          )}

          {/* Jellyfin 特定连接配置 */}
          {widgetType === 'jellyfin' && (
            <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-white/5 animate-fade-in">
              <h5 className="text-xs font-bold text-indigo-400">Jellyfin 连接配置</h5>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">API 密钥 (API Key)</Label>
                <Input
                  type="password"
                  required
                  placeholder="输入 Jellyfin API 密钥"
                  value={jellyfinApiKey}
                  onChange={(e) => setJellyfinApiKey(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
            </div>
          )}

          {/* Umami 特定连接配置 */}
          {widgetType === 'umami' && (
            <div className="space-y-3 p-3.5 rounded-xl border border-white/5 bg-white/5 animate-fade-in">
              <h5 className="text-xs font-bold text-indigo-400">Umami 连接配置</h5>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">用户名 (Username)</Label>
                <Input
                  type="text"
                  required
                  placeholder="输入 Umami 用户名"
                  value={umamiUsername}
                  onChange={(e) => setUmamiUsername(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">密码 (Password)</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={umamiPassword}
                  onChange={(e) => setUmamiPassword(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-[10px] font-medium">域名 (Domain)</Label>
                <Input
                  type="text"
                  required
                  placeholder="如: example.com"
                  value={umamiDomain}
                  onChange={(e) => setUmamiDomain(e.target.value)}
                  className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20 text-xs"
                />
              </div>
            </div>
          )}

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
              <div className="flex items-center justify-between h-7">
                <Label className="text-white/60 text-xs font-medium">{t.group}</Label>
                {/* 胶囊 Tab 切换 */}
                <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-[10px] text-white/40">
                  <button
                    type="button"
                    onClick={() => handleTabChange('website')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      activeGroupTab === 'website' ? 'bg-white/10 text-white font-semibold' : 'hover:text-white'
                    }`}
                  >
                    {t.website}
                  </button>
                  <button
                    type="button"
                    disabled={widgetType === 'beszel' || widgetType === 'qbittorrent' || widgetType === 'jellyfin' || widgetType === 'umami'}
                    onClick={() => handleTabChange('webpage')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      widgetType === 'beszel' || widgetType === 'qbittorrent' || widgetType === 'jellyfin' || widgetType === 'umami'
                        ? 'opacity-30 cursor-not-allowed'
                        : 'cursor-pointer hover:text-white'
                    } ${
                      activeGroupTab === 'webpage' ? 'bg-white/10 text-white font-semibold' : ''
                    }`}
                  >
                    {t.webpage}
                  </button>
                </div>
              </div>
              <select
                value={groupId}
                onChange={(e) => setGroupId(Number(e.target.value))}
                className="w-full h-9 px-3 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs transition"
              >
                {filteredGroups.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#12131a] text-white">
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center h-7">
                <Label className="text-white/60 text-xs font-medium">{t.openMethod}</Label>
              </div>
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
          <DialogFooter className="gap-2 mt-5">
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
