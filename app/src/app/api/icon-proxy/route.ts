import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../lib/auth';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/svg+xml',
  'image/bmp',
  'image/avif',
]);

// GET /api/icon-proxy?u=<url> —— 同源图标代理
// 解决 HTTPS 页面加载 http:// 远程图标时的 Mixed Content 拦截。
export async function GET(req: NextRequest) {
  const user = await verifyRequestAuth(req);
  if (!user) {
    return NextResponse.json({ code: 1003, message: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const target = searchParams.get('u');
  if (!target) {
    return NextResponse.json({ code: 1001, message: '缺少 url 参数' }, { status: 400 });
  }

  let urlObj: URL;
  try {
    urlObj = new URL(target);
  } catch (e) {
    return NextResponse.json({ code: 1001, message: '无效地址' }, { status: 400 });
  }

  // 仅允许 http/https，防止 file:// 等协议
  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
    return NextResponse.json({ code: 1001, message: '仅支持 http(s) 地址' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: urlObj.origin,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return new NextResponse('Not Found', { status: 404 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!ALLOWED_TYPES.has(contentType.split(';')[0].trim())) {
      return new NextResponse('Not an image', { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return new NextResponse('Too Large', { status: 413 });
    }

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return new NextResponse('Proxy Error', { status: 502 });
  }
}
