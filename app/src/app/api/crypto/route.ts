import { NextResponse } from 'next/server';
import { deriveClientKey } from '../../../lib/crypto';

/**
 * GET /api/crypto
 * 返回派生的客户端加密密钥（由主密钥 HMAC 派生，不暴露主密钥）
 * 前端用此 key 对敏感字段做 AES-256-GCM 加密后再提交
 */
export async function GET() {
  const key = deriveClientKey();
  return NextResponse.json({ key });
}
