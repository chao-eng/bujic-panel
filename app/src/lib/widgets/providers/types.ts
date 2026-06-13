export interface WidgetProvider {
  /**
   * 抓取该组件的实时数据
   * @param url 组件后台的服务基础 URL
   * @param settings 解析后的 JSON 配置对象 (包含账号密码等)
   */
  fetchData(url: string, settings: any): Promise<any>;
}
