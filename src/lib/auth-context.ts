// 鉴权响应式上下文（不含组件，Provider 在组件文件中）
// EXPORTS: AuthContext, useAuth, AuthStateT

import { createContext, useContext } from 'react';
import { getAuthState, type IAuthState } from './auth';

export type AuthStateT = IAuthState & {
  refresh: () => void;
  justLoggedIn: boolean;
  ready: boolean;
};

export const AuthContext = createContext<AuthStateT>({
  ...getAuthState(0),
  refresh: () => {},
  justLoggedIn: false,
  ready: false,
});

export function useAuth(): AuthStateT {
  return useContext(AuthContext);
}
