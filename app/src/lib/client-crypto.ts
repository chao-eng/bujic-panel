'use client';

import { gcm } from '@noble/ciphers/aes.js';

// 客户端密钥缓存
let cachedKey: CryptoKey | null = null;
let cachedKeyHex: string | null = null;

/**
 * 从 /api/crypto 获取派生的客户端密钥（hex）
 */
async function getClientKeyHex(): Promise<string> {
  if (cachedKeyHex) return cachedKeyHex;

  const res = await fetch('/api/crypto', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch encryption key');
  const { key } = await res.json();
  cachedKeyHex = key as string;
  return cachedKeyHex;
}

/**
 * 从 /api/crypto 获取派生的客户端密钥（hex），并导入为 CryptoKey
 */
async function getClientKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const hex = await getClientKeyHex();
  const keyBytes = hexToBytes(hex);
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

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * 使用 AES-256-GCM 加密敏感字符串
 * 返回格式: base64(iv):base64(authTag):base64(ciphertext)
 */
export async function encryptSensitive(plaintext: string): Promise<string> {
  if (typeof window === 'undefined') {
    return plaintext;
  }

  const iv = new Uint8Array(12); // 96-bit IV for GCM
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(iv);
  } else {
    for (let i = 0; i < iv.length; i++) {
      iv[i] = Math.floor(Math.random() * 256);
    }
  }

  let cipherWithTag: Uint8Array;

  if (window.crypto && window.crypto.subtle) {
    const key = await getClientKey();
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      encoded
    );
    cipherWithTag = new Uint8Array(cipherBuffer);
  } else {
    // Web Crypto API 不可用（非安全上下文，如 HTTP）时，降级使用纯 JS 加密
    const keyHex = await getClientKeyHex();
    const keyBytes = hexToBytes(keyHex);
    const encoded = new TextEncoder().encode(plaintext);

    const aesGcm = gcm(keyBytes, iv);
    cipherWithTag = aesGcm.encrypt(encoded);
  }

  // AES-GCM 的输出：ciphertext + authTag(16字节) 拼接
  const ciphertext = cipherWithTag.slice(0, cipherWithTag.length - 16);
  const authTag = cipherWithTag.slice(cipherWithTag.length - 16);

  const ivB64 = toBase64(iv);
  const authTagB64 = toBase64(authTag);
  const cipherB64 = toBase64(ciphertext);

  return `${ivB64}:${authTagB64}:${cipherB64}`;
}
