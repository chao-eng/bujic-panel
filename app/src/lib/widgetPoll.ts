// 监控组件刷新间隔约定（毫秒）
// 内置默认：近实时数值类高频、纯计数类低频；用户可在书签的 widgetSettings.pollMs 里覆盖。

export const DEFAULT_POLL_MS: Record<string, number> = {
  beszel: 5000,
  qbittorrent: 5000,
  'uptime-kuma': 5000,
  jellyfin: 30000,
  umami: 30000,
  'wg-easy': 30000,
};

export const DEFAULT_POLL_MS_FALLBACK = 10000;
export const MIN_POLL_MS = 2000;
export const MAX_POLL_MS = 300000;

/** 解析该组件最终轮询间隔：优先 settings.pollMs，其次按类型默认值 */
export function resolvePollMs(widgetType: string | undefined, settingsJson?: string | null): number {
  const def = (widgetType && DEFAULT_POLL_MS[widgetType]) || DEFAULT_POLL_MS_FALLBACK;
  if (!settingsJson) return def;
  try {
    const s = JSON.parse(settingsJson);
    const ms = Number(s?.pollMs);
    if (Number.isFinite(ms) && ms >= MIN_POLL_MS) return Math.min(Math.round(ms), MAX_POLL_MS);
  } catch {
    // 解析失败回退默认
  }
  return def;
}

/** 把用户输入（秒）规整为合法的毫秒值；非法时返回 null（表示采用默认） */
export function normalizePollMsSec(input: number): number | null {
  if (!Number.isFinite(input) || input <= 0) return null;
  const ms = Math.round(input * 1000);
  return Math.min(Math.max(ms, MIN_POLL_MS), MAX_POLL_MS);
}
