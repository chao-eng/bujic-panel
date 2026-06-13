import { WidgetProvider } from './types';

export class JellyfinProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const { apiKey } = settings;
    if (!apiKey) {
      throw new Error('未配置 Jellyfin API Key');
    }

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    // 常用身份验证头
    const headers = {
      'Content-Type': 'application/json',
      'X-Emby-Token': apiKey,
      'X-MediaBrowser-Token': apiKey,
      'Authorization': `MediaBrowser Token="${apiKey}"`,
    };

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    try {
      // 电影总数、系列（节目）总数、剧集总数、当前播放会话 并发请求
      const [moviesRes, seriesRes, episodesRes, sessionsRes] = await Promise.all([
        fetch(`${baseUrl}/Items?Recursive=true&IncludeItemTypes=Movie&Limit=0`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        }),
        fetch(`${baseUrl}/Items?Recursive=true&IncludeItemTypes=Series&Limit=0`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        }),
        fetch(`${baseUrl}/Items?Recursive=true&IncludeItemTypes=Episode&Limit=0`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        }),
        fetch(`${baseUrl}/Sessions`, {
          headers,
          signal: controller.signal,
          cache: 'no-store',
        }),
      ]);

      if (!moviesRes.ok || !seriesRes.ok || !episodesRes.ok || !sessionsRes.ok) {
        throw new Error(
          `请求失败 (HTTP ${moviesRes.status}/${seriesRes.status}/${episodesRes.status}/${sessionsRes.status})`
        );
      }

      const [moviesData, seriesData, episodesData, sessionsData] = await Promise.all([
        moviesRes.json(),
        seriesRes.json(),
        episodesRes.json(),
        sessionsRes.json(),
      ]);

      // 提取有正在播放内容的会话
      const activeSessions = (sessionsData || []).filter(
        (session: any) => session && session.NowPlayingItem
      );

      const nowPlaying = activeSessions.map((session: any) => ({
        id: session.Id,
        userName: session.UserName || '未知用户',
        client: session.Client || '未知客户端',
        deviceName: session.DeviceName || '未知设备',
        itemName: session.NowPlayingItem.Name || '未知内容',
        itemType: session.NowPlayingItem.Type,
        seriesName: session.NowPlayingItem.SeriesName || null,
        isPaused: session.PlayState?.IsPaused ?? false,
      }));

      return {
        moviesCount: moviesData.TotalRecordCount ?? 0,
        seriesCount: seriesData.TotalRecordCount ?? 0,
        episodesCount: episodesData.TotalRecordCount ?? 0,
        nowPlaying,
      };
    } catch (e: any) {
      console.error('[Jellyfin Provider] Error fetching stats:', e);
      if (e.name === 'AbortError') {
        throw new Error('Jellyfin 数据请求超时');
      }
      throw new Error(`连接 Jellyfin 失败: ${e.message}`);
    } finally {
      clearTimeout(id);
    }
  }
}
