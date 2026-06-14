import { WidgetProvider } from './types';

export class UptimeKumaProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const slug = (settings.slug || 'default').trim();

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(`${baseUrl}/api/status-page/heartbeat/${slug}`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`获取 Uptime Kuma 数据失败 (HTTP ${response.status})`);
      }

      const data = await response.json();
      const heartbeatList = data.heartbeatList;

      if (!heartbeatList || typeof heartbeatList !== 'object') {
        throw new Error('未获取到有效心跳列表，请确认 Uptime Kuma 状态页 Slug 是否正确，并且状态页为公开状态');
      }

      const monitorIds = Object.keys(heartbeatList);
      const totalMonitors = monitorIds.length;
      let upMonitors = 0;
      let downMonitors = 0;
      let totalPing = 0;
      let pingCount = 0;

      for (const mId of monitorIds) {
        const heartbeats = heartbeatList[mId];
        if (Array.isArray(heartbeats) && heartbeats.length > 0) {
          // 最后一项是最新一条心跳记录
          const latest = heartbeats[heartbeats.length - 1];
          if (latest) {
            if (latest.status === 1) {
              upMonitors++;
            } else if (latest.status === 0) {
              downMonitors++;
            }

            if (latest.ping && typeof latest.ping === 'number' && latest.ping > 0) {
              totalPing += latest.ping;
              pingCount++;
            }
          }
        }
      }

      const avgPing = pingCount > 0 ? Math.round(totalPing / pingCount) : 0;

      return {
        totalMonitors,
        upMonitors,
        downMonitors,
        avgPing,
      };
    } catch (e: any) {
      console.error('[Uptime Kuma Provider] Error fetching stats:', e);
      if (e.name === 'AbortError') {
        throw new Error('Uptime Kuma 请求超时');
      }
      throw new Error(e.message || '连接 Uptime Kuma 失败');
    } finally {
      clearTimeout(id);
    }
  }
}
