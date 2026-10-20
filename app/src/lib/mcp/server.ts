import { revalidatePath } from 'next/cache';
import { isMcpError } from './errors';
import { mcpTools, mcpToolMap, type ToolContext } from './tools';

// MCP 协议层：JSON-RPC 2.0 分发（tools 能力）
// 传输层由 /api/mcp Route Handler 负责

export const MCP_PROTOCOL_VERSION = '2025-06-18';
export const MCP_SERVER_INFO = { name: 'bujic-panel', version: '1.0.0' };

type JsonRpcId = string | number | null;

interface JsonRpcRequestMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

const SERVER_INSTRUCTIONS = [
  'Bujic Panel 面板操作工具集。可管理当前用户自己的导航空间（Tab）、分组、书签，并感知服务监控组件的实时状态。',
  '建议流程：先调用 panel_get_overview 了解结构，再用 panel_search_bookmarks 定位目标，最后执行增删改。',
  '删除类工具均为破坏性操作，必须先获得用户明确同意后再传 confirm=true。',
].join('\n');

function ok(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: '2.0', id, result };
}

function err(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcFailure {
  return { jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } };
}

// 工具执行错误按 MCP 约定用 result + isError=true 返回，便于 Agent 自纠
function toolError(
  id: JsonRpcId,
  code: string,
  message: string,
  details?: Record<string, unknown>
): JsonRpcSuccess {
  const text = `[${code}] ${message}${details ? '\n' + JSON.stringify(details, null, 2) : ''}`;
  return ok(id, { content: [{ type: 'text', text }], isError: true });
}

async function handleToolCall(
  id: JsonRpcId,
  params: Record<string, unknown>,
  ctx: ToolContext
): Promise<JsonRpcResponse> {
  const name = typeof params.name === 'string' ? params.name : '';
  const args =
    params.arguments && typeof params.arguments === 'object'
      ? (params.arguments as Record<string, unknown>)
      : {};

  const tool = mcpToolMap[name];
  if (!tool) return err(id, -32602, `未知工具: ${name}`);

  if (tool.requiresWrite && ctx.scope !== 'readwrite') {
    return toolError(
      id,
      'PERMISSION_DENIED',
      '当前令牌为只读权限，无法执行写操作。请在面板「设置 → MCP 接入」中生成或使用读写令牌。'
    );
  }

  if (tool.requiresConfirm && args.confirm !== true) {
    return toolError(
      id,
      'PERMISSION_DENIED',
      '该操作具有破坏性，必须显式传 confirm=true 才能执行；请先向用户确认。'
    );
  }

  try {
    const result = await tool.handle(args, ctx);
    if (tool.requiresWrite) {
      // 写操作后刷新面板缓存，保证浏览器下次加载即见新数据
      try {
        revalidatePath('/');
      } catch {
        // 非 Next 请求上下文时忽略
      }
    }
    return ok(id, {
      content: [{ type: 'text', text: JSON.stringify(result ?? null, null, 2) }],
      isError: false,
    });
  } catch (e) {
    if (isMcpError(e)) return toolError(id, e.code, e.message, e.details);
    return toolError(id, 'INTERNAL_ERROR', e instanceof Error ? e.message : '内部错误');
  }
}

async function handleOne(
  msg: JsonRpcRequestMessage,
  ctx: ToolContext
): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = msg.id ?? null;
  const method = typeof msg.method === 'string' ? msg.method : '';
  const params =
    msg.params && typeof msg.params === 'object'
      ? (msg.params as Record<string, unknown>)
      : {};

  // 通知（无 id）无需回复
  if (msg.id === undefined) {
    return null;
  }

  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      });
    case 'ping':
      return ok(id, {});
    case 'tools/list':
      return ok(id, {
        tools: mcpTools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: {
            readOnlyHint: !!t.readOnly,
            destructiveHint: !!t.requiresConfirm,
          },
        })),
      });
    case 'tools/call':
      return handleToolCall(id, params, ctx);
    case 'resources/list':
      return ok(id, { resources: [] });
    case 'prompts/list':
      return ok(id, { prompts: [] });
    case 'logging/setLevel':
      return ok(id, {});
    default:
      return err(id, -32601, `未支持的方法: ${method}`);
  }
}

/**
 * 处理一条或一批 JSON-RPC 消息。
 * 返回 null 表示本次请求只包含通知（无需响应体）。
 */
export async function handleJsonRpcBody(
  body: unknown,
  ctx: ToolContext
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  const isBatch = Array.isArray(body);
  const messages = isBatch ? body : [body];

  const responses: JsonRpcResponse[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') {
      responses.push(err(null, -32600, 'Invalid Request'));
      continue;
    }
    const r = await handleOne(m as JsonRpcRequestMessage, ctx);
    if (r) responses.push(r);
  }

  if (responses.length === 0) return null;
  return isBatch ? responses : responses[0];
}
