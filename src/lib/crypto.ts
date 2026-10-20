// 哈希与加盐工具：密码加盐哈希、手势哈希（不存明文/原始点位）
// EXPORTS: generateSalt, hashPassword, hashGesture, randomId, uid

export function generateSalt(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// 基于 SHA-256 的简单加盐哈希（浏览器原生 crypto.subtle）
export async function hashWithSalt(value: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(salt + '::' + value + '::' + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return hashWithSalt(password, salt);
}

export async function hashGesture(pattern: string, salt: string): Promise<string> {
  // 手势路径仅存哈希
  return hashWithSalt(pattern, salt);
}

export function randomId(): string {
  return (
    Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  );
}

export const uid = randomId;
