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
import {
  updateProfileAction,
  updatePasswordAction,
  getUsersListAction,
  createUserAction,
  updateUserAction,
  deleteUsersAction,
} from '../../actions/userActions';
import { Loader2, Plus, Edit2, Trash2, Shield, User, Lock, Download, Upload, Info, Palette } from 'lucide-react';
import { THEMES, ThemeId } from '../../lib/themes';
import { useTheme } from '../I18nProvider';

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
  };
  onRefreshUser: (updatedUser: any) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
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
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

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

  // 挂载加载
  useEffect(() => {
    setName(currentUser.name || '');
    setMail(currentUser.mail || '');
    setHeadImage(currentUser.headImage || '');
    setProfileMsg('');
    setPasswordMsg('');

    if (isOpen) {
      fetch('/api/openness/about')
        .then((res) => res.json())
        .then((data) => {
          if (data.code === 0) {
            setDisclaimer(data.data.disclaimer || t.noDisclaimer);
            setAboutText(data.data.about || t.defaultAboutText);
          }
        })
        .catch(() => {});

      if (currentUser.role === 1) {
        loadUsersList();
      }
    }
  }, [isOpen, currentUser]);

  const loadUsersList = async () => {
    setIsUserManagePending(true);
    try {
      const list = await getUsersListAction();
      setUsers(list as any);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUserManagePending(false);
    }
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError(false);

    startTransition(async () => {
      const res = await updateProfileAction({ name, mail, headImage });
      if (res.success) {
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
    } catch (e) {
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
      const res = await updatePasswordAction({ oldPassword, newPassword });
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
      const res = await updateUserAction({
        id: editingUser.id,
        name: manageName,
        mail: manageMail,
        status: manageStatus,
        role: manageRole,
        password: managePassword || undefined,
      });
      if (res.success) {
        setIsAddUserOpen(false);
        loadUsersList();
      } else {
        setAdminError(true);
        setAdminMsg(res.message || t.updateFailed);
      }
    } else {
      const res = await createUserAction({
        username: manageUsername,
        password: managePassword || undefined,
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

  const handleDeleteUser = async (id: number) => {
    const res = await deleteUsersAction([id]);
    if (res.success) {
      setDeletingUserId(null);
      loadUsersList();
    } else {
      setDeletingUserId(null);
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
    } catch (e) {}
  };

  const handleImportConfig = () => {
    const importInput = document.getElementById('dashboard-import-input');
    if (importInput) {
      importInput.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] bg-[#12131a]/95 border border-white/5 text-white/90 rounded-2xl backdrop-blur-xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-heading text-lg font-bold text-white flex items-center gap-2">
            <span>{t.settings}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <Tabs defaultValue="profile" className="w-full text-sm">
            <TabsList className="bg-white/5 border border-white/5 w-full h-auto justify-start rounded-xl p-1 mb-4 flex flex-nowrap overflow-x-auto whitespace-nowrap scrollbar-none">
              <TabsTrigger value="profile" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                <User size={13} />
                <span>{t.profile}</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                <Lock size={13} />
                <span>{t.passwordChange}</span>
              </TabsTrigger>
              {currentUser.role === 1 && (
                <TabsTrigger value="users" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                  <Shield size={13} />
                  <span>{t.userManagement}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="appearance" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                <Palette size={13} />
                <span>{t.styleSettings}</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                <Download size={13} />
                <span>{t.importExport}</span>
              </TabsTrigger>
              <TabsTrigger value="about" className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg data-[state=active]:bg-indigo-500 data-[state=active]:text-white text-xs cursor-pointer shrink-0">
                <Info size={13} />
                <span>{t.about}</span>
              </TabsTrigger>
            </TabsList>

            {/* 1. 个人资料中心 */}
            <TabsContent value="profile" className="space-y-4">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                {profileMsg && (
                  <div className={`text-xs font-semibold px-4 py-3 rounded-lg ${profileError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                    {profileMsg}
                  </div>
                )}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                    {headImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={headImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-heading font-extrabold text-indigo-400">
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
            </TabsContent>

            {/* 2. 修改密码 */}
            <TabsContent value="security">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
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
            </TabsContent>

            {/* 3. 用户管理 (管理员专享) */}
            {currentUser.role === 1 && (
              <TabsContent value="users" className="space-y-4">
                {isAddUserOpen ? (
                  <form onSubmit={handleSaveUser} className="space-y-3 p-3 bg-white/5 border border-white/5 rounded-xl">
                    <h4 className="text-xs font-bold text-white mb-2">
                      {editingUser ? t.editUser : t.addUser}
                    </h4>

                    {adminMsg && (
                      <div className="text-xs font-semibold px-3 py-2 rounded bg-red-500/10 border border-red-500/20 text-red-400 mb-2">
                        {adminMsg}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.username}</Label>
                        <Input
                          type="text"
                          required
                          disabled={!!editingUser}
                          value={manageUsername}
                          onChange={(e) => setManageUsername(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl h-8 text-xs placeholder-white/20"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.password}</Label>
                        <Input
                          type="password"
                          placeholder={editingUser ? t.leaveEmptyToKeep : t.defaultPassword}
                          value={managePassword}
                          onChange={(e) => setManagePassword(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl h-8 text-xs placeholder-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.name}</Label>
                        <Input
                          type="text"
                          value={manageName}
                          onChange={(e) => setManageName(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl h-8 text-xs placeholder-white/20"
                        />
                      </div>
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.email}</Label>
                        <Input
                          type="email"
                          value={manageMail}
                          onChange={(e) => setManageMail(e.target.value)}
                          className="bg-white/5 border-white/5 focus-visible:ring-indigo-500/30 text-white rounded-xl h-8 text-xs placeholder-white/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.role}</Label>
                        <select
                          value={manageRole}
                          onChange={(e) => setManageRole(Number(e.target.value))}
                          className="w-full h-8 px-2 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs"
                        >
                          <option value={2}>{t.normalUser}</option>
                          <option value={1}>{t.admin}</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-white/50 text-[10px] uppercase">{t.status}</Label>
                        <select
                          value={manageStatus}
                          onChange={(e) => setManageStatus(Number(e.target.value))}
                          className="w-full h-8 px-2 bg-white/5 border border-white/5 rounded-xl text-white outline-none focus:border-indigo-500/40 text-xs"
                        >
                          <option value={1}>{t.active}</option>
                          <option value={2}>{t.inactive}</option>
                          <option value={3}>{t.unactivated}</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setIsAddUserOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/70 transition cursor-pointer"
                      >
                        {t.cancel}
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition cursor-pointer shadow-md shadow-indigo-500/10"
                      >
                        {t.save}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-white/50">{t.registeredUsers}</h4>
                      <button
                        onClick={handleStartAddUser}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-semibold text-white transition active:scale-95 shadow-md shadow-indigo-500/10 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>{t.addUser}</span>
                      </button>
                    </div>

                    {adminMsg && (
                      <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${adminError ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
                        {adminMsg}
                      </div>
                    )}

                    {isUserManagePending ? (
                      <div className="flex items-center justify-center py-12 text-white/40">
                        <Loader2 size={24} className="animate-spin" />
                      </div>
                    ) : (
                      <div className="border border-white/5 rounded-xl overflow-x-auto max-h-[260px] overflow-y-auto pr-1">
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
                                  {deletingUserId === u.id ? (
                                    <span className="flex items-center justify-end gap-1">
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        className="px-2 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer"
                                      >
                                        {t.delete}
                                      </button>
                                      <button
                                        onClick={() => setDeletingUserId(null)}
                                        className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-white/50 hover:bg-white/10 transition cursor-pointer"
                                      >
                                        {t.cancel}
                                      </button>
                                    </span>
                                  ) : (
                                    <span className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleStartEditUser(u)}
                                        className="p-1 rounded bg-white/5 border border-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 transition cursor-pointer"
                                      >
                                        <Edit2 size={11} />
                                      </button>
                                      <button
                                        onClick={() => setDeletingUserId(u.id)}
                                        disabled={u.id === currentUser.id}
                                        className="p-1 rounded bg-white/5 border border-white/5 hover:bg-red-500/20 hover:text-red-400 transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </span>
                                  )}
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
                      className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border transition cursor-pointer ${
                        isActive
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
            </TabsContent>

            {/* 4. 导入导出 */}
            <TabsContent value="backup" className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white/90">{t.backupTitle}</h4>
                    <p className="text-[10px] text-white/30 mt-0.5">{t.backupDesc}</p>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={handleExportConfig}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-98 transition text-xs font-semibold text-white/80 cursor-pointer"
                  >
                    <Download size={14} />
                    <span>{t.exportJson}</span>
                  </button>
                  <button
                    onClick={handleImportConfig}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 active:scale-98 transition text-xs font-semibold text-white shadow-md shadow-indigo-500/10 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>{t.importJson}</span>
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* 5. 关于项目 */}
            <TabsContent value="about" className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3 text-xs leading-relaxed text-white/70">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading font-extrabold text-base text-indigo-400">{t.loginTitle}</span>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-mono">v2.0.4 - Next.js Migration</span>
                </div>
                <p>{aboutText}</p>
                <div className="border-t border-white/5 pt-3 mt-3">
                  <h5 className="font-semibold text-white/50 text-[10px] uppercase tracking-wider mb-1">{t.disclaimerTitle}</h5>
                  <p className="text-[10px] text-white/30 leading-normal">{disclaimer}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
