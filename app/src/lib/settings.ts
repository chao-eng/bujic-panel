import { db } from './db';

// 系统级设置键
export const SITE_BRAND_KEY = 'site_brand';
export const LAN_SUBNETS_KEY = 'lan_subnets';

export async function getSystemSettingValue(name: string): Promise<string | null> {
  try {
    const row = await db.systemSetting.findUnique({ where: { configName: name } });
    return row?.configValue ?? null;
  } catch (e) {
    return null;
  }
}

export async function upsertSystemSetting(name: string, value: string) {
  const existing = await db.systemSetting.findUnique({ where: { configName: name } });
  if (existing) {
    return db.systemSetting.update({
      where: { configName: name },
      data: { configValue: value },
    });
  }
  return db.systemSetting.create({
    data: { configName: name, configValue: value },
  });
}

export interface SiteBrand {
  name: string;
  icon: string;
}

export const DEFAULT_BRAND: SiteBrand = { name: '', icon: '' };

export async function getSiteBrand(): Promise<SiteBrand> {
  const raw = await getSystemSettingValue(SITE_BRAND_KEY);
  if (!raw) return { ...DEFAULT_BRAND };
  try {
    const parsed = JSON.parse(raw);
    return {
      name: parsed?.name || '',
      icon: parsed?.icon || '',
    };
  } catch (e) {
    return { ...DEFAULT_BRAND };
  }
}

// 内网网段数组（空 = 未启用内网判定）
export async function getLanSubnets(): Promise<string[]> {
  const raw = await getSystemSettingValue(LAN_SUBNETS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch (e) {
    return [];
  }
}
