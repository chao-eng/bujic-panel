/**
 * 书签点击跳转 URL 解析：根据内外网判定决定目标地址。
 * - url: 外网/默认地址（完整）
 * - lanUrl: 内网地址（可选）。支持主机/完整 URL 两种填法
 * - isLan: 当前是否命中内网
 */
export function resolveOpenUrl(url: string, lanUrl: string | null | undefined, isLan: boolean): string {
  const target = url.trim();
  const lan = (lanUrl || '').trim();
  if (!target) return url;

  if (isLan && lan) {
    const base = normalizeUrlBase(target);
    const lanBase = normalizeUrlBase(lan);
    if (lanBase) {
      // 若 lan 自带 path，则整体以 lan 为准（信任用户完整内网地址）
      if (lan.includes('/') && !lan.endsWith('/')) {
        return ensureScheme(lan);
      }
      // 仅 host[:port]：拼上 url 的 path/search
      try {
        const baseUrl = new URL(base);
        const lanUrlObj = new URL(lanBase);
        lanUrlObj.pathname = baseUrl.pathname;
        lanUrlObj.search = baseUrl.search;
        return lanUrlObj.toString();
      } catch (e) {
        return ensureScheme(lan);
      }
    }
  }
  return baseTarget(target);
}

function ensureScheme(input: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  return `http://${input}`;
}

function normalizeUrlBase(input: string): string {
  const withScheme = ensureScheme(input);
  try {
    const u = new URL(withScheme);
    return u.toString();
  } catch (e) {
    return '';
  }
}

function baseTarget(input: string): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) return input;
  // 裸 host（如 nas.local:8096 或 192.168.x.x:port）补 scheme，其余原样
  if (/^[\w.-]+(:\d+)?(\/.*)?$/.test(input)) {
    return `http://${input}`;
  }
  return input;
}
