// IPv4 前缀或 CIDR 的网段匹配工具
export function normalizeIpv4(ip: string): string | null {
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p < 0 || p > 255)) return null;
  return parts.join('.');
}

// 允许 1~4 段的 IPv4 前缀归一化（如 192.168.31 / 192.168.31.）
export function normalizeIpv4Prefix(ip: string): string | null {
  const m = ip.trim().replace(/\.+$/, '').match(/^(\d{1,3})(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const segs = m.slice(1).filter((s) => s !== undefined).map(Number);
  if (segs.length === 0 || segs.length > 4) return null;
  if (segs.some((p) => p < 0 || p > 255)) return null;
  return segs.join('.');
}

export function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

/**
 * 判断 ip 是否命中任一网段条目。
 * 支持两种写法：CIDR（192.168.31.0/24）与 IP 前缀（192.168.31. / 192.168.31）
 */
export function isIpInSubnets(ip: string | null | undefined, subnets: string[]): boolean {
  const ipInt = ipv4ToInt(normalizeIpv4(ip || '') || '');
  if (!ip || !ipInt) return false;

  for (const raw of subnets || []) {
    const entry = raw.trim();
    if (!entry) continue;

    // CIDR 形式
    const cidr = entry.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (cidr) {
      const base = ipv4ToInt(normalizeIpv4(cidr[1]) || '');
      const bits = Number(cidr[2]);
      if (!base || bits < 0 || bits > 32) continue;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      if ((ipInt & mask) === (base & mask)) return true;
      continue;
    }

    // 前缀写法：可能以 "." 结尾（如 192.168.31.）或纯前缀（192.168.31）
    const prefix = normalizeIpv4Prefix(entry);
    if (prefix) {
      const ipStr = normalizeIpv4(ip) || '';
      if (ipStr.startsWith(prefix + '.') || ipStr === prefix) return true;
      continue;
    }
  }

  return false;
}

/** 从请求头推导客户端 IPv4 地址 */
export function getClientIpFromHeaders(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first && first !== 'unknown') {
      const stripped = first.replace(/^::ffff:/, '').split('%')[0];
      const m = stripped.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (m) return m[1];
    }
  }
  const realIp = headers.get('x-real-ip');
  if (realIp) {
    const m = realIp.replace(/^::ffff:/, '').match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (m) return m[1];
  }
  return '';
}

/** 提取 host 字符串的主机名：`[::1]:3700` → `::1`；`10.0.8.2:3700` / `home.cc` → 去端口部分 */
function stripHostPort(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    h = end === -1 ? h.slice(1) : h.slice(1, end);
  } else {
    h = h.split(':')[0];
  }
  return h;
}

/** 从 Host 头提取主机名（剥端口） */
export function getHostFromHeaders(headers: Headers): string {
  return stripHostPort(headers.get('host') || '');
}

/**
 * 判断访问入口 Host 是否为网段内 IP（反代 / Docker NAT 场景兜底）：
 * 仅当 Host 是内网 IP 且落在已配置网段时返回 true，域名/主机名一律 false。
 */
export function isHostIpInSubnets(host: string | null | undefined, subnets: string[]): boolean {
  if (!host) return false;
  const name = stripHostPort(host);
  if (!name) return false;
  const norm = normalizeIpv4(name);
  if (!norm) return false;
  return isIpInSubnets(norm, subnets);
}
