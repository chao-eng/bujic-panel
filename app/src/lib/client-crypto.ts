'use client';

// 客户端密钥缓存
let cachedKey: CryptoKey | null = null;
let cachedKeyHex: string | null = null;

/**
 * 从 /api/crypto 获取派生的客户端密钥（hex），并导入为 CryptoKey
 */
async function getClientKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const res = await fetch('/api/crypto', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch encryption key');
  const { key } = await res.json();
  cachedKeyHex = key as string;

  const keyBytes = hexToBytes(key);
  cachedKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  return cachedKey;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * 使用 AES-256-GCM 加密敏感字符串
 * 返回格式: base64(iv):base64(authTag):base64(ciphertext)
 */
export async function encryptSensitive(plaintext: string): Promise<string> {
  const key = await getClientKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    encoded
  );

  // AES-GCM 的 subtle.encrypt 输出：ciphertext + authTag(16字节) 拼接
  const cipherWithTag = new Uint8Array(cipherBuffer);
  const ciphertext = cipherWithTag.slice(0, cipherWithTag.length - 16);
  const authTag = cipherWithTag.slice(cipherWithTag.length - 16);

  const ivB64 = toBase64(iv.buffer);
  const authTagB64 = toBase64(authTag.buffer);
  const cipherB64 = toBase64(ciphertext.buffer);

  return `${ivB64}:${authTagB64}:${cipherB64}`;
}
