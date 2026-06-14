import { WidgetProvider } from './types';

export class WgEasyProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const { password } = settings;

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    try {
      let cookieHeader = '';

      // 1. 尝试使用密码登录获取 Session Cookie
      if (password) {
        try {
          const sessionRes = await fetch(`${baseUrl}/api/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            signal: controller.signal,
            cache: 'no-store',
          });

          if (sessionRes.ok) {
            const setCookie = sessionRes.headers.get('set-cookie');
            if (setCookie) {
              cookieHeader = setCookie;
            }
          }
        } catch (e) {
          console.warn('[Wg-Easy Provider] Session authentication failed, falling back to Authorization header:', e);
        }
      }

      // 2. 配置请求头
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      } else if (password) {
        // wg-easy 新版 (Nuxt) 使用以 admin 为用户名的标准 Basic Auth 鉴权
        const credentials = Buffer.from(`admin:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      // 3. 拉取客户端列表数据 (采用多端点回退机制)
      const paths = ['/api/client', '/api/wireguard/client', '/api/clients'];
      let clients: any = null;
      let lastError: any = null;

      for (const path of paths) {
        try {
          const clientsRes = await fetch(`${baseUrl}${path}`, {
            method: 'GET',
            headers,
            signal: controller.signal,
            cache: 'no-store',
          });

          if (clientsRes.ok) {
            const data = await clientsRes.json();
            if (Array.isArray(data)) {
              clients = data;
              break;
            }
          } else {
            lastError = new Error(`请求 ${path} 失败 (HTTP ${clientsRes.status})`);
          }
        } catch (err: any) {
          lastError = err;
        }
      }

      if (!clients) {
        throw lastError || new Error('所有客户端列表接口尝试均失败');
      }

      // 4. 解析客户端指标
      const totalClients = clients.length;
      const enabledClients = clients.filter((c: any) => c.enabled).length;

      // 活跃客户端：已启用且在最近 2 分钟（120秒）内进行过握手
      const now = Date.now();
      const connectedClients = clients.filter((c: any) => {
        if (!c.enabled) return false;
        const handshake = c.latestHandshakeAt || c.lastHandshakeAt;
        if (!handshake) return false;
        const lastHandshakeTime = new Date(handshake).getTime();
        return now - lastHandshakeTime < 120 * 1000;
      }).length;

      // 流量统计（从服务器视角：Rx为接收客户端发送来的数据即上传，Tx为发送给客户端的数据即下载）
      const totalRx = clients.reduce((acc: number, c: any) => acc + (Number(c.transferRx) || 0), 0);
      const totalTx = clients.reduce((acc: number, c: any) => acc + (Number(c.transferTx) || 0), 0);

      return {
        totalClients,
        enabledClients,
        connectedClients,
        totalRx,
        totalTx,
      };
    } catch (e: any) {
      console.error('[Wg-Easy Provider] Error fetching stats:', e);
      if (e.name === 'AbortError') {
        throw new Error('Wg-Easy 连接超时');
      }
      throw new Error(e.message || '连接 Wg-Easy 失败');
    } finally {
      clearTimeout(id);
    }
  }
}
