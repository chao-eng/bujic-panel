import { WidgetProvider } from './types';

export class UmamiProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const { username, password, domain } = settings;
    if (!username || !password || !domain) {
      throw new Error('未配置完整的凭证 (Username, Password 或 Domain)');
    }

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000); // 适当放宽至 8s

    try {
      // 1. 进行身份认证获取 token
      const authUrl = `${baseUrl}/api/auth/login`;
      let authRes;
      try {
        authRes = await fetch(authUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: controller.signal,
          cache: 'no-store',
        });
      } catch (e: any) {
        console.error('[Umami Provider] Auth connection error:', e);
        throw new Error(`连接 Umami 认证失败: ${e.message}`);
      }

      if (!authRes.ok) {
        throw new Error(`认证请求失败 (HTTP ${authRes.status})`);
      }

      const authData = await authRes.json();
      const token = authData.token;
      if (!token) {
        throw new Error('登录成功但未返回 Token');
      }

      // 2. 获取网站列表以匹配 domain 并查找 websiteId
      const websitesUrl = `${baseUrl}/api/websites`;
      const websitesRes = await fetch(websitesUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!websitesRes.ok) {
        throw new Error(`拉取网站列表失败 (HTTP ${websitesRes.status})`);
      }

      const websitesData = await websitesRes.json();
      const sitesList = Array.isArray(websitesData) ? websitesData : (websitesData.data || []);

      const targetSite = sitesList.find((site: any) => {
        if (!site || !site.domain) return false;
        return site.domain.toLowerCase().trim() === domain.toLowerCase().trim();
      });

      if (!targetSite) {
        throw new Error(`在 Umami 中未找到域名为 "${domain}" 的网站`);
      }

      const websiteId = targetSite.id;

      // 3. 拉取最近 24 小时的统计指标
      const endAt = Date.now();
      const startAt = endAt - 24 * 60 * 60 * 1000;

      const statsUrl = `${baseUrl}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`;
      const statsRes = await fetch(statsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!statsRes.ok) {
        throw new Error(`拉取统计指标失败 (HTTP ${statsRes.status})`);
      }

      const statsData = await statsRes.json();

      const parseMetric = (val: any): number => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'object') {
          if (typeof val.value === 'number') return val.value;
          if (typeof val.value === 'string') {
            const p = parseInt(val.value, 10);
            return isNaN(p) ? 0 : p;
          }
        }
        if (typeof val === 'string') {
          const p = parseInt(val, 10);
          return isNaN(p) ? 0 : p;
        }
        return 0;
      };

      const visitors = parseMetric(statsData.visitors) || parseMetric(statsData.uniques);
      const visits = parseMetric(statsData.visits) || parseMetric(statsData.uniques);
      const pageviews = parseMetric(statsData.pageviews);

      return {
        visitors,
        visits,
        pageviews,
      };
    } catch (e: any) {
      console.error('[Umami Provider] Error fetching stats:', e);
      if (e.name === 'AbortError') {
        throw new Error('Umami 请求超时');
      }
      throw new Error(e.message || '连接 Umami 失败');
    } finally {
      clearTimeout(id);
    }
  }
}
