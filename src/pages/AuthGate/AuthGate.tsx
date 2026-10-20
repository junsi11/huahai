// 首页守卫：按登录/手势状态分流到登录、手势设置或手势解锁
// EXPORTS: AuthGate (default)

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';

export default function AuthGate() {
  const { ready, hasAccount, hasGesture, loggedIn } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (!hasAccount) return <Navigate to="/login" replace />;
  if (!loggedIn) return <Navigate to="/login" replace />;
  if (!hasGesture) return <Navigate to="/gesture-setup" replace />;
  return <Navigate to="/gesture-unlock" replace />;
}
