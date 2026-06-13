import { WidgetProvider } from './types';

export class BeszelProvider implements WidgetProvider {
  async fetchData(url: string, settings: any): Promise<any> {
    const { email, password, systemName } = settings;
    if (!email || !password || !systemName) {
      throw new Error('未配置完整的凭证 (Email, Password 或 System Name)');
    }

    // 规范化 URL，去除末尾斜杠
    const baseUrl = url.replace(/\/+$/, '');

    // 1. 进行 PocketBase 普通用户身份验证
    const authUrl = `${baseUrl}/api/collections/users/auth-with-password`;
    
    // 设置 5s 超时以保证总响应时间
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    let authRes;
    try {
      authRes = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password }),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (e: any) {
      console.error('[Beszel Provider] Auth Connection Error:', e);
      if (e.name === 'AbortError') {
        throw new Error('Beszel 认证请求超时');
      }
      throw new Error(`连接 Beszel 失败: ${e.message}`);
    } finally {
      clearTimeout(id);
    }

    if (!authRes.ok) {
      const errorText = await authRes.text();
      let errMsg = '用户名或密码错误';
      try {
        const errJson = JSON.parse(errorText);
        errMsg = errJson.message || errMsg;
      } catch (err) {}
      throw new Error(`Beszel 认证失败: ${errMsg}`);
    }

    const authData = await authRes.json();
    const token = authData.token;

    // 2. 根据系统名称获取系统记录
    const filter = `name='${systemName}'`;
    const systemsUrl = `${baseUrl}/api/collections/systems/records?filter=${encodeURIComponent(filter)}`;

    const controller2 = new AbortController();
    const id2 = setTimeout(() => controller2.abort(), 5000);

    let systemsRes;
    try {
      systemsRes = await fetch(systemsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        },
        signal: controller2.signal,
        cache: 'no-store',
      });
    } catch (e: any) {
      console.error('[Beszel Provider] Fetch Stats Connection Error:', e);
      if (e.name === 'AbortError') {
        throw new Error('Beszel 数据请求超时');
      }
      throw new Error(`请求 Beszel 数据失败: ${e.message}`);
    } finally {
      clearTimeout(id2);
    }

    if (!systemsRes.ok) {
      const errorText = await systemsRes.text();
      let errMsg = '拉取记录失败';
      try {
        const errJson = JSON.parse(errorText);
        errMsg = errJson.message || errMsg;
      } catch (err) {}
      throw new Error(`Beszel 获取数据失败: ${errMsg}`);
    }

    const systemsData = await systemsRes.json();
    const system = systemsData.items?.[0];

    if (!system) {
      throw new Error(`在 Beszel 中未找到名称为 "${systemName}" 的系统`);
    }

    // 3. 返回清洗整理后的状态与指标数据
    return {
      status: system.status, // "up" | "down"
      cpu: system.info?.cpu ?? 0,
      memory: system.info?.mp ?? 0,
      disk: system.info?.dp ?? 0,
      uptime: system.info?.up ?? 0,
      temperature: system.info?.t,
    };
  }
}
