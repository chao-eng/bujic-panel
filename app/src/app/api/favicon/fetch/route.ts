import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { getPageTitle, findFaviconUrl, downloadFavicon } from '../../../../lib/favicon';

export async function POST(req: NextRequest) {
  // 1. 验证登录状态
  const user = await verifyRequestAuth(req);
  if (!user) {
    return NextResponse.json({ code: 1003, message: '未授权访问' }, { status: 401 });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ code: 1001, message: '链接地址不能为空' }, { status: 400 });
    }

    const urlObj = new URL(url);

    // 获取网页 HTML 以便提取标题与 Favicon
    let html = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Sun-Panel)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        html = new TextDecoder('utf-8').decode(Buffer.from(arrayBuffer).subarray(0, 512 * 1024));
      }
    } catch {
      // 捕获超时或网络连接失败，交给后边直接使用 url 协议头抓取 title 兜底
    }

    // 抓取 Title
    const pageTitle = await getPageTitle(url, html);

    // 抓取 Icon URL 并下载
    const iconUrl = findFaviconUrl(html, url);
    let localIconSrc = '';
    if (iconUrl) {
      const downloaded = await downloadFavicon(iconUrl, urlObj.hostname, user.id);
      if (downloaded) {
        localIconSrc = downloaded;
      }
    }

    // 如果两个提取均告失败，则抛错
    if (!pageTitle && !localIconSrc) {
      return NextResponse.json({ code: 1005, message: '无法解析目标网页' }, { status: 400 });
    }

    return NextResponse.json({
      code: 0,
      data: {
        pageTitle: pageTitle || urlObj.hostname,
        iconUrl: localIconSrc,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '内部错误';
    return NextResponse.json({ code: 500, message }, { status: 500 });
  }
}
