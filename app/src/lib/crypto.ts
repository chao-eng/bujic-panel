import crypto from 'crypto';

const ENCRYPT_KEY_HEX =
  process.env.ENCRYPT_KEY ||
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

// 从环境变量派生 32 字节 AES 密钥
function getServerKey(): Buffer {
  const hex = ENCRYPT_KEY_HEX.slice(0, 64).padEnd(64, '0');
  return Buffer.from(hex, 'hex');
}

// 派生客户端使用的密钥（由 ENCRYPT_KEY HMAC 派生，不直接暴露主密钥）
export function deriveClientKey(): string {
  const key = getServerKey();
  return crypto.createHmac('sha256', key).update('client-transport-key').digest('hex');
}

/**
 * 解密前端传来的 AES-256-GCM 密文
 * 格式: base64(iv):base64(authTag):base64(ciphertext)
 * 若解密失败（如明文直接传入），则返回原始字符串（向后兼容）
 */
export function decryptFromTransport(encryptedStr: string): string {
  try {
    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return encryptedStr; // 不是密文格式，原样返回

    const [ivB64, authTagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');

    // 使用派生的客户端密钥解密（与前端使用同一个 key）
    const clientKeyHex = deriveClientKey();
    const key = Buffer.from(clientKeyHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // 解密失败时返回原文（兼容未加密的旧请求）
    return encryptedStr;
  }
}
