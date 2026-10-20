// 设置中心：首页卡片配置（点进查看）、手势管理（重置需验证账号密码）、头像上传、备份、关于、退出
// EXPORTS: SettingsPage (default)

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Wallet, Timer, ListTodo, Repeat, HeartPulse, Target, CalendarClock, CalendarDays, ChevronUp, ChevronDown, Lock, HardDrive, Info, LogOut, LayoutDashboard, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { store } from '@/lib/localstore';
import { service } from '@/lib/service';
import { auth } from '@/lib/auth';
import { hashPassword } from '@/lib/crypto';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import EasterEgg from '@/components/EasterEgg';

const CARD_META = [
  { key: 'ledger', label: '记账', icon: Wallet },
  { key: 'pomodoro', label: '番茄专注', icon: Timer },
  { key: 'tasks', label: '今日任务', icon: ListTodo },
  { key: 'habits', label: '习惯打卡', icon: Repeat },
  { key: 'health', label: '健康心情', icon: HeartPulse },
  { key: 'goals', label: '目标追踪', icon: Target },
  { key: 'countdown', label: '倒计时', icon: CalendarClock },
  { key: 'calendar', label: '日历预览', icon: CalendarDays },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [aboutClicks, setAboutClicks] = useState(0);
  const [egg, setEgg] = useState<{ src: string; text?: string } | null>(null);
  const [order, setOrder] = useState<string[]>(() => {
    const saved = store.get<string[]>('dash_order', []);
    const base = CARD_META.map((c) => c.key);
    return saved.length ? saved : base;
  });
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const saved = store.get<Record<string, boolean>>('dash_cards', {});
    const init: Record<string, boolean> = {};
    CARD_META.forEach((c) => {
      init[c.key] = saved[c.key] ?? true;
    });
    return init;
  });
  const [cardConfOpen, setCardConfOpen] = useState(false);

  // 头像上传
  const [avatar, setAvatar] = useState<string | null>(() => store.get<string | null>('avatar', null));
  const avatarRef = useRef<HTMLInputElement>(null);

  // 重置手势：需验证账号密码
  const [gestureVerifyOpen, setGestureVerifyOpen] = useState(false);
  const [gAccount, setGAccount] = useState('');
  const [gPassword, setGPassword] = useState('');

  const saveConfig = () => {
    store.set('dash_order', order);
    store.set('dash_cards', visible);
    toast.success('卡片配置已保存');
  };

  const move = (idx: number, dir: -1 | 1) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const onAvatarChange = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      store.set('avatar', reader.result as string);
      setAvatar(reader.result as string);
      toast.success('头像已更新');
    };
    reader.readAsDataURL(f);
  };
  const removeAvatar = () => {
    store.remove('avatar');
    setAvatar(null);
    toast.success('已恢复默认头像');
  };

  const doResetGesture = async () => {
    const accountId = auth.getCurrentAccount();
    if (!accountId) {
      toast.error('未找到当前账号');
      return;
    }
    const acc = await service.accounts.get(accountId);
    if (!acc) {
      toast.error('账号不存在');
      return;
    }
    const accountMatch = gAccount.trim() === acc.account || gAccount.trim() === acc.username;
    if (!accountMatch) {
      toast.error('账号不正确');
      return;
    }
    const hash = await hashPassword(gPassword, acc.salt);
    if (hash !== acc.passwordHash) {
      toast.error('密码不正确');
      return;
    }
    await service.gesture.clear(auth.getCurrentAccount());
    auth.setGestureConfigured(false);
    refresh();
    setGestureVerifyOpen(false);
    setGAccount('');
    setGPassword('');
    toast.success('验证通过，手势密码已重置');
    navigate('/gesture-setup');
  };

  const logout = async () => {
    auth.setLastLogin(0);
    refresh();
    navigate('/login');
  };

  const cardConf = order
    .map((k) => ({ meta: CARD_META.find((c) => c.key === k)!, idx: order.indexOf(k) }))
    .filter((x) => x.meta);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">设置</h1>
        <p className="text-sm text-muted-foreground">管理你的花海</p>
      </div>

      {/* 头像 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4 text-primary" /> 个人头像
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-primary/10">
              {avatar ? (
                <img src={avatar} alt="avatar" className="size-full object-cover" />
              ) : (
                <LayoutDashboard className="size-6 text-primary" />
              )}
            </div>
            <div className="flex-1 text-xs text-muted-foreground">
              头像会显示在左侧导航顶部（圆圈状）
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => avatarRef.current?.click()}>
              <Camera className="mr-1 size-4" /> 上传头像
            </Button>
            {avatar && (
              <Button size="sm" variant="ghost" onClick={removeAvatar}>恢复默认</Button>
            )}
          </div>
          <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { onAvatarChange(e.target.files); e.target.value = ''; }} />
        </CardContent>
      </Card>

      {/* 首页卡片（点进去查看配置） */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">首页卡片</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">首页显示哪些卡片、顺序如何，点进来管理。</p>
          <Button size="sm" variant="outline" className="w-full" onClick={() => setCardConfOpen(true)}>
            管理首页卡片
          </Button>
        </CardContent>
      </Card>

      <Dialog open={cardConfOpen} onOpenChange={setCardConfOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>管理首页卡片</DialogTitle>
            <DialogDescription>调整显示/隐藏与排序</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {cardConf.map(({ meta, idx }) => {
              const Icon = meta.icon;
              return (
                <div key={meta.key} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Icon className="size-4 text-primary" />
                  <span className="flex-1 text-sm">{meta.label}</span>
                  <Button size="icon" variant="ghost" onClick={() => move(idx, -1)}>
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(idx, 1)}>
                    <ChevronDown className="size-4" />
                  </Button>
                  <Switch
                    checked={visible[meta.key] ?? true}
                    onCheckedChange={(v) => setVisible((prev) => ({ ...prev, [meta.key]: v }))}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => { saveConfig(); setCardConfOpen(false); }}>
              保存配置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 手势管理 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-primary" /> 手势密码
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => setGestureVerifyOpen(true)}>
            重置手势密码
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">重置需先验证登录账号与密码</p>
        </CardContent>
      </Card>

      <Dialog open={gestureVerifyOpen} onOpenChange={setGestureVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>验证身份</DialogTitle>
            <DialogDescription>输入登录账号与密码以重置手势密码</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>账号（手机号/邮箱/用户名）</Label>
              <Input value={gAccount} onChange={(e) => setGAccount(e.target.value)} placeholder="登录账号" />
            </div>
            <div className="space-y-1">
              <Label>密码</Label>
              <Input type="password" value={gPassword} onChange={(e) => setGPassword(e.target.value)} placeholder="登录密码" />
            </div>
            <Button className="w-full" onClick={() => void doResetGesture()}>验证并重置</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 存储 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4 text-primary" /> 本地存储
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>所有数据均保存在本机私有存储中，不联网、不上传。</p>
        </CardContent>
      </Card>

      {/* 备份入口 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4 text-primary" /> 数据备份
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => navigate('/backup')}>
            前往备份与恢复
          </Button>
        </CardContent>
      </Card>

      {/* 关于 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="size-4 text-primary" />
            <button
              className="font-semibold"
              onClick={() => {
                setAboutClicks((c) => {
                  const n = c + 1;
                  if (n >= 6) {
                    setEgg({ src: 'brother.mp4' });
                    return 0;
                  }
                  return n;
                });
              }}
              title={aboutClicks > 0 ? `再点 ${6 - aboutClicks} 次有惊喜` : undefined}
            >
              关于
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>花海 v1.0 · 奶油治愈系私人生活记录</p>
          <p className="mt-1">纯本地离线应用，数据隐私有保障。</p>
        </CardContent>
      </Card>

      {/* 退出 */}
      <Card>
        <CardContent className="pt-4">
          <Button
            variant="ghost"
            className={cn('w-full text-destructive')}
            onClick={() => void logout()}
          >
            <LogOut className="mr-1 size-4" /> 退出登录
          </Button>
        </CardContent>
      </Card>

      {egg && <EasterEgg src={egg.src} text={egg.text} onClose={() => setEgg(null)} />}
    </div>
  );
}
