/**
 * 图标地址安全化：把 http:// 远程图标改写为同源 /api/icon-proxy 代理地址，
 * 避免 HTTPS 页面加载 http 图片触发 Mixed Content 被浏览器拦截。
 * - 相对路径（/uploads/...）、data: 与 https: 保持原样（https 无混合内容问题）
 * - lucide: 等图标名也保持原样（由 DynamicIcon 处理）
 */
export function safeIconSrc(src: string): string {
  if (!src) return src;
  const s = src.trim();
  if (s.startsWith('http://')) {
    return `/api/icon-proxy?u=${encodeURIComponent(s)}`;
  }
  return s;
}
