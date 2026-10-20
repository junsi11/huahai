// 目标追踪与倒计时：目标（类别/单位自定义）、进度调整、倒计时（到点提醒、设提醒时间）、编辑/删除
// EXPORTS: GoalsPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Minus, CalendarClock, Bell, BellOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import { notify, requestNotifyPermission } from '@/lib/notification';
import type { IGoal, ICountdown } from '@/lib/types';

const CATS = ['阅读', '存钱', '运动', '学习', '健康', '其他'];
const UNITS = ['本', '元', '小时', '次', '个'];

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function GoalsPage() {
  const { data, refresh } = useAllData();
  const [tab, setTab] = useState<'goal' | 'countdown'>('goal');

  // 目标表单
  const [gName, setGName] = useState('');
  const [gCat, setGCat] = useState('阅读');
  const [gCatCustom, setGCatCustom] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gUnit, setGUnit] = useState('本');
  const [gUnitCustom, setGUnitCustom] = useState('');
  const [gStart, setGStart] = useState(today());
  const [gEnd, setGEnd] = useState('');
  const [gCurrent, setGCurrent] = useState('0');
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDelete, setGoalDelete] = useState<string | null>(null);
  const [goalEdit, setGoalEdit] = useState<IGoal | null>(null);

  // 倒计时表单
  const [cName, setCName] = useState('');
  const [cDate, setCDate] = useState('');
  const [cNote, setCNote] = useState('');
  const [cRemind, setCRemind] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [countDelete, setCountDelete] = useState<string | null>(null);
  const [countEdit, setCountEdit] = useState<ICountdown | null>(null);

  const effectiveCat = gCatCustom.trim() || gCat;
  const effectiveUnit = gUnitCustom.trim() || gUnit;

  const openAddGoal = () => {
    setGoalEdit(null);
    setGName('');
    setGCat('阅读');
    setGCatCustom('');
    setGTarget('');
    setGUnit('本');
    setGUnitCustom('');
    setGStart(today());
    setGEnd('');
    setGCurrent('0');
    setGoalOpen(true);
  };
  const openEditGoal = (g: IGoal) => {
    setGoalEdit(g);
    setGName(g.name);
    setGCat(CATS.includes(g.category) ? g.category : '其他');
    setGCatCustom(CATS.includes(g.category) ? '' : g.category);
    setGTarget(String(g.target));
    setGUnit(UNITS.includes(g.unit) ? g.unit : '次');
    setGUnitCustom(UNITS.includes(g.unit) ? '' : g.unit);
    setGStart(g.startDate);
    setGEnd(g.endDate ?? '');
    setGCurrent(String(g.current));
    setGoalOpen(true);
  };

  const saveGoal = async () => {
    if (!gName.trim()) {
      toast.error('请输入目标名称');
      return;
    }
    if (!gTarget || Number(gTarget) <= 0) {
      toast.error('请输入有效的总目标值');
      return;
    }
    const base = {
      name: gName.trim(),
      category: effectiveCat,
      target: Number(gTarget),
      unit: effectiveUnit,
      startDate: gStart,
      endDate: gEnd || undefined,
      current: Number(gCurrent) || 0,
    };
    if (goalEdit) {
      await service.goals.put({ ...goalEdit, ...base });
      toast.success('目标已更新');
    } else {
      await service.goals.put({ id: randomId(), createdAt: Date.now(), ...base });
      toast.success('目标已创建');
    }
    setGoalOpen(false);
    void refresh();
  };

  const adjustGoal = async (g: IGoal, delta: number) => {
    const next = Math.max(0, g.current + delta);
    await service.goals.put({ ...g, current: next });
    void refresh();
  };

  const openAddCount = () => {
    setCountEdit(null);
    setCName('');
    setCDate('');
    setCNote('');
    setCRemind(false);
    setCountOpen(true);
  };
  const openEditCount = (c: ICountdown) => {
    setCountEdit(c);
    setCName(c.name);
    setCDate(c.date);
    setCNote(c.note ?? '');
    setCRemind(c.remind ?? false);
    setCountOpen(true);
  };

  const saveCountdown = async () => {
    if (!cName.trim() || !cDate) {
      toast.error('请输入名称和日期');
      return;
    }
    const base = {
      name: cName.trim(),
      date: cDate,
      note: cNote.trim() || undefined,
      remind: cRemind,
    };
    if (countEdit) {
      await service.countdowns.put({ ...countEdit, ...base });
      toast.success('倒计时已更新');
    } else {
      await service.countdowns.put({ id: randomId(), createdAt: Date.now(), ...base });
      toast.success('倒计时已创建');
    }
    setCountOpen(false);
    void refresh();
  };

  const toggleCountRemind = async (c: ICountdown) => {
    await service.countdowns.put({ ...c, remind: !c.remind });
    void refresh();
  };

  const countdownList = useMemo(
    () => [...data.countdowns].sort((a, b) => a.date.localeCompare(b.date)),
    [data.countdowns],
  );

  // 目标分组：已实现（达标）/ 仍需要努力（未达标，含已过期）
  const achievedGoals = useMemo(
    () => data.goals.filter((g) => g.target > 0 && g.current >= g.target),
    [data.goals],
  );
  const openGoals = useMemo(
    () => data.goals.filter((g) => !(g.target > 0 && g.current >= g.target)),
    [data.goals],
  );

  const isOverdue = (g: IGoal) => g.endDate && g.endDate < today() && g.current < g.target;

  const daysUntil = (d: string) => {
    const now = new Date(today()).getTime();
    const target = new Date(d).getTime();
    return Math.ceil((target - now) / 86400000);
  };

  // 倒计时到点提醒检查
  useMemo(() => {
    requestNotifyPermission();
    const due = data.countdowns.filter((c) => c.date === today() && c.remind);
    if (due.length > 0) {
      notify('花海倒计时', `今天「${due.map((d) => d.name).join('、')}」到了`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">目标与倒计时</h1>
          <p className="text-sm text-muted-foreground">把梦想一点点实现</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'goal' | 'countdown')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="goal">目标追踪</TabsTrigger>
          <TabsTrigger value="countdown">倒计时</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'goal' ? (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={openAddGoal}>
              <Plus className="mr-1 size-4" /> 新建目标
            </Button>
          </div>

          {data.goals.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">还没有目标，点击右上角新建</p>
          )}

          {/* 仍需要努力（未达标，含已过期未完成），空也列出 */}
          <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">仍需要努力（{openGoals.length}）</h3>
              {openGoals.length === 0 && (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">暂无未完成目标</p>
              )}
              {openGoals.map((g) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                return (
                  <Card key={g.id}>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {g.name}
                            {isOverdue(g) && (
                              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">已过期</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {g.category} · {g.startDate}
                            {g.endDate ? ` ~ ${g.endDate}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditGoal(g)} aria-label="编辑">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setGoalDelete(g.id)} aria-label="删除">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-lg font-semibold">
                          {g.current} / {g.target} <span className="text-xs text-muted-foreground">{g.unit}</span>
                        </span>
                        <span className="text-primary">{pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => void adjustGoal(g, -1)}>
                          <Minus className="size-4" /> -1
                        </Button>
                        <Button size="sm" onClick={() => void adjustGoal(g, 1)}>
                          <Plus className="size-4" /> +1
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {/* 已实现目标，空也列出 */}
          <div className="space-y-3">
              <h3 className="text-sm font-semibold text-success">已实现目标（{achievedGoals.length}）</h3>
              {achievedGoals.length === 0 && (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">还没有达成的目标，加油</p>
              )}
              {achievedGoals.map((g) => {
                return (
                  <Card key={g.id} className="border-success/40">
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 font-medium text-success">
                            {g.name}
                            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs">✓ 已实现</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {g.category} · {g.startDate}
                            {g.endDate ? ` ~ ${g.endDate}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditGoal(g)} aria-label="编辑">
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setGoalDelete(g.id)} aria-label="删除">
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-lg font-semibold text-success">
                          {g.current} / {g.target} <span className="text-xs text-muted-foreground">{g.unit}</span>
                        </span>
                        <span className="text-success">100%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-success" style={{ width: '100%' }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          <Dialog open={goalOpen} onOpenChange={setGoalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{goalEdit ? '修改目标' : '新建目标'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>目标名称</Label>
                  <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="如：今年读12本书" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>类别（可自定义）</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {CATS.map((c) => (
                        <Button
                          key={c}
                          size="sm"
                          variant={effectiveCat === c ? 'default' : 'outline'}
                          onClick={() => setGCat(c)}
                        >
                          {c}
                        </Button>
                      ))}
                      <Input
                        className="h-8 w-20 text-xs"
                        placeholder="自定义"
                        value={gCatCustom}
                        onChange={(e) => setGCatCustom(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>计量单位（可自定义）</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {UNITS.map((u) => (
                        <Button
                          key={u}
                          size="sm"
                          variant={effectiveUnit === u ? 'default' : 'outline'}
                          onClick={() => setGUnit(u)}
                        >
                          {u}
                        </Button>
                      ))}
                      <Input
                        className="h-8 w-20 text-xs"
                        placeholder="自定义"
                        value={gUnitCustom}
                        onChange={(e) => setGUnitCustom(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>总目标值</Label>
                    <Input type="number" value={gTarget} onChange={(e) => setGTarget(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>当前值</Label>
                    <Input type="number" value={gCurrent} onChange={(e) => setGCurrent(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>开始日期</Label>
                    <Input type="date" value={gStart} onChange={(e) => setGStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>截止日期</Label>
                    <Input type="date" value={gEnd} onChange={(e) => setGEnd(e.target.value)} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => void saveGoal()}>
                  {goalEdit ? '保存修改' : '创建'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <Button size="sm" onClick={openAddCount}>
              <Plus className="mr-1 size-4" /> 新建倒计时
            </Button>
          </div>

          <div className="space-y-3">
            {countdownList.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">还没有倒计时</p>
            ) : (
              countdownList.map((c) => {
                const d = daysUntil(c.date);
                return (
                  <Card key={c.id}>
                    <CardContent className="flex items-center gap-3 pt-4">
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <CalendarClock className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.date}
                          {c.note ? ` · ${c.note}` : ''}
                          {c.remind && ' · 🔔'}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className={cn('text-lg font-semibold', d < 0 ? 'text-destructive' : 'text-primary')}>
                          {d >= 0 ? `${d} 天` : '已过'}
                        </div>
                        <div className="text-xs text-muted-foreground">{d >= 0 ? '倒计时' : '天前'}</div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => void toggleCountRemind(c)} title={c.remind ? '关闭提醒' : '开启提醒'}>
                        {c.remind ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEditCount(c)} aria-label="编辑">
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setCountDelete(c.id)} aria-label="删除">
                        <Trash2 className="size-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <Dialog open={countOpen} onOpenChange={setCountOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{countEdit ? '修改倒计时' : '新建倒计时'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>名称</Label>
                  <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="如：考试日" />
                </div>
                <div className="space-y-1">
                  <Label>目标日期</Label>
                  <Input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>备注</Label>
                  <Input value={cNote} onChange={(e) => setCNote(e.target.value)} placeholder="选填" />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">到点提醒（浏览器通知）</span>
                  <Switch checked={cRemind} onCheckedChange={setCRemind} />
                </div>
                <Button className="w-full" onClick={() => void saveCountdown()}>
                  {countEdit ? '保存修改' : '创建'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      <AlertDialog open={!!goalDelete} onOpenChange={(o) => !o && setGoalDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个目标？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setGoalDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (goalDelete) void service.goals.del(goalDelete); setGoalDelete(null); void refresh(); }}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!countDelete} onOpenChange={(o) => !o && setCountDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个倒计时？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCountDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (countDelete) void service.countdowns.del(countDelete); setCountDelete(null); void refresh(); }}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
