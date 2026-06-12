'use server';

import { db } from '../lib/db';
import { cookies } from 'next/headers';
import { passwordEncryption, signJWT, getCurrentUser } from '../lib/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

// 登录动作
export async function loginAction(data: { username: string; password: string }) {
  const username = data.username.trim();
  const encryptedPassword = passwordEncryption(data.password);

  const user = await db.user.findFirst({
    where: { username, password: encryptedPassword },
  });

  if (!user) {
    return { success: false, code: 1003, message: '用户名或密码错误' };
  }

  if (user.status !== 1) {
    return { success: false, code: 1004, message: '该账号已停用或未激活' };
  }

  let dbToken = user.token;
  if (!dbToken) {
    // 循环生成 32 位唯一随机 token 防止碰撞
    let isUnique = false;
    while (!isUnique) {
      dbToken = crypto.randomBytes(16).toString('hex'); // 32位十六进制字符串
      const existing = await db.user.findUnique({ where: { token: dbToken } });
      if (!existing) {
        await db.user.update({
          where: { id: user.id },
          data: { token: dbToken },
        });
        isUnique = true;
      }
    }
  }

  // 生成客户端 JWT Token (cToken 变体)
  const clientToken = await signJWT({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  // 设置 httpOnly Cookie 进行会话状态管理
  const cookieStore = await cookies();
  cookieStore.set('auth_token', clientToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 天过期
    path: '/',
  });

  const responseUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    headImage: user.headImage,
    role: user.role,
    mail: user.mail,
    token: clientToken,
  };

  return { success: true, user: responseUser };
}

// 退出登录
export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  return { success: true };
}

// 更新个人密码
export async function updatePasswordAction(data: { oldPassword: string; newPassword: string }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const oldEncrypted = passwordEncryption(data.oldPassword);
  const newEncrypted = passwordEncryption(data.newPassword);

  const matched = await db.user.findFirst({
    where: { id: user.id, password: oldEncrypted },
  });

  if (!matched) {
    return { success: false, message: '旧密码输入有误，请重新输入' };
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      password: newEncrypted,
      token: '', // 清除原持久化 token 触发重新登录
    },
  });

  // 清除 Cookie
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');

  return { success: true };
}

// 更新个人档案
export async function updateProfileAction(data: {
  name?: string;
  mail?: string;
  headImage?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  // 邮箱查重
  if (data.mail) {
    const existing = await db.user.findFirst({
      where: {
        mail: data.mail,
        id: { not: user.id },
      },
    });
    if (existing) {
      return { success: false, message: '该邮箱已被其他账户绑定' };
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      name: data.name,
      mail: data.mail,
      headImage: data.headImage,
    },
    select: {
      id: true,
      username: true,
      name: true,
      headImage: true,
      role: true,
      mail: true,
    },
  });

  revalidatePath('/');
  return { success: true, user: updated };
}

// 管理员：获取用户列表
export async function getUsersListAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== 1) throw new Error('Forbidden');

  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      name: true,
      headImage: true,
      status: true,
      role: true,
      mail: true,
      createdAt: true,
    },
  });

  return users;
}

// 管理员：创建用户
export async function createUserAction(data: {
  username: string;
  password?: string;
  name?: string;
  mail?: string;
  status?: number;
  role?: number;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 1) throw new Error('Forbidden');

  const username = data.username.trim();

  // 重复账号校验
  const existingUsername = await db.user.findUnique({ where: { username } });
  if (existingUsername) {
    return { success: false, message: '该用户名已被占用' };
  }

  if (data.mail) {
    const existingMail = await db.user.findFirst({ where: { mail: data.mail } });
    if (existingMail) {
      return { success: false, message: '该邮箱已被占用' };
    }
  }

  const defaultPassword = data.password ? passwordEncryption(data.password) : passwordEncryption('123456');

  const created = await db.user.create({
    data: {
      username,
      password: defaultPassword,
      name: data.name || username,
      mail: data.mail || '',
      status: data.status ?? 1,
      role: data.role ?? 2,
    },
  });

  return { success: true, user: created };
}

// 管理员：更新用户
export async function updateUserAction(data: {
  id: number;
  name?: string;
  mail?: string;
  status?: number;
  role?: number;
  password?: string;
}) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 1) throw new Error('Forbidden');

  if (data.mail) {
    const existingMail = await db.user.findFirst({
      where: { mail: data.mail, id: { not: data.id } },
    });
    if (existingMail) {
      return { success: false, message: '该邮箱已被占用' };
    }
  }

  const updateData: any = {
    name: data.name,
    mail: data.mail,
    status: data.status,
    role: data.role,
  };

  if (data.password) {
    updateData.password = passwordEncryption(data.password);
  }

  const updated = await db.user.update({
    where: { id: data.id },
    data: updateData,
  });

  return { success: true, user: updated };
}

// 管理员：删除用户
export async function deleteUsersAction(ids: number[]) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 1) throw new Error('Forbidden');

  // 禁止自删
  if (ids.includes(admin.id)) {
    return { success: false, message: '禁止删除当前正在登录的管理员账号' };
  }

  await db.user.deleteMany({
    where: { id: { in: ids } },
  });

  return { success: true };
}
