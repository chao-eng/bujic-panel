'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useTranslation } from '../I18nProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  updateProfileAction,
  updatePasswordAction,
  getUsersListAction,
  createUserAction,
  updateUserAction,
  deleteUsersAction,
} from '../../actions/userActions';
import { Loader2, Plus, Edit2, Trash2, Shield, User, Lock, Download, Upload, Info, Palette, Globe, Network, Plug, Copy, Check, KeyRound, Database } from 'lucide-react';
import { THEMES, ThemeId } from '../../lib/themes';
import { useTheme } from '../I18nProvider';
import { encryptSensitive } from '../../lib/client-crypto';
import {
  saveSiteBrandAction,
  saveLanSubnetsAction,
} from '../../actions/systemActions';
import {
  listMcpTokensAction,
  createMcpTokenAction,
  setMcpTokenStatusAction,
  deleteMcpTokenAction,
} from '../../actions/mcpActions';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { safeIconSrc } from '../../lib/iconSrc';

interface UserType {
  id: number;
  username: string;
  name: string | null;
  headImage: string | null;
  status: number;
  role: number;
  mail: string | null;
  createdAt: Date;
}

interface McpTokenType {
  id: number;
  name: string;
  scope: string;
  status: number;
  lastUsedAt: Date | string | null;
  createdAt: Date | string;
}

// 个人资料保存成功后的回传信息（不含 createdAt）
interface UpdatedUserInfo {
  id: number;
  username: string;
  name: string | null;
  headImage: string | null;
  role: number;
  mail: string | null;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: number;
    username: string;
    name: string | null;
    headImage: string | null;
    role: number;
    mail: string | null;
    createdAt?: string;
  };
  dataStats?: {
    tabs: number;
    groups: number;
    bookmarks: number;
    widgets: number;
  };
  initialBrandName?: string;
  initialBrandIcon?: string;
  onRefreshUser: (updatedUser: UpdatedUserInfo) => void;
}

// 只读信息统一格式化为 YYYY-MM-DD
function formatDay(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  dataStats,
  initialBrandName = '',
  initialBrandIcon = '',
  onRefreshUser,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();

  // 1. 个人中心状态
  const [name, setName] = useState(currentUser.name || '');
  const [mail, setMail] = useState(currentUser.mail || '');
  const [headImage, setHeadImage] = useState(currentUser.headImage || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState(false);

  // 2. 修改密码状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // 3. 用户管理状态 (管理员专享)
  const [users, setUsers] = useState<UserType[]>([]);
  const [isUserManagePending, setIsUserManagePending] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserType | null>(null);

  // 新增/编辑用户状态
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [manageUsername, setManageUsername] = useState('');
  const [managePassword, setManagePassword] = useState('');
  const [manageName, setManageName] = useState('');
  const [manageMail, setManageMail] = useState('');
  const [manageRole, setManageRole] = useState(2);
  const [manageStatus, setManageStatus] = useState(1);

  // 4. 关于项目
  const [disclaimer, setDisclaimer] = useState('');
  const [aboutText, setAboutText] = useState('');

  // 5. 站点品牌 + 网络区域（管理员）
  const [brandName, setBrandName] = useState(initialBrandName);
  const [brandIcon, setBrandIcon] = useState(initialBrandIcon);
  const [brandMsg, setBrandMsg] = useState('');
  const [brandError, setBrandError] = useState(false);
  const [enableLanJump, setEnableLanJump] = useState(false);
  const [subnetLines, setSubnetLines] = useState<string[]>(['']);
  const [networkMsg, setNetworkMsg] = useState('');
  const [networkError, setNetworkError] = useState(false);

  // 6. MCP 接入
  const [mcpTokens, setMcpTokens] = useState<McpTokenType[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpName, setMcpName] = useState('');
  const [mcpScope, setMcpScope] = useState<'readonly' | 'readwrite'>('readonly');
  const [mcpPlain, setMcpPlain] = useState('');
  const [mcpMsg, setMcpMsg] = useState('');
  const [mcpError, setMcpError] = useState(false);
  const [mcpGenerating, setMcpGenerating] = useState(false);
  const [deleteTokenTarget, setDeleteTokenTarget] = useState<McpTokenType | null>(null);
  const [mcpEndpoint, setMcpEndpoint] = useState('/api/mcp');
  const [mcpConfigCopied, setMcpConfigCopied] = useState(false);

  // 打开设置弹窗时用最新用户信息重置表单（渲染期同步，避免 effect 内同步 setState 触发级联渲染）
  const [syncedSettingSource, setSyncedSettingSource] = useState({ isOpen: false, user: currentUser });
  if (syncedSettingSource.isOpen !== isOpen || syncedSettingSource.user !== currentUser) {
    setSyncedSettingSource({ isOpen, user: currentUser });
    setName(currentUser.name || '');
    setMail(currentUser.mail || '');
    setHeadImage(currentUser.headImage || '');
    setProfileMsg('');
    setPasswordMsg('');
  }

  const loadMcpTokens = async () => {
    setMcpLoading(true);
    try {
      const list = await listMcpTokensAction();
      setMcpTokens(list as McpTokenType[]);
    } catch (e) {
      console.error(e);
    } finally {
      setMcpLoading(false);
    }
  };

  const handleGenerateMcpToken = async () => {
    setMcpMsg('');
    setMcpError(false);
    setMcpPlain('');

    const name = mcpName.trim();
    if (!name) {
      setMcpError(true);
      setMcpMsg(t.mcpNameRequired);
      return;
    }
    if (name.length > 20) {
      setMcpError(true);
      setMcpMsg(t.mcpNameTooLong);
      return;
    }

    setMcpGenerating(true);
    try {
      const res = await createMcpTokenAction({ name, scope: mcpScope });
      if (res.success) {
        setMcpPlain(res.plain);
        setMcpName('');
        await loadMcpTokens();
      } else {
        setMcpError(true);
        setMcpMsg(res.message || t.mcpGenFailed);
      }
    } catch (e) {
      setMcpError(true);
      setMcpMsg(e instanceof Error ? e.message : t.mcpGenFailed);
    } finally {
      setMcpGenerating(false);
    }
  };

  // 启用 / 禁用令牌
  const handleToggleMcpToken = async (tk: McpTokenType) => {
    const res = await setMcpTokenStatusAction(tk.id, tk.status === 1 ? 2 : 1);
    if (res.success) {
      await loadMcpTokens();
    } else {
      setMcpError(true);
      setMcpMsg(res.message || t.changeFailed);
    }
  };

  // 删除令牌（确认框已二次确认）
  const handleDeleteMcpToken = async () => {
    if (!deleteTokenTarget) return;
    const res = await deleteMcpTokenAction(deleteTokenTarget.id);
    if (res.success) {
      await loadMcpTokens();
    } else {
      setMcpError(true);
      setMcpMsg(res.message || t.changeFailed);
    }
  };

  const handleCopyMcpToken = async () => {
    try {
      await navigator.clipboard.writeText(mcpPlain);
      setMcpError(false);
      setMcpMsg(t.mcpCopied);
    } catch {
      // 剪贴板不可用时忽略
    }
  };

  // 客户端配置示例（供 AI 客户端直接粘贴）
  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        'bujic-panel': {
          type: 'http',
          url: mcpEndpoint,
          headers: {
            Authorization: 'Bearer YOUR_MCP_TOKEN',
          },
        },
      },
    },
    null,
    2
  );

  const handleCopyMcpConfig = async () => {
    try {
      await navigator.clipboard.writeText(mcpConfigJson);
      setMcpConfigCopied(true);
      setTimeout(() => setMcpConfigCopied(false), 2000);
    } catch {
      // 剪贴板不可用时忽略
    }
  };

  const loadNetworkSettings = async () => {
    try {
      const { getLanSubnetsAction } = await import('../../actions/systemActions');
      const subnets = await getLanSubnetsAction();
      setSubnetLines(subnets.length > 0 ? [...subnets, ''] : ['']);
      setEnableLanJump(subnets.length > 0);
    } catch {}
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    setBrandMsg('');
    setBrandError(false);
    startTransition(async () => {
      const res = await saveSiteBrandAction({ name: brandName, icon: brandIcon });
      if (res.success) {
        setBrandError(false);
        setBrandMsg(t.brandSaved);
        // 品牌涉及浏览器标题/favicon，整体刷新以应用新配置
        setTimeout(() => window.location.reload(), 800);
      } else {
        setBrandError(true);
        setBrandMsg((res as { message?: string }).message || t.saveFailed);
      }
    });
  };

  const handleBrandIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandMsg('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', 'icon');
    try {
      const res = await fetch('/api/file/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.code === 0) {
        setBrandIcon(data.data.src);
      } else {
        setBrandError(true);
        setBrandMsg(data.message || t.saveFailed);
      }
    } catch {
      setBrandError(true);
      setBrandMsg(t.saveFailed);
    }
  };

  const handleSaveNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkMsg('');
    setNetworkError(false);
    const subnets = subnetLines
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    startTransition(async () => {
      const res = await saveLanSubnetsAction(enableLanJump ? subnets : []);
      if (res.success) {
        setNetworkError(false);
        setNetworkMsg(t.networkSaved);
        setTimeout(() => window.location.reload(), 800);
      } else {
        setNetworkError(true);
        setNetworkMsg((res as { message?: string }).message || t.invalidSubnet);
      }
    });
  };

  const handleUpdateSubnetLine = (idx: number, val: string) => {
    const next = [...subnetLines];
    next[idx] = val;
    setSubnetLines(next);
  };

  const addSubnetLine = () => setSubnetLines((prev) => [...prev, '']);
  const removeSubnetLine = (idx: number) => {
    setSubnetLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const loadUsersList = async () => {
    setIsUserManagePending(true);
    try {
      const list = await getUsersListAction();
      setUsers(list as UserType[]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUserManagePending(false);
    }
  };

  // 打开设置弹窗时加载外部数据与各类列表
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/openness/about')
      .then((res) => res.json())
      .then((data) => {
        if (data.code === 0) {
          setDisclaimer(data.data.disclaimer || t.defaultDisclaimer);
          setAboutText(data.data.about || t.defaultAboutText);
        }
      })
      .catch(() => { });

    // 延后到下一个宏任务执行，避免在 effect 内同步 setState 造成级联渲染
    const timer = setTimeout(() => {
      if (currentUser.role === 1) {
        loadUsersList();
        loadNetworkSettings();
      }
      loadMcpTokens();
      setMcpEndpoint(`${window.location.origin}/api/mcp`);
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, currentUser, t.defaultAboutText, t.defaultDisclaimer]);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError(false);

    startTransition(async () => {
      const res = await updateProfileAction({ name, mail, headImage });
      if (res.success && res.user) {
        setProfileError(false);
        setProfileMsg(t.saveSuccess);
        onRefreshUser(res.user);
      } else {
        setProfileError(true);
        setProfileMsg(res.message || t.saveFailed);
      }
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileMsg('');
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
        setHeadImage(data.data.src);
      } else {
        setProfileError(true);
        setProfileMsg(data.message || t.saveFailed);
      }
    } catch {
      setProfileError(true);
      setProfileMsg(t.saveFailed);
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(true);
      setPasswordMsg(t.passwordMismatch);
      return;
    }

    startTransition(async () => {
      // 加密旧密码和新密码再传输
      const encOld = await encryptSensitive(oldPassword);
      const encNew = await encryptSensitive(newPassword);
      const res = await updatePasswordAction({ oldPassword: encOld, newPassword: encNew });
      if (res.success) {
        setPasswordError(false);
        setPasswordMsg(t.passwordChangedRelogin);
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        setPasswordError(true);
        setPasswordMsg(res.message || t.changeFailed);
      }
    });
  };

  const handleStartAddUser = () => {
    setEditingUser(null);
    setManageUsername('');
    setManagePassword('');
    setManageName('');
    setManageMail('');
    setManageRole(2);
    setManageStatus(1);
    setAdminMsg('');
    setIsAddUserOpen(true);
  };

  const handleStartEditUser = (u: UserType) => {
    setEditingUser(u);
    setManageUsername(u.username);
    setManagePassword('');
    setManageName(u.name || '');
    setManageMail(u.mail || '');
    setManageRole(u.role);
    setManageStatus(u.status);
    setAdminMsg('');
    setIsAddUserOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg('');
    setAdminError(false);

    if (editingUser) {
      // 徂数中密码有内容时才加密
      const encPwd = managePassword ? await encryptSensitive(managePassword) : undefined;
      const res = await updateUserAction({
        id: editingUser.id,
        username: manageUsername,
        name: manageName,
        mail: manageMail,
        status: manageStatus,
        role: manageRole,
        password: encPwd,
      });
      if (res.success) {
        setIsAddUserOpen(false);
        loadUsersList();
        // 修改的是当前登录账号：用户名已变更，提示重新登录并跳转
        if (res.relogin) {
          setAdminMsg(t.usernameChangedRelogin);
          setTimeout(() => {
            window.location.href = '/login';
          }, 1500);
        }
      } else {
        setAdminError(true);
        setAdminMsg(res.message || t.updateFailed);
      }
    } else {
      // 新建用户密码加密
      const encPwd = managePassword ? await encryptSensitive(managePassword) : undefined;
      const res = await createUserAction({
        username: manageUsername,
        password: encPwd,
        name: manageName,
        mail: manageMail,
        role: manageRole,
        status: manageStatus,
      });
      if (res.success) {
        setIsAddUserOpen(false);
        loadUsersList();
      } else {
        setAdminError(true);
        setAdminMsg(res.message || t.addFailed);
      }
    }
  };

  // 删除用户（确认框已二次确认）
  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const res = await deleteUsersAction([deleteUserTarget.id]);
    if (res.success) {
      loadUsersList();
    } else {
      setAdminError(true);
      setAdminMsg(res.message || t.changeFailed);
    }
  };

  const handleExportConfig = async () => {
    try {
      const exportBtn = document.getElementById('dashboard-export-action');
      if (exportBtn) {
        exportBtn.click();
      }
    } catch { }
  };

  const handleImportConfig = () => {
    const importInput = document.getElementById('dashboard-import-input');
    if (importInput) {
      importInput.click();
    }
  };

  // 设置页签统一样式：桌面端竖向侧栏（sm 起 w-full 左对齐），移动端横向滚动（w-auto 不收缩）
  const tabItemCls =
    'flex items-center justify-start gap-1.5 px-3 py-2 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0 sm:w-full max-sm:w-auto! max-sm:flex-none!';

  return (
    <>
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // 关闭设置时清除一次性令牌明文
        if (!open) {
          setMcpPlain('');
          setMcpMsg('');
        }
        onClose();
      }}
    >
      <DialogContent aria-describedby={undefined} className="sm:max-w-[960px] h-[85vh] sm:h-[680px] max-h-[calc(100vh-2rem)] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 pb-3 shrink-0 border-b border-white/5">
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <span>{t.settings}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 py-5">
          <Tabs
            defaultValue="profile"
            orientation="vertical"
            className="h-full w-full text-sm flex flex-col sm:flex-row gap-5"
            onValueChange={(v) => {
              // 离开 MCP 页签时清除一次性令牌明文
              if (v !== 'mcp') {
                setMcpPlain('');
                setMcpMsg('');
              }
            }}
          >
            <TabsList className="bg-white/5 border border-white/5 shrink-0 w-full sm:w-[176px] justify-start rounded-xl p-1 gap-1 max-sm:flex-row! max-sm:overflow-x-auto scrollbar-none">
              <TabsTrigger value="profile" className={tabItemCls}>
                <User size={13} />
                <span>{t.profile}</span>
              </TabsTrigger>
              <TabsTrigger value="security" className={tabItemCls}>
                <Lock size={13} />
                <span>{t.passwordChange}</span>
              </TabsTrigger>
              {currentUser.role === 1 && (
                <TabsTrigger value="users" className={tabItemCls}>
                  <Shield size={13} />
                  <span>{t.userManagement}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="appearance" className={tabItemCls}>
                <Palette size={13} />
                <span>{t.styleSettings}</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className={tabItemCls}>
                <Download size={13} />
                <span>{t.importExport}</span>
              </TabsTrigger>
              <TabsTrigger value="mcp" className={tabItemCls}>
                <Plug size={13} />
                <span>{t.mcpAccess}</span>
              </TabsTrigger>
              <TabsTrigger value="about" className={tabItemCls}>
                <Info size={13} />
                <span>{t.about}</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto pr-1">
              {/* 1. 个人资料中心 */}
            <TabsContent value="profile" className="space-y-5">
              {/* 基本资料 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <User size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white/90">{t.basicProfile}</h4>
                </div>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                {profileMsg && (
                  <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${profileError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                    {profileMsg}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                    {headImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={headImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-heading font-extrabold text-indigo-400">
                        {name.substring(0, 1).toUpperCase() || 'U'}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      id="avatar-upload-file"
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-upload-file"
                      className="px-3.5 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium rounded-xl transition cursor-pointer select-none text-white/80"
                    >
                      {t.changeAvatar}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.name}</Label>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.email}</Label>
                    <Input
                      type="email"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                      className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    <span>{t.save}</span>
                  </button>
                </div>
              </form>
              </div>

              {/* 账号信息（只读） */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Shield size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white/90">{t.accountInfo}</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.username}</Label>
                    <div className="text-xs text-white/80 py-3 px-3.5 bg-white/5 rounded-xl border border-white/5 truncate">
                      {currentUser.username}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.role}</Label>
                    <div className="text-xs text-white/80 py-3 px-3.5 bg-white/5 rounded-xl border border-white/5">
                      {currentUser.role === 1 ? t.admin : t.normalUser}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.registerTime}</Label>
                    <div className="text-xs text-white/80 py-3 px-3.5 bg-white/5 rounded-xl border border-white/5">
                      {formatDay(currentUser.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 2. 修改密码 */}
            <TabsContent value="security" className="space-y-5">
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white/90">{t.passwordChange}</h4>
                </div>
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {passwordMsg && (
                  <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${passwordError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                    {passwordMsg}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-white/60 text-xs">{t.oldPassword}</Label>
                  <Input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.newPassword}</Label>
                    <Input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.confirmPasswordLabel}</Label>
                    <Input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-1.5 px-5 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
                  >
                    {isPending && <Loader2 size={13} className="animate-spin" />}
                    <span>{t.save}</span>
                  </button>
                </div>
              </form>
              </div>

              {/* 安全提示 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Shield size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white/90">{t.securityTips}</h4>
                </div>
                <ul className="space-y-3">
                  {[t.securityTip1, t.securityTip2, t.securityTip3].map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-xs text-white/40 leading-relaxed">
                      <span className="mt-2 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>

            {/* 3. 用户管理 (管理员专享) */}
            {currentUser.role === 1 && (
              <TabsContent value="users" className="space-y-5">
                {isAddUserOpen ? (
                  <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        {editingUser ? <Edit2 size={20} /> : <Plus size={20} />}
                      </div>
                      <h4 className="text-xs font-bold text-white/90">
                        {editingUser ? t.editUser : t.addUser}
                      </h4>
                    </div>
                  <form onSubmit={handleSaveUser} className="space-y-5">
                    {adminMsg && (
                      <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${adminError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                        {adminMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/60 text-xs">{t.username}</Label>
                        <Input
                          type="text"
                          required
                          value={manageUsername}
                          onChange={(e) => setManageUsername(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                        />
                        {!!editingUser && editingUser.id === currentUser.id && (
                          <p className="text-[10px] text-white/30 mt-1">{t.usernameSelfChangeHint}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs">{t.password}</Label>
                        <Input
                          type="password"
                          placeholder={editingUser ? t.leaveEmptyToKeep : t.defaultPassword}
                          value={managePassword}
                          onChange={(e) => setManagePassword(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/60 text-xs">{t.name}</Label>
                        <Input
                          type="text"
                          value={manageName}
                          onChange={(e) => setManageName(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                        />
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs">{t.email}</Label>
                        <Input
                          type="email"
                          value={manageMail}
                          onChange={(e) => setManageMail(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white/60 text-xs">{t.role}</Label>
                        <select
                          value={manageRole}
                          onChange={(e) => setManageRole(Number(e.target.value))}
                          className="w-full h-9 px-2.5 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs"
                        >
                          <option value={2}>{t.normalUser}</option>
                          <option value={1}>{t.admin}</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs">{t.status}</Label>
                        <select
                          value={manageStatus}
                          onChange={(e) => setManageStatus(Number(e.target.value))}
                          className="w-full h-9 px-2.5 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs"
                        >
                          <option value={1}>{t.active}</option>
                          <option value={2}>{t.inactive}</option>
                          <option value={3}>{t.unactivated}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddUserOpen(false)}
                        className="px-4 py-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer"
                      >
                        {t.save}
                      </button>
                    </div>
                  </form>
                  </div>
                ) : (
                  <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <User size={20} />
                        </div>
                        <h4 className="text-xs font-bold text-white/90">{t.registeredUsers}</h4>
                      </div>
                      <button
                        onClick={handleStartAddUser}
                        className="flex items-center gap-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-indigo-500/20 cursor-pointer shrink-0"
                      >
                        <Plus size={13} />
                        <span>{t.addUser}</span>
                      </button>
                    </div>

                    {adminMsg && (
                      <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${adminError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                        {adminMsg}
                      </div>
                    )}

                    {isUserManagePending ? (
                      <div className="flex items-center justify-center py-12 text-white/40">
                        <Loader2 size={24} className="animate-spin" />
                      </div>
                    ) : (
                      <div className="border border-white/5 rounded-xl overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-white/5 text-white/60 border-b border-white/5 font-semibold">
                              <th className="p-3">{t.accountCol}</th>
                              <th className="p-3">{t.nicknameCol}</th>
                              <th className="p-3">{t.role}</th>
                              <th className="p-3">{t.status}</th>
                              <th className="p-3 text-right">{t.actions}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((u) => (
                              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 text-white/80">
                                <td className="p-3 font-semibold">{u.username}</td>
                                <td className="p-3">{u.name || '-'}</td>
                                <td className="p-3">{u.role === 1 ? t.admin : t.normalUser}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${u.status === 1 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {u.status === 1 ? t.active : t.inactive}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => handleStartEditUser(u)}
                                      className="p-1 rounded bg-white/5 border border-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition cursor-pointer"
                                    >
                                      <Edit2 size={11} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteUserTarget(u)}
                                      disabled={u.id === currentUser.id}
                                      className="p-1 rounded bg-white/5 border border-white/5 hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            )}

            {/* 外观主题 */}
            <TabsContent value="appearance" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEMES.map((th) => {
                  const isActive = theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setTheme(th.id as ThemeId)}
                      className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border transition cursor-pointer ${isActive
                        ? 'border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/40'
                        : 'border-white/5 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                      <div
                        className="w-full h-10 rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${th.primary} 0%, ${th.bg} 100%)` }}
                      />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white/90">{th.label}</p>
                        <p className="text-[10px] text-white/40">{th.description}</p>
                      </div>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--primary)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 站点品牌（管理员） */}
              {currentUser.role === 1 && (
                <div className="mt-6 p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette size={15} className="text-indigo-400" />
                    <h4 className="text-xs font-bold text-white/90 flex items-center gap-2">
                      {t.siteBrand}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 font-mono">Admin</span>
                    </h4>
                  </div>
                  {brandMsg && (
                    <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${brandError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                      {brandMsg}
                    </div>
                  )}
                  <form onSubmit={handleSaveBrand} className="space-y-3">
                    <div className="flex items-end gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden text-indigo-400 flex-shrink-0">
                        {brandIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={safeIconSrc(brandIcon)} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <Globe size={20} />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-white/60 text-xs">{t.siteName}</Label>
                        <Input
                          type="text"
                          placeholder={t.loginTitle}
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Label className="text-white/60 text-xs w-24 shrink-0">{t.siteIcon}</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBrandIconUpload}
                        id="brand-icon-upload"
                        className="hidden"
                      />
                      <label
                        htmlFor="brand-icon-upload"
                        className="px-3 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium rounded-xl transition cursor-pointer select-none text-white/80"
                      >
                        {t.uploadIcon}
                      </label>
                      {brandIcon && (
                        <button
                          type="button"
                          onClick={() => setBrandIcon('')}
                          className="px-3 py-1.5 bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium rounded-xl transition cursor-pointer text-white/60"
                        >
                          {t.restoreDefaultIcon}
                        </button>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
                      >
                        {isPending && <Loader2 size={13} className="animate-spin" />}
                        <span>{t.save}</span>
                      </button>
                    </div>
                  </form>
                  <p className="text-[10px] text-white/30 leading-relaxed">{t.siteBrandHint}</p>
                </div>
              )}

              {/* 网络区域（管理员） */}
              {currentUser.role === 1 && (
                <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2">
                    <Network size={15} className="text-indigo-400" />
                    <h4 className="text-xs font-bold text-white/90 flex items-center gap-2">
                      {t.networkArea}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/40 font-mono">Admin</span>
                    </h4>
                  </div>
                  {networkMsg && (
                    <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${networkError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                      {networkMsg}
                    </div>
                  )}
                  <form onSubmit={handleSaveNetwork} className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5">
                      <div>
                        <Label className="text-white/90 text-xs font-semibold">{t.enableLanJump}</Label>
                        <p className="text-[10px] text-white/30 mt-0.5">{t.lanAreaHint}</p>
                      </div>
                      <Switch checked={enableLanJump} onCheckedChange={setEnableLanJump} />
                    </div>

                    {enableLanJump && (
                      <div className="space-y-2">
                        <Label className="text-white/60 text-xs">{t.lanSubnets}</Label>
                        {subnetLines.map((line, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              type="text"
                              placeholder={t.lanSubnetPlaceholder}
                              value={line}
                              onChange={(e) => handleUpdateSubnetLine(idx, e.target.value)}
                              className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                            />
                            <button
                              type="button"
                              onClick={() => removeSubnetLine(idx)}
                              disabled={subnetLines.length <= 1}
                              className="p-2 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-white/40 cursor-pointer disabled:opacity-30"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addSubnetLine}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>{t.addSubnet}</span>
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
                      >
                        {isPending && <Loader2 size={13} className="animate-spin" />}
                        <span>{t.save}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </TabsContent>

            {/* 4. 导入导出 */}
            <TabsContent value="backup" className="space-y-5">
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/90">{t.backupTitle}</h4>
                    <p className="text-[10px] text-white/30 mt-0.5">{t.backupDesc}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-1">
                  <button
                    onClick={handleExportConfig}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-98 transition text-xs font-semibold text-white/80 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>{t.exportJson}</span>
                  </button>
                  <button
                    onClick={handleImportConfig}
                    className="flex-1 flex items-center justify-center gap-2 py-4 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-98 transition text-xs font-semibold text-white shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>{t.importJson}</span>
                  </button>
                </div>
              </div>

              {/* 当前数据概况 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Database size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/90">{t.dataOverview}</h4>
                    <p className="text-[10px] text-white/30 mt-0.5">{t.dataOverviewHint}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: t.statTabs, value: dataStats?.tabs ?? 0 },
                    { label: t.statGroups, value: dataStats?.groups ?? 0 },
                    { label: t.statBookmarks, value: dataStats?.bookmarks ?? 0 },
                    { label: t.statWidgets, value: dataStats?.widgets ?? 0 },
                  ].map((item) => (
                    <div key={item.label} className="py-5 rounded-xl bg-white/5 border border-white/5 text-center">
                      <div className="text-2xl font-heading font-extrabold text-indigo-300">{item.value}</div>
                      <div className="text-[10px] text-white/40 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* MCP 接入 */}
            <TabsContent value="mcp" className="space-y-5">
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <Plug size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/90">{t.mcpAccess}</h4>
                    <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{t.mcpIntro}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-white/40 shrink-0">{t.mcpEndpoint}</span>
                  <code className="flex-1 px-2 py-1 rounded bg-black/30 border border-white/5 text-indigo-300 font-mono truncate">
                    {mcpEndpoint}
                  </code>
                </div>
              </div>

              {mcpMsg && (
                <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${mcpError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                  {mcpMsg}
                </div>
              )}

              {mcpPlain && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-amber-400" />
                    <h5 className="text-xs font-bold text-amber-300">{t.mcpTokenOnceTitle}</h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-amber-200 break-all">
                      {mcpPlain}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyMcpToken}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition cursor-pointer shrink-0"
                    >
                      <Copy size={12} />
                      <span>{t.mcpCopy}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-300/70 leading-relaxed">{t.mcpTokenOnceHint}</p>
                </div>
              )}

              {/* 令牌列表 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <KeyRound size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-white/90">{t.mcpTokenList}</h4>
                </div>

                {mcpLoading ? (
                  <div className="flex items-center justify-center py-8 text-white/40">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : mcpTokens.length === 0 ? (
                  <p className="text-[11px] text-white/30 px-1 py-4 text-center border border-dashed border-white/10 rounded-xl">
                    {t.mcpNoTokens}
                  </p>
                ) : (
                  <div className="border border-white/5 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-white/5 text-white/60 border-b border-white/5 font-semibold">
                          <th className="p-3">{t.mcpName}</th>
                          <th className="p-3">{t.mcpScope}</th>
                          <th className="p-3">{t.status}</th>
                          <th className="p-3">{t.mcpLastUsed}</th>
                          <th className="p-3 text-right">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mcpTokens.map((tk) => {
                          const isActive = tk.status === 1;
                          return (
                            <tr key={tk.id} className="border-b border-white/5 hover:bg-white/5 text-white/80">
                              <td className="p-3 font-semibold">{tk.name}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${tk.scope === 'readwrite' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-white/10 text-white/50'}`}>
                                  {tk.scope === 'readwrite' ? t.mcpScopeReadwrite : t.mcpScopeReadonly}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {isActive ? t.active : t.mcpDisable}
                                </span>
                              </td>
                              <td className="p-3 text-white/50">
                                {tk.lastUsedAt ? new Date(tk.lastUsedAt).toLocaleString() : t.mcpNeverUsed}
                              </td>
                              <td className="p-3 text-right">
                                <span className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleMcpToken(tk)}
                                    className={`px-2 py-0.5 rounded text-[10px] border transition cursor-pointer ${
                                      isActive
                                        ? 'bg-white/5 border-white/5 text-white/60 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/30'
                                        : 'bg-white/5 border-white/5 text-white/60 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30'
                                    }`}
                                  >
                                    {isActive ? t.mcpDisable : t.active}
                                  </button>
                                  <button
                                    onClick={() => setDeleteTokenTarget(tk)}
                                    className="p-1 rounded bg-white/5 border border-white/5 hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 生成新令牌 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                <h4 className="text-xs font-bold text-white/70">{t.mcpGenerate}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.mcpName}</Label>
                    <Input
                      type="text"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                      placeholder={t.mcpNamePlaceholder}
                      className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl placeholder-white/20"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-white/60 text-xs">{t.mcpScope}</Label>
                    <select
                      value={mcpScope}
                      onChange={(e) => setMcpScope(e.target.value === 'readwrite' ? 'readwrite' : 'readonly')}
                      className="w-full h-9 px-2 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs"
                    >
                      <option value="readonly">{t.mcpScopeReadonly}</option>
                      <option value="readwrite">{t.mcpScopeReadwrite}</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleGenerateMcpToken}
                    disabled={mcpGenerating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 rounded-xl text-xs font-semibold text-white transition active:scale-95 cursor-pointer"
                  >
                    {mcpGenerating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>{t.mcpGenerate}</span>
                  </button>
                </div>
              </div>

              {/* 客户端配置示例 */}
              <div className="p-5 bg-white/5 border border-white/5 rounded-xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white/70">{t.mcpConfigExample}</h4>
                    <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">{t.mcpConfigHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMcpConfig}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 text-white/60 text-[11px] font-semibold transition cursor-pointer shrink-0"
                  >
                    {mcpConfigCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{mcpConfigCopied ? t.mcpCopied : t.mcpCopy}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-black/40 border border-white/10 text-[11px] font-mono text-indigo-200/90 overflow-x-auto leading-relaxed">
                  {mcpConfigJson}
                </pre>
              </div>
            </TabsContent>

            {/* 5. 关于项目 */}
            <TabsContent value="about" className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3 text-xs leading-relaxed text-white/70">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading font-extrabold text-base text-indigo-400">{t.loginTitle}</span>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-mono">v2026.10.20</span>
                </div>
                <p>{aboutText}</p>
                <div className="border-t border-white/5 pt-3 mt-3">
                  <h5 className="font-semibold text-white/50 text-[10px] uppercase tracking-wider mb-1">{t.disclaimerTitle}</h5>
                  <p className="text-[10px] text-white/30 leading-normal">{disclaimer}</p>
                </div>
              </div>
            </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>

    {/* 删除确认：MCP 令牌 */}
    <ConfirmDeleteModal
      isOpen={deleteTokenTarget !== null}
      onClose={() => setDeleteTokenTarget(null)}
      onConfirm={handleDeleteMcpToken}
      title={t.mcpDeleteKey}
      description={
        deleteTokenTarget
          ? `${t.mcpDeleteKeyConfirm} (${deleteTokenTarget.name})`
          : t.mcpDeleteKeyConfirm
      }
    />

    {/* 删除确认：用户 */}
    <ConfirmDeleteModal
      isOpen={deleteUserTarget !== null}
      onClose={() => setDeleteUserTarget(null)}
      onConfirm={handleDeleteUser}
      title={t.deleteUser}
      description={
        deleteUserTarget
          ? `${t.deleteUserConfirm} (${deleteUserTarget.username})`
          : t.deleteUserConfirm
      }
    />
    </>
  );
}
