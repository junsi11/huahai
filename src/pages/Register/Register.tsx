// 注册页：账号格式校验、查重、密码加盐哈希存储
// EXPORTS: RegisterPage (default)

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Image } from '@/components/ui/image';
import { service } from '@/lib/service';
import { hashPassword, generateSalt, randomId } from '@/lib/crypto';

const _base = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '');
const BASE = _base ? _base + '/' : '';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const validFormat = (acc: string): string | null => {
    const t = acc.trim();
    const isPhone = /^\d{11}$/.test(t);
    const isEmail = t.includes('@') && t.length > 3;
    if (!isPhone && !isEmail) return '请输入11位手机号或包含@的邮箱';
    return null;
  };

  const onRegister = async () => {
    const fmtErr = validFormat(account);
    if (fmtErr) {
      toast.error(fmtErr);
      return;
    }
    if (!username.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少6位');
      return;
    }
    if (password !== confirm) {
      toast.error('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      const list = await service.accounts.all();
      const dup = list.some((a) => a.account === account.trim());
      if (dup) {
        toast.error('该账号已被注册');
        return;
      }
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);
      await service.accounts.put({
        id: randomId(),
        account: account.trim(),
        username: username.trim(),
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
      });
      toast.success('注册成功，请登录');
      navigate('/login');
    } catch {
      toast.error('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center justify-center">
      <div className="mb-6 flex flex-col items-center text-center">
        <Image src={`${BASE}assets/icon.png`} alt="花海" className="mb-3 size-16 rounded-3xl" />
        <h1 className="text-2xl font-semibold text-foreground">注册账号</h1>
      </div>
      <Card className="w-full border-0 shadow-none">
        <CardContent className="space-y-4 pt-8">
          <div className="space-y-2">
            <Label htmlFor="acc">账号</Label>
            <Input
              id="acc"
              placeholder="11位手机号或邮箱"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">用户名</Label>
            <Input
              id="name"
              placeholder="你的昵称"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">密码</Label>
            <Input
              id="pwd"
              type="password"
              placeholder="至少6位"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd2">确认密码</Label>
            <Input
              id="pwd2"
              type="password"
              placeholder="再次输入密码"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onRegister();
              }}
              autoComplete="new-password"
            />
          </div>
          <Button className="w-full" onClick={() => void onRegister()} disabled={loading}>
            {loading ? '注册中…' : '注册'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{' '}
            <Link to="/login" className="font-medium text-primary">
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
