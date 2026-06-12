'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslation } from './I18nProvider';
import SearchBar from './SearchBar';
import IconGrid from './IconGrid';
import EditIconModal from './Modals/EditIconModal';
import GroupManageModal from './Modals/GroupManageModal';
import SettingsModal from './Modals/SettingsModal';
import {
  saveItemIconSortAction,
  deleteItemIconsAction,
  addMultipleItemIconsAction,
} from '../actions/iconActions';
import { editGroupAction, getGroupsAction } from '../actions/groupActions';
import { logoutAction } from '../actions/userActions';
import {
  Globe,
  Layout,
  Settings,
  FolderEdit,
  Plus,
  LogOut,
  ChevronDown,
  Monitor,
  Menu,
} from 'lucide-react';

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

interface DashboardProps {
  user: {
    id: number;
    username: string;
    name: string | null;
    headImage: string | null;
    role: number;
    mail: string | null;
  };
  initialGroups: GroupType[];
  initialIcons: ItemIconType[];
  initialPanelConfig?: any;
  initialSearchEngineConfig?: any;
}

export default function Dashboard({
  user,
  initialGroups,
  initialIcons,
}: DashboardProps) {
  const { t, locale, setLocale } = useTranslation();
  const [currentUser, setCurrentUser] = useState(user);
  const [groups, setGroups] = useState<GroupType[]>(initialGroups);
  const [icons, setIcons] = useState<ItemIconType[]>(initialIcons);

  // 展示模式：'website' | 'webpage'
  const [activeTab, setActiveTab] = useState<'website' | 'webpage'>('website');

  // 本地检索过滤关键字
  const [searchQuery, setSearchQuery] = useState('');

  // 模态弹框管理
  const [isEditIconOpen, setIsEditIconOpen] = useState(false);
  const [editingIcon, setEditingIcon] = useState<ItemIconType | null>(null);
  const [isGroupManageOpen, setIsGroupManageOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState(false);

  const [activeGroupScroll, setActiveGroupScroll] = useState<number | null>(null);

  // 过滤满足当前展示模式 (网站/网页) 的分组与书签
  const activeGroups = groups.filter((g) => g.groupType === activeTab);

  // 滚动位置监听联动左侧分组条
  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      for (const group of activeGroups) {
        const el = document.getElementById(`group-${group.id}`);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveGroupScroll(group.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeGroups]);

  // 左侧圆点一键锚点跳转
  const handleScrollToGroup = (id: number) => {
    setActiveGroupScroll(id);
    document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRefreshGroups = async () => {
    try {
      const refreshed = await getGroupsAction();
      setGroups(refreshed);
    } catch (e) {}
  };

  // 拖拽完排序本地更新并静默调用 Server Action 物理保存
  const handleReorderIcons = async (groupId: number, reordered: ItemIconType[]) => {
    // 1. 乐观 UI：用新顺序替换该分组图标（保留其他分组不变）
    //    注意：不能用 .map() 原序遍历，那样只会更新数据不会改变顺序。
    const otherIcons = icons.filter((icon) => icon.itemIconGroupId !== groupId);
    const reorderedWithSort = reordered.map((item, idx) => ({ ...item, sort: idx + 1 }));
    setIcons([...otherIcons, ...reorderedWithSort]);

    // 2. 构造排序提交数据并保存至数据库
    const sortItems = reorderedWithSort.map((item) => ({
      id: item.id,
      sort: item.sort,
    }));

    try {
      await saveItemIconSortAction(groupId, sortItems);
    } catch (e) {
      console.error('保存拖拽排序失败:', e);
    }
  };

  const handleEditIcon = (icon: ItemIconType) => {
    setEditingIcon(icon);
    setIsEditIconOpen(true);
  };

  const handleDeleteIcon = async (id: number) => {
    setIcons(icons.filter((i) => i.id !== id));
    try {
      await deleteItemIconsAction([id]);
    } catch (e) {
      console.error('删除书签失败:', e);
    }
  };

  const handleSaveIconSuccess = (saved: any) => {
    // 重新拉取或本地更新
    const exists = icons.some((i) => i.id === saved.id);
    const parsedSaved = {
      ...saved,
      icon: JSON.parse(saved.iconJson || '{}'),
    };
    if (exists) {
      setIcons(icons.map((i) => (i.id === saved.id ? parsedSaved : i)));
    } else {
      setIcons([parsedSaved, ...icons]);
    }
  };

  // 退出登录
  const handleLogout = async () => {
    await logoutAction();
    window.location.href = '/login';
  };

  // JSON 备份导出
  const handleExportConfig = () => {
    const dataStr = JSON.stringify({ groups, icons }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bujic-panel-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // JSON 备份导入
  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target?.result as string);
        if (config.groups && config.icons) {
          setImportError(false);
          setImportMsg(t.importingData);
          for (const g of config.groups) {
            const createdGroup = await editGroupAction({
              title: g.title,
              icon: g.icon,
              groupType: g.groupType,
            });

            const subIcons = config.icons.filter((i: any) => i.itemIconGroupId === g.id);
            if (subIcons.length > 0) {
              const itemsToCreate = subIcons.map((i: any) => ({
                title: i.title,
                url: i.url,
                description: i.description || '',
                itemIconGroupId: createdGroup.id,
                icon: i.icon,
              }));
              await addMultipleItemIconsAction(itemsToCreate);
            }
          }
          setImportMsg(t.importSuccess);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setImportError(true);
          setImportMsg(t.importInvalidFormat);
        }
      } catch (err) {
        setImportError(true);
        setImportMsg(t.importParseFailed);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col relative pb-20">
      {/* 隐藏的备份导入文件接收框 */}
      <input
        type="file"
        id="dashboard-import-input"
        accept=".json"
        onChange={handleImportConfig}
        className="hidden"
      />
      <button id="dashboard-export-action" onClick={handleExportConfig} className="hidden" />

      {/* 导入进度提示 toast */}
      {importMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-xs font-semibold shadow-xl border ${importError ? 'bg-red-900/90 border-red-500/30 text-red-300' : 'bg-[#12131a]/95 border-white/10 text-white/90'} backdrop-blur-xl`}>
          {importMsg}
        </div>
      )}

      {/* 顶部导航控制条 */}
      <header className="w-full border-b border-white/5 bg-[#0a0b10]/60 backdrop-blur-xl sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md flex items-center justify-center font-heading font-extrabold text-white text-base">
            BJ
          </div>
          <span className="font-heading font-bold text-white tracking-wide text-sm hidden sm:inline">
            布吉岛导航
          </span>
        </div>

        {/* 模式选择 (Tab切换) */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs text-white/50">
          <button
            onClick={() => setActiveTab('website')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${activeTab === 'website' ? 'bg-white/10 text-white font-semibold' : 'hover:text-white'}`}
          >
            <Globe size={13} />
            <span>{t.website}</span>
          </button>
          <button
            onClick={() => setActiveTab('webpage')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${activeTab === 'webpage' ? 'bg-white/10 text-white font-semibold' : 'hover:text-white'}`}
          >
            <Layout size={13} />
            <span>{t.webpage}</span>
          </button>
        </div>

        {/* 顶部操作中心 */}
        <div className="flex items-center gap-2">
          {/* 添加书签 */}
          <button
            onClick={() => {
              setEditingIcon(null);
              setIsEditIconOpen(true);
            }}
            className="flex items-center justify-center p-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition text-white shadow-md shadow-indigo-500/10 cursor-pointer"
            title={t.addBookmark}
          >
            <Plus size={16} />
          </button>

          {/* 分组管理 */}
          <button
            onClick={() => setIsGroupManageOpen(true)}
            className="flex items-center justify-center p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 transition text-white/80 cursor-pointer"
            title="分组管理"
          >
            <FolderEdit size={16} />
          </button>

          {/* 全局设置 */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center justify-center p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 active:scale-95 transition text-white/80 cursor-pointer"
            title={t.settings}
          >
            <Settings size={16} />
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          {/* 用户及退出 */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center">
              {currentUser.headImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentUser.headImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-heading font-bold text-indigo-400">
                  {currentUser.name?.substring(0, 1).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-red-500/10 text-white/40 hover:text-red-400 transition cursor-pointer"
              title={t.logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="max-w-[1240px] w-full mx-auto px-6 mt-10 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10 items-start">
        
        {/* 左侧锚点导航 (分组指示条) */}
        <aside className="hidden lg:flex flex-col gap-1.5 sticky top-28 bg-[#12131a]/30 border border-white/5 rounded-2xl p-4 backdrop-blur-md">
          <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-2 mb-2">分组导航</h3>
          {activeGroups.map((g) => {
            const isActive = activeGroupScroll === g.id;
            return (
              <button
                key={g.id}
                onClick={() => handleScrollToGroup(g.id)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium tracking-wide transition cursor-pointer ${isActive ? 'bg-white/5 text-indigo-300 font-semibold' : 'text-white/55 hover:text-white hover:bg-white/5'}`}
              >
                <span className="truncate">{g.title}</span>
                {/* 锚点指示呼吸灯 */}
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-500 active-glow' : 'bg-white/15'}`} />
              </button>
            );
          })}
        </aside>

        {/* 右侧主面板内容 */}
        <section className="space-y-8 min-w-0 w-full">
          {/* 搜索引擎栏 */}
          <SearchBar onLocalSearch={setSearchQuery} />

          {/* 各分组书签渲染列表 */}
          <div className="space-y-10 pt-4">
            {activeGroups.map((group) => {
              // 本地搜索检索及分组书签筛选
              const filteredIcons = icons.filter((icon) => {
                const belongs = icon.itemIconGroupId === group.id;
                if (!belongs) return false;
                if (!searchQuery.trim()) return true;

                const q = searchQuery.toLowerCase();
                return (
                  icon.title.toLowerCase().includes(q) ||
                  (icon.description && icon.description.toLowerCase().includes(q)) ||
                  icon.url.toLowerCase().includes(q)
                );
              });

              // 如果正在过滤且当前分组下无匹配书签，隐去该分组
              if (searchQuery.trim() && filteredIcons.length === 0) return null;

              return (
                <div key={group.id} id={`group-${group.id}`} className="space-y-4 scroll-mt-24">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <h3 className="font-heading font-extrabold text-base text-white/90">
                      {group.title}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-white/30 font-mono">
                      {filteredIcons.length}
                    </span>
                  </div>

                  <IconGrid
                    groupId={group.id}
                    groupType={activeTab}
                    icons={filteredIcons}
                    onReorder={(reordered) => handleReorderIcons(group.id, reordered)}
                    onEdit={handleEditIcon}
                    onDelete={handleDeleteIcon}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* 弹窗管理器 */}
      <EditIconModal
        isOpen={isEditIconOpen}
        onClose={() => {
          setIsEditIconOpen(false);
          setEditingIcon(null);
        }}
        groups={groups}
        editingIcon={editingIcon}
        activeGroupId={activeGroupScroll || activeGroups[0]?.id || 0}
        onSave={handleSaveIconSuccess}
      />

      <GroupManageModal
        isOpen={isGroupManageOpen}
        onClose={() => setIsGroupManageOpen(false)}
        groups={groups}
        onRefresh={handleRefreshGroups}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onRefreshUser={setCurrentUser}
      />
    </div>
  );
}
