import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { getLanSubnets } from '../../../../lib/settings';
import { getClientIpFromHeaders, isIpInSubnets } from '../../../../lib/net';

// GET /api/openness/lan-check —— 返回当前来源是否为内网（受保护，登录后调用）
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
    const isLan = isIpInSubnets(clientIp, subnets);

    return NextResponse.json({
      code: 0,
      data: { isLan, enabled: true, ip: clientIp },
    });
  } catch (e) {
    return NextResponse.json({ code: 0, data: { isLan: false, enabled: false } });
  }
}
