'use server';

import { db } from '../lib/db';
import { getCurrentUser } from '../lib/auth';
import {
  generateMcpTokenPlain,
  hashMcpToken,
  MCP_MAX_TOKENS_PER_USER,
} from '../lib/mcp/tokens';

// MCP 访问令牌管理（浏览器侧，需登录态）
// 安全约定：明文令牌仅在生成时返回一次，落库只存哈希

// 列出当前用户的 MCP 令牌（不含明文与哈希）
export async function listMcpTokensAction() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const tokens = await db.mcpToken.findMany({
    where: { userId: user.id },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return tokens.map((t) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    status: t.status,
    lastUsedAt: t.lastUsedAt,
    createdAt: t.createdAt,
  }));
}

// 生成令牌：明文仅此一次返回
export async function createMcpTokenAction(data: {
  name: string;
  scope: 'readonly' | 'readwrite';
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const name = (data.name || '').trim();
  if (!name) return { success: false as const, message: '令牌名称不能为空' };
  if (name.length > 20) return { success: false as const, message: '令牌名称不能超过 20 个字符' };

  const activeCount = await db.mcpToken.count({ where: { userId: user.id, status: 1 } });
  if (activeCount >= MCP_MAX_TOKENS_PER_USER) {
    return {
      success: false as const,
      message: `最多启用 ${MCP_MAX_TOKENS_PER_USER} 个令牌，请先禁用或删除其它令牌`,
    };
  }

  const plain = generateMcpTokenPlain();
  const created = await db.mcpToken.create({
    data: {
      userId: user.id,
      name,
      tokenHash: hashMcpToken(plain),
      scope: data.scope === 'readwrite' ? 'readwrite' : 'readonly',
      status: 1,
    },
  });

  return {
    success: true as const,
    plain,
    token: {
      id: created.id,
      name: created.name,
      scope: created.scope,
      status: created.status,
      lastUsedAt: created.lastUsedAt,
      createdAt: created.createdAt,
    },
  };
}

// 启用 / 禁用令牌
export async function setMcpTokenStatusAction(id: number, status: 1 | 2) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const res = await db.mcpToken.updateMany({
    where: { id, userId: user.id },
    data: { status },
  });

  if (res.count === 0) return { success: false as const, message: '令牌不存在' };
  return { success: true as const };
}

// 删除令牌（物理删除，不可恢复）
export async function deleteMcpTokenAction(id: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized');

  const res = await db.mcpToken.deleteMany({
    where: { id, userId: user.id },
  });

  if (res.count === 0) return { success: false as const, message: '令牌不存在或已删除' };
  return { success: true as const };
}
