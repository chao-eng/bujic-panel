import { NextRequest, NextResponse } from 'next/server';
import { resolveMcpAuth } from '../../../lib/mcp/tokens';
import { handleJsonRpcBody, MCP_PROTOCOL_VERSION } from '../../../lib/mcp/server';

// MCP Streamable HTTP 传输端点
// 鉴权：Authorization: Bearer mcp_xxx（不使用 Cookie，避免 CSRF 面）
// 该路径已在 src/proxy.ts 中放行，由本路由自行完成令牌校验

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(body: unknown, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'mcp-protocol-version': MCP_PROTOCOL_VERSION,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await resolveMcpAuth(req);
  if (!auth) {
    return json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32001, message: '未授权：请提供有效且未被删除的 MCP Bearer Token' },
      },
      401
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: '请求体不是合法 JSON' } },
      400
    );
  }

  const result = await handleJsonRpcBody(body, { userId: auth.userId, scope: auth.scope });

  // 仅通知（如 notifications/initialized）无需响应体
  if (result === null) {
    return new NextResponse(null, {
      status: 202,
      headers: { 'mcp-protocol-version': MCP_PROTOCOL_VERSION },
    });
  }

  return json(result);
}

// 本实现不需要服务端主动推送，按 MCP 规范对 GET 返回 405
export async function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
