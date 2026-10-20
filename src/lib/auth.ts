// 鉴权状态管理：登录时间戳、手势配置标记、当前账号
// EXPORTS: auth, getAuthState, isLoggedIn, DAYS_MS

import { store } from './localstore';

const DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface IAuthState {
  hasAccount: boolean;    // 本地是否有注册账号
  hasGesture: boolean;    // 是否已配置手势
  loggedIn: boolean;      // 是否处于免密期内（≤30天）
  accountId?: string;
}

export const auth = {
  setLastLogin(ts: number) {
    store.set('last_login_time', ts);
  },
  getLastLogin(): number {
    return store.get<number>('last_login_time', 0);
  },
  setCurrentAccount(id: string) {
    store.set('current_account', id);
  },
  getCurrentAccount(): string {
    return store.get<string>('current_account', '');
  },
  setGestureConfigured(v: boolean) {
    store.set('gesture_configured', v);
  },
  getGestureConfigured(): boolean {
    return store.get<boolean>('gesture_configured', false);
  },
  clear() {
    store.remove('last_login_time');
    store.remove('current_account');
    store.remove('gesture_configured');
  },
};

export function getAuthState(accountCount = 0): IAuthState {
  const hasAccount = accountCount > 0 || !!auth.getCurrentAccount();
  const last = auth.getLastLogin();
  const loggedIn = last > 0 && Date.now() - last < DAYS_MS;
  return {
    hasAccount,
    hasGesture: auth.getGestureConfigured(),
    loggedIn,
    accountId: auth.getCurrentAccount(),
  };
}

export const DAYS_MS_EXPORT = DAYS_MS;
