'use server';

import { getCurrentUser } from '../lib/auth';
import { upsertSystemSetting, getSiteBrand, getLanSubnets, SITE_BRAND_KEY, LAN_SUBNETS_KEY } from '../lib/settings';
import { revalidatePath } from 'next/cache';
import { normalizeIpv4, normalizeIpv4Prefix } from '../lib/net';

type SessionUser = { id: number; username: string; name: string | null; headImage: string | null; status: number; role: number; mail: string | null };

function requireAdmin(user: SessionUser | null): SessionUser {
  if (!user) throw new Error('Unauthorized');
  if (user.role !== 1) throw new Error('Forbidden');
  return user;
}

// 读取当前站点品牌（管理员/普通用户均可见，但只读接口直接放行）
export async function getSiteBrandAction() {
  const user = await getCurrentUser();
  if (!user) return null;
  return getSiteBrand();
}

// 保存站点品牌（管理员）
export async function saveSiteBrandAction(data: { name: string; icon: string }) {
  const user = await getCurrentUser();
  requireAdmin(user);

  const brand = {
    name: (data.name || '').trim().slice(0, 40),
    icon: (data.icon || '').trim(),
    v: Date.now(), // 版本号用于 favicon 缓存刷新
  };

  await upsertSystemSetting(SITE_BRAND_KEY, JSON.stringify(brand));
  revalidatePath('/');
  revalidatePath('/login');
  return { success: true, brand };
}

// 读取内网网段（仅管理员）
export async function getLanSubnetsAction() {
  const user = await getCurrentUser();
  requireAdmin(user);
  return getLanSubnets();
}

// 保存内网网段（管理员）
export async function saveLanSubnetsAction(subnets: string[]) {
  const user = await getCurrentUser();
  requireAdmin(user);

  const cleaned: string[] = [];
  for (const raw of subnets || []) {
    const entry = (raw || '').trim();
    if (!entry) continue;
    // 校验 CIDR
    const cidr = entry.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (cidr) {
      const base = normalizeIpv4(cidr[1]);
      const bits = Number(cidr[2]);
      if (!base || bits < 0 || bits > 32) {
        return { success: false, message: `无效网段：${entry}（应为 CIDR 或 IP 前缀）` };
      }
      cleaned.push(`${base}/${bits}`);
      continue;
    }
    // 前缀校验（192.168.31. 或 192.168.31）
    const prefix = normalizeIpv4Prefix(entry);
    if (prefix && prefix.split('.').length >= 1 && prefix.split('.').length <= 4) {
      cleaned.push(prefix.split('.').length === 4 ? normalizeIpv4(prefix) || prefix : prefix);
      continue;
    }
    return { success: false, message: `无效网段：${entry}（应为 CIDR 或 IP 前缀）` };
  }

  await upsertSystemSetting(LAN_SUBNETS_KEY, JSON.stringify(cleaned));
  revalidatePath('/');
  return { success: true, subnets: cleaned };
}
