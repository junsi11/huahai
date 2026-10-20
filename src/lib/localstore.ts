// localStorage 轻量状态封装（带项目命名空间，隐私模式安全降级）
// EXPORTS: store

const NS = 'huahai';

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`${NS}:${key}`);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
    } catch {
      /* 隐私模式静默降级 */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(`${NS}:${key}`);
    } catch {
      /* 忽略 */
    }
  },
};
