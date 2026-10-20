// 登录页：账号密码校验，登录后按手势配置跳转
// EXPORTS: LoginPage (default)

import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Image } from '@/components/ui/image';
import { service } from '@/lib/service';
import { hashPassword } from '@/lib/crypto';
import { auth } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import type { IAccount } from '@/lib/types';

const BASE = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '') + '/';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  // 从“忘记手势密码”进入：验密通过后直接重设手势，不再走解锁
  const resetGesture = (location.state as { resetGesture?: boolean } | null)?.resetGesture;
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!account.trim() || !password) {
      toast.error('请输入账号和密码');
      return;
    }
    setLoading(true);
    try {
      const list = await service.accounts.all();
      let target: IAccount | undefined;
      for (const a of list) {
        if (a.account === account.trim()) {
          target = a;
          break;
        }
      }
      if (!target) {
        toast.error('账号或密码错误');
        return;
      }
      const hash = await hashPassword(password, target.salt);
      if (hash !== target.passwordHash) {
        toast.error('账号或密码错误');
        return;
      }
      auth.setCurrentAccount(target.id);
      auth.setLastLogin(Date.now());
      refresh();
      if (resetGesture) {
        toast.success('身份验证通过，请重设手势');
        navigate('/gesture-setup', { replace: true });
        return;
      }
      toast.success('登录成功');
      // 按当前账号读取自己的手势，决定进解锁还是去设置
      const g = await service.gesture.get(target.id);
      if (g && (g.segments?.length || g.points?.length)) {
        navigate('/gesture-unlock');
      } else {
        navigate('/gesture-setup');
      }
    } catch {
      toast.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image
          src={`${BASE}assets/icon.png`}
          alt="花海"
          className="mb-3 size-20 rounded-3xl"
        />
        <h1 className="text-2xl font-semibold text-foreground">花海</h1>
      </div>
      <Card className="w-full border-0 shadow-none">
        <CardContent className="space-y-4 pt-8">
          <div className="space-y-2">
            <Label htmlFor="account">账号</Label>
            <Input
              id="account"
              placeholder="手机号或邮箱"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onLogin();
              }}
              autoComplete="current-password"
            />
          </div>
          <Button className="w-full" onClick={() => void onLogin()} disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            还没有账号？{' '}
            <Link to="/register" className="font-medium text-primary">
              去注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
