/** 组件配置对象（数据库 widgetSettings 字段 JSON 解析后的结果） */
export type WidgetSettings = Record<string, unknown>;

/** 组件实时数据（各 provider 返回自有结构，由消费方按组件类型断言具体结构） */
export type WidgetData = Record<string, unknown>;

/** 单个组件实时数据的拉取结果 */
export type WidgetFetchResult =
  | { success: true; data: WidgetData }
  | { success: false; error: string };

/** 从未知异常中安全提取可读的错误信息 */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 判断异常是否为请求中止（超时） */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

export interface WidgetProvider {
  /**
   * 抓取该组件的实时数据
   * @param url 组件后台的服务基础 URL
   * @param settings 解析后的 JSON 配置对象 (包含账号密码等)
   */
  fetchData(url: string, settings: WidgetSettings): Promise<WidgetData>;
}
