import md5 from 'js-md5';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'bujic-panel-super-secret-key-1234567890';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export function hashMD5(str: string): string {
  return (md5 as any)(str);
}

// 三重 MD5 加密
export function passwordEncryption(password: string): string {
  return hashMD5(hashMD5(hashMD5(password)));
}

// 签发 JWT Token
export async function signJWT(payload: { userId: number; username: string; role: number }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // 7天过期
    .sign(SECRET_KEY);
}

// 校验 JWT Token
export async function verifyJWT(token: string): Promise<{ userId: number; username: string; role: number } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as { userId: number; username: string; role: number };
  } catch (err) {
    return null;
  }
}

// 获取当前登录用户 (支持 Server Component / Server Action / Route Handler)
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        name: true,
        headImage: true,
        status: true,
        role: true,
        mail: true,
      },
    });

    if (!user || user.status !== 1) {
      return null;
    }

    return user;
  } catch (e) {
    return null;
  }
}

// 从请求头或 Cookie 中提取 Token 并进行校验 (通用)
export async function verifyRequestAuth(req: Request) {
  try {
    let token = '';

    // 1. 从 headers 中尝试提取
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = req.headers.get('token') || '';
    }

    // 2. 从 cookies 中尝试提取
    if (!token) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) return null;

    const payload = await verifyJWT(token);
    if (!payload) return null;

    const user = await db.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.status !== 1) {
      return null;
    }

    return user;
  } catch (e) {
    return null;
  }
}
