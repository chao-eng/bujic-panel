import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../../lib/auth';
import { db } from '../../../../lib/db';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

async function getPageTitle(targetUrl: string, rawHtml?: string): Promise<string> {
  try {
    const urlObj = new URL(targetUrl);
    const host = urlObj.hostname.toLowerCase();

    // 1. 今日头条 PC 端特殊抓取（移动端接口）
    if (host.includes('toutiao.com')) {
      const match = urlObj.pathname.match(/\/article\/(\d+)/) || urlObj.pathname.match(/\/a(\d+)/);
      if (match) {
        const articleId = match[1];
        const api = `https://m.toutiao.com/i${articleId}/info/`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(api, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.title) {
            return json.data.title.trim();
          }
        }
      }
    }

    let html = rawHtml || '';
    if (!html) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Sun-Panel)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) return '';

      // 读取前 512KB 内容
      const reader = response.body?.getReader();
      if (!reader) return '';

      const decoder = new TextDecoder('utf-8');
      const maxSize = 512 * 1024;
      let bytesRead = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;

        html += decoder.decode(value, { stream: true });
        bytesRead += value.byteLength;
        if (bytesRead >= maxSize) {
          reader.cancel();
          break;
        }
      }
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      title = title.replace(/\s+/g, ' ');
      if (title.length > 200) {
        title = title.substring(0, 200);
      }
      return title;
    }
  } catch (e) {
    // 容错
  }
  return '';
}

function findFaviconUrl(html: string, targetUrl: string): string {
  try {
    const urlObj = new URL(targetUrl);

    // 正则匹配包含 link rel="icon" 的节点
    const linkRegex = /<link[^>]*?rel=["'](?:shortcut\s+)?icon["'][^>]*?href=["']([^"']+)["']/i;
    let match = html.match(linkRegex);
    if (!match) {
      // 逆序匹配 rel 与 href
      const linkRegexReverse = /<link[^>]*?href=["']([^"']+)["'][^>]*?rel=["'](?:shortcut\s+)?icon["']/i;
      match = html.match(linkRegexReverse);
    }

    let iconUrl = '';
    if (match && match[1]) {
      iconUrl = match[1];
    } else {
      iconUrl = '/favicon.ico';
    }

    // 格式化为完整 URL
    if (iconUrl.startsWith('//')) {
      iconUrl = urlObj.protocol + iconUrl;
    } else if (iconUrl.startsWith('/')) {
      iconUrl = urlObj.origin + iconUrl;
    } else if (!iconUrl.startsWith('http://') && !iconUrl.startsWith('https://')) {
      const basePath = urlObj.origin + urlObj.pathname;
      const baseDir = basePath.substring(0, basePath.lastIndexOf('/') + 1);
      iconUrl = baseDir + iconUrl;
    }

    // 去除 Query 字符参数防止图片格式异常
    if (iconUrl.includes('?')) {
      iconUrl = iconUrl.split('?')[0];
    }

    return iconUrl;
  } catch (e) {
    return '';
  }
}

async function downloadFavicon(iconUrl: string, host: string, userId: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(iconUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 1024 * 1024) return null; // 限制最多 1MB

    const nodeBuffer = Buffer.from(buffer);

    // 规划保存路径: app/public/uploads/year/month/day
    const now = new Date();
    const relativeDir = `uploads/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    
    let uploadDir: string;
    if (process.env.DATA_DIR) {
      uploadDir = path.join(process.env.DATA_DIR, relativeDir);
    } else if (process.env.UPLOAD_DIR) {
      const subDir = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
      uploadDir = path.join(process.env.UPLOAD_DIR, subDir);
    } else {
      uploadDir = path.join(process.cwd(), 'public', relativeDir);
    }

    fs.mkdirSync(uploadDir, { recursive: true });

    // 文件名：内容 MD5 + 扩展名
    const hash = crypto.createHash('md5').update(nodeBuffer).digest('hex');
    let ext = path.extname(new URL(iconUrl).pathname);
    if (!ext || ext.length > 5) ext = '.ico'; // 兜底格式为 ico
    const filename = `${hash}${ext}`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, nodeBuffer);

    // 物理文件相对路径
    const relativeSrc = `/${relativeDir}/${filename}`;

    // 向 File 实体数据库中注册该上传记录
    await db.file.create({
      data: {
        src: relativeSrc,
        userId,
        fileName: host,
        ext,
        fileType: 'icon',
        method: 1,
      },
    });

    return relativeSrc;
  } catch (e) {
    return null;
  }
}

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
    } catch (e) {
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
  } catch (e: any) {
    return NextResponse.json({ code: 500, message: e.message || '内部错误' }, { status: 500 });
  }
}
