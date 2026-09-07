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

function sniffImageType(buf: ArrayBuffer): string | null {
  if (buf.byteLength < 4) return null;
  const v = new Uint8Array(buf);
  if (v[0] === 0x00 && v[1] === 0x00 && v[2] === 0x01 && v[3] === 0x00) return 'image/x-icon';
  if (v[0] === 0x89 && v[1] === 0x50 && v[2] === 0x4e && v[3] === 0x47) return 'image/png';
  if (v[0] === 0xff && v[1] === 0xd8 && v[2] === 0xff) return 'image/jpeg';
  if (v[0] === 0x47 && v[1] === 0x49 && v[2] === 0x46 && v[3] === 0x38) return 'image/gif';
  if (v[0] === 0x52 && v[1] === 0x49 && v[2] === 0x46 && v[3] === 0x46) {
    if (v[8] === 0x57 && v[9] === 0x45 && v[10] === 0x42 && v[11] === 0x50) return 'image/webp';
  }
  if (v[0] === 0x42 && v[1] === 0x4d) return 'image/bmp';
  if (v[4] === 0x66 && v[5] === 0x74 && v[6] === 0x79 && v[7] === 0x70) {
    const brand = String.fromCharCode(v[8] || 0, v[9] || 0, v[10] || 0, v[11] || 0);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  const head = new TextDecoder().decode(v.slice(0, 512)).toLowerCase();
  if (head.trimStart().startsWith('<') && (head.includes('<svg') || head.includes('<?xml'))) {
    return 'image/svg+xml';
  }
  return null;
}

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

    const headerType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 2 * 1024 * 1024) {
      return new NextResponse('Too Large', { status: 413 });
    }

    const contentType = ALLOWED_TYPES.has(headerType) ? headerType : sniffImageType(buffer);
    if (!contentType) {
      return new NextResponse('Not an image', { status: 415 });
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
