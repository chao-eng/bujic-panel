import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { getLanSubnets } from '../../../../lib/settings';
import { getClientIpFromHeaders, getHostFromHeaders, isHostIpInSubnets, isIpInSubnets } from '../../../../lib/net';

// GET /api/openness/lan-check —— 返回当前来源是否为内网（受保护，登录后调用）
// 判定规则（二者任一命中即内网）：
//   1. 真实来源 IP 落在已配置网段内（host 网络 / 反代注入 XFF 时可靠）
//   2. 访问入口 Host 是内网 IP 且落在网段内（Docker NAT 吞掉来源 IP 时兜底）
export async function GET(req: NextRequest) {
  const user = await verifyRequestAuth(req);
  if (!user) {
    return NextResponse.json({ code: 1003, message: '未授权' }, { status: 401 });
  }

  try {
    const subnets = await getLanSubnets();
    if (subnets.length === 0) {
      return NextResponse.json({ code: 0, data: { isLan: false, enabled: false } });
    }

    const clientIp = getClientIpFromHeaders(req.headers);
    const host = getHostFromHeaders(req.headers);
    const isLan =
      isIpInSubnets(clientIp, subnets) || isHostIpInSubnets(host, subnets);

    return NextResponse.json({
      code: 0,
      data: { isLan, enabled: true, ip: clientIp, host },
    });
  } catch (e) {
    return NextResponse.json({ code: 0, data: { isLan: false, enabled: false } });
  }
}
