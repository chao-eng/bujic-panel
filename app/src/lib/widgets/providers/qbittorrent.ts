import { WidgetProvider } from './types';

export class QbittorrentProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const { username, password } = settings;
    if (!username || !password) {
      throw new Error('未配置用户名或密码');
    }

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    // 1. 进行 qBittorrent Web UI 登录获取 SID Cookie
    const loginUrl = `${baseUrl}/api/v2/auth/login`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000);

    let loginRes;
    try {
      loginRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (e: any) {
      console.error('[qBittorrent Provider] Login Connection Error:', e);
      if (e.name === 'AbortError') {
        throw new Error('qBittorrent 登录超时');
      }
      throw new Error(`连接 qBittorrent 失败: ${e.message}`);
    } finally {
      clearTimeout(id);
    }

    if (!loginRes.ok) {
      throw new Error(`登录 qBittorrent 失败: 状态码 ${loginRes.status}`);
    }

    const loginText = await loginRes.text();
    if (loginText === 'Fails.') {
      throw new Error('qBittorrent 登录认证失败，用户名或密码错误');
    }

    // 从 Set-Cookie 头中提取 SID
    const setCookie = loginRes.headers.get('set-cookie');
    let sid = '';
    if (setCookie) {
      const match = setCookie.match(/SID=([^;]+)/);
      if (match) sid = match[1];
    }

    if (!sid) {
      throw new Error('无法从响应中获取 SID 会话标识');
    }

    // 2. 并发获取传输信息 (transfer info) 和种子列表 (torrents info)
    const statsUrl = `${baseUrl}/api/v2/transfer/info`;
    const torrentsUrl = `${baseUrl}/api/v2/torrents/info`;
    
    const controller2 = new AbortController();
    const id2 = setTimeout(() => controller2.abort(), 5000);

    let statsRes, torrentsRes;
    try {
      [statsRes, torrentsRes] = await Promise.all([
        fetch(statsUrl, {
          method: 'GET',
          headers: { 'Cookie': `SID=${sid}` },
          signal: controller2.signal,
          cache: 'no-store',
        }),
        fetch(torrentsUrl, {
          method: 'GET',
          headers: { 'Cookie': `SID=${sid}` },
          signal: controller2.signal,
          cache: 'no-store',
        })
      ]);
    } catch (e: any) {
      console.error('[qBittorrent Provider] Concurrency Stats Connection Error:', e);
      if (e.name === 'AbortError') {
        throw new Error('qBittorrent 数据拉取超时');
      }
      throw new Error(`连接 qBittorrent 拉取数据失败: ${e.message}`);
    } finally {
      clearTimeout(id2);
    }

    if (!statsRes.ok || !torrentsRes.ok) {
      throw new Error(`拉取 qBittorrent 数据失败: 状态码 ${statsRes.status} / ${torrentsRes.status}`);
    }

    const transferData = await statsRes.json();
    const torrentsList = await torrentsRes.json();

    // 统计下载中数量和已完成数量
    let downloadingCount = 0;
    let completedCount = 0;

    const downloadingStates = ['downloading', 'stalledDL', 'checkingDL', 'forcedDL', 'metaDL'];

    if (Array.isArray(torrentsList)) {
      torrentsList.forEach((t: any) => {
        if (downloadingStates.includes(t.state)) {
          downloadingCount++;
        }
        if (t.progress >= 1.0) {
          completedCount++;
        }
      });
    }

    // 3. 规范化返回数据
    return {
      dlSpeed: transferData.dl_info_speed ?? 0, // 字节每秒
      upSpeed: transferData.up_info_speed ?? 0, // 字节每秒
      dlData: transferData.dl_info_data ?? 0,   // 总下载字节数
      upData: transferData.up_info_data ?? 0,   // 总上传字节数
      status: transferData.connection_status ?? 'connected', // online, firewalled, offline
      downloadingCount,
      completedCount,
    };
  }
}
