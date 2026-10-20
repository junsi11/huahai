// 鉴权 Provider 组件：异步加载账号数量并维护登录状态快照
// EXPORTS: AuthProvider (default)

import { useEffect, useMemo, useState } from 'react';
import { getAuthState, auth, type IAuthState } from '@/lib/auth';
import { AuthContext, type AuthStateT } from '@/lib/auth-context';
import { service } from '@/lib/service';

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<IAuthState>(() => getAuthState(0));
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = () => {
    setState(getAuthState());
    setJustLoggedIn(auth.getLastLogin() > 0);
  };

  useEffect(() => {
    let alive = true;
    service
      .accounts
      .all()
      .then((list) => {
        if (!alive) return;
        const count = list.length;
        // 若只有一个账号，记录为当前账号
        if (count === 1) {
          auth.setCurrentAccount(list[0].id);
        }
        setState(getAuthState(count));
        setReady(true);
      })
      .catch(() => {
        if (alive) {
          setState(getAuthState(0));
          setReady(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthStateT>(
    () => ({
      ...state,
      justLoggedIn,
      ready,
      refresh,
    }),
    [state, justLoggedIn, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
