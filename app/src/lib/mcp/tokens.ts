import crypto from 'crypto';
import { db } from '../db';

// MCP 访问令牌核心：生成、哈希、校验
// 安全约定：明文仅在生成时返回一次，落库只存 SHA-256 哈希；不进日志

export const MCP_TOKEN_PREFIX = 'mcp_';
export const MCP_SCOPE_READONLY = 'readonly';
export const MCP_SCOPE_READWRITE = 'readwrite';
export const MCP_MAX_TOKENS_PER_USER = 5;

export type McpScope = 'readonly' | 'readwrite';

export interface McpAuthContext {
  tokenId: number;
  userId: number;
  scope: McpScope;
  user: { id: number; username: string; role: number };
}

export function hashMcpToken(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

// 生成明文令牌（mcp_ + 48 位十六进制随机串）
export function generateMcpTokenPlain(): string {
  return MCP_TOKEN_PREFIX + crypto.randomBytes(24).toString('hex');
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    const value = header.slice(7).trim();
    return value || null;
  }
  return null;
}

function normalizeScope(scope: string): McpScope {
  return scope === MCP_SCOPE_READWRITE ? MCP_SCOPE_READWRITE : MCP_SCOPE_READONLY;
}

/**
 * 校验 MCP 请求的身份：Bearer Token → mcp_token 表 → 关联用户。
 * 返回 null 表示未通过（Token 不存在/已删除/用户被停用）。
 */
export async function resolveMcpAuth(req: Request): Promise<McpAuthContext | null> {
  const plain = extractBearerToken(req);
  if (!plain || !plain.startsWith(MCP_TOKEN_PREFIX)) return null;

  const token = await db.mcpToken.findUnique({ where: { tokenHash: hashMcpToken(plain) } });
  if (!token || token.status !== 1) return null;

  const user = await db.user.findUnique({ where: { id: token.userId } });
  if (!user || user.status !== 1) return null;

  // 惰性更新最后使用时间（失败不阻塞主流程）
  db.mcpToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    tokenId: token.id,
    userId: token.userId,
    scope: normalizeScope(token.scope),
    user: { id: user.id, username: user.username, role: user.role },
  };
}
