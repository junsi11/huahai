// 习惯打卡：新建习惯（次数自定义/颜色多选）、每日打卡、连续天数、热力图、打卡记录统计、编辑/删除
// EXPORTS: HabitsPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Check, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format, subMonths, startOfMonth } from 'date-fns';
import type { IHabit } from '@/lib/types';

const COLORS = ['#E79BB0', '#5D8A72', '#7B9AE5', '#F4A259', '#B080E0', '#C97A8E', '#4A90D9', '#E67E5A', '#9C6ADE', '#2FBF9E', '#E74C8B', '#F5B84C'];

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function makeCheckin(habitId: string, date: string) {
  return { id: randomId(), habitId, date, createdAt: Date.now() };
}

export default function HabitsPage() {
  const { data, refresh } = useAllData();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IHabit | null>(null);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState(7);
  const [goalPeriod, setGoalPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [color, setColor] = useState(COLORS[0]);
  // 打卡记录查看
  const [statsHabit, setStatsHabit] = useState<IHabit | null>(null);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setFrequency(7);
    setGoalPeriod('week');
    setColor(COLORS[0]);
    setOpen(true);
  };
  const openEdit = (h: IHabit) => {
    setEditing(h);
    setName(h.name);
    setFrequency(h.frequency);
    setGoalPeriod(h.goalPeriod ?? 'week');
    setColor(h.color);
    setOpen(true);
  };

  const onSave = async () => {
    if (!name.trim()) {
      toast.error('请输入习惯名称');
      return;
    }
    if (frequency < 1) {
      toast.error('目标次数至少 1 次');
      return;
    }
    if (editing) {
      await service.habits.put({ ...editing, name: name.trim(), frequency, goalPeriod, color });
      toast.success('习惯已更新');
    } else {
      const h: IHabit = {
        id: randomId(),
        name: name.trim(),
        frequency,
        goalPeriod,
        startDate: today(),
        color,
        createdAt: Date.now(),
      };
      await service.habits.put(h);
      toast.success('习惯已创建');
    }
    setOpen(false);
    void refresh();
  };

  const toggleCheck = async (habitId: string) => {
    const existing = data.checkins.find((c) => c.habitId === habitId && c.date === today());
    if (existing) {
      await service.checkins.del(existing.id);
    } else {
      await service.checkins.put(makeCheckin(habitId, today()));
    }
    void refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await service.habits.del(deleteId);
    for (const c of data.checkins.filter((c) => c.habitId === deleteId)) {
      await service.checkins.del(c.id);
    }
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  const streak = (habitId: string) => {
    const dates = new Set(data.checkins.filter((c) => c.habitId === habitId).map((c) => c.date));
    let s = 0;
    const d = new Date();
    while (dates.has(format(d, 'yyyy-MM-dd'))) {
      s += 1;
      d.setDate(d.getDate() - 1);
    }
    return s;
  };

  // 打卡记录统计（按日/周/月/年聚合）
  const statsFor = (h: IHabit) => {
    const mine = data.checkins.filter((c) => c.habitId === h.id).map((c) => c.date);
    const set = new Set(mine);
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // 周一
    let day = 0;
    let week = 0;
    let month = 0;
    let year = 0;
    for (const date of set) {
      const d = new Date(date);
      if (date === today()) day += 1;
      if (d >= weekStart) week += 1;
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) month += 1;
      if (d.getFullYear() === now.getFullYear()) year += 1;
    }
    return { day, week, month, year, total: set.size, set };
  };

  // 按所选周期返回已完成次数与目标
  const periodCount = (h: IHabit) => {
    const st = statsFor(h);
    switch (h.goalPeriod ?? 'week') {
      case 'day':
        return { done: st.day, target: h.frequency, label: '今日' };
      case 'month':
        return { done: st.month, target: h.frequency, label: '本月' };
      case 'year':
        return { done: st.year, target: h.frequency, label: '本年' };
      default:
        return { done: st.week, target: h.frequency, label: '本周' };
    }
  };

  // 热力图数据（近 3 个月）
  const heatmap = useMemo(() => {
    const start = startOfMonth(subMonths(new Date(), 2));
    const end = new Date();
    const days: { date: string; count: number }[] = [];
    const d = new Date(start);
    while (d <= end) {
      const key = format(d, 'yyyy-MM-dd');
      const count = data.checkins.filter((c) => c.date === key).length;
      days.push({ date: key, count });
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [data.checkins]);

  const heatColor = (count: number) => {
    if (count === 0) return 'bg-muted';
    if (count === 1) return 'bg-primary/30';
    if (count === 2) return 'bg-primary/60';
    return 'bg-primary';
  };

  const stats = statsHabit ? statsFor(statsHabit) : null;
  const statsDates = stats ? Array.from(stats.set).sort().reverse() : [];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">习惯打卡</h1>
          <p className="text-sm text-muted-foreground">坚持每天的小改变</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 size-4" /> 新建习惯
        </Button>
      </div>

      {/* 习惯列表 */}
      <div className="space-y-3">
        {data.habits.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            还没有习惯，点击右上角新建
          </p>
        ) : (
          data.habits.map((h) => {
            const checked = data.checkins.some((c) => c.habitId === h.id && c.date === today());
            const pc = periodCount(h);
            return (
              <Card key={h.id}>
                <CardContent className="flex items-center gap-3 pt-4">
                  <button
                    onClick={() => void toggleCheck(h.id)}
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      checked ? 'text-white' : 'border',
                    )}
                    style={checked ? { backgroundColor: h.color } : undefined}
                  >
                    {checked && <Check className="size-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {pc.label} {pc.done}/{pc.target} 次 · 连续 {streak(h.id)} 天
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setStatsHabit(h)} aria-label="打卡记录">
                    <BarChart3 className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(h)} aria-label="编辑">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(h.id)} aria-label="删除">
                    <Trash2 className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 已打卡成功（累计：只要成功过就一直显示，写总共几项） */}
      {(() => {
        const doneIds = new Set(data.checkins.map((c) => c.habitId));
        const done = data.habits.filter((h) => doneIds.has(h.id));
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-success">已打卡成功（总共 {done.length} 项）</CardTitle>
            </CardHeader>
            <CardContent>
              {done.length === 0 ? (
                <p className="text-sm text-muted-foreground">还没有打卡成功的习惯，打卡一次就会一直显示在这里</p>
              ) : (
                <ul className="space-y-2">
                  {done.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 text-sm">
                      <span
                        className="flex size-5 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: h.color }}
                      >
                        <Check className="size-3" />
                      </span>
                      <span className="flex-1">{h.name}</span>
                      <span className="text-xs text-success">
                        累计 {data.checkins.filter((c) => c.habitId === h.id).length} 次
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 热力图 */}
      {data.checkins.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">打卡热力图（近3个月）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {heatmap.map((d) => (
                <div key={d.date} className={cn('size-2.5 rounded-[2px]', heatColor(d.count))} title={`${d.date} · ${d.count}次`} />
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>少</span>
              <div className="size-2.5 rounded-[2px] bg-muted" />
              <div className="size-2.5 rounded-[2px] bg-primary/30" />
              <div className="size-2.5 rounded-[2px] bg-primary/60" />
              <div className="size-2.5 rounded-[2px] bg-primary" />
              <span>多</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 新建/编辑习惯 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '修改习惯' : '新建习惯'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>习惯名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：早起喝水" />
            </div>
            <div className="space-y-2">
              <Label>目标周期</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { v: 'day', t: '每天' },
                  { v: 'week', t: '每周' },
                  { v: 'month', t: '每月' },
                  { v: 'year', t: '每年' },
                ] as const).map((o) => (
                  <Button
                    key={o.v}
                    size="sm"
                    variant={goalPeriod === o.v ? 'default' : 'outline'}
                    onClick={() => setGoalPeriod(o.v)}
                  >
                    {o.t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {goalPeriod === 'day' ? '每天' : goalPeriod === 'week' ? '每周' : goalPeriod === 'month' ? '每月' : '每年'}目标次数（可自定义）
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 3, 5, 7].map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={frequency === f ? 'default' : 'outline'}
                    onClick={() => setFrequency(f)}
                  >
                    {f} 次
                  </Button>
                ))}
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  placeholder="自定义"
                  value={[1, 3, 5, 7].includes(frequency) ? '' : frequency}
                  onChange={(e) => setFrequency(Number(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn('size-6 rounded-full', color === c && 'ring-2 ring-primary')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => void onSave()}>
              {editing ? '保存修改' : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 打卡记录统计 */}
      <Dialog open={!!statsHabit} onOpenChange={(o) => !o && setStatsHabit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>「{statsHabit?.name}」打卡记录</DialogTitle>
          </DialogHeader>
          {stats && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-xl font-bold text-primary">{stats.day}</div>
                  <div className="text-xs text-muted-foreground">今日</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xl font-bold text-primary">{stats.week}</div>
                  <div className="text-xs text-muted-foreground">本周</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xl font-bold text-primary">{stats.month}</div>
                  <div className="text-xs text-muted-foreground">本月</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xl font-bold text-primary">{stats.year}</div>
                  <div className="text-xs text-muted-foreground">本年</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">最近打卡日期</Label>
                <div className="flex flex-wrap gap-1">
                  {statsDates.length === 0 ? (
                    <span className="text-sm text-muted-foreground">暂无记录</span>
                  ) : (
                    statsDates.slice(0, 20).map((d) => (
                      <span key={d} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {d}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个习惯？</AlertDialogTitle>
            <AlertDialogDescription>将同时删除其全部打卡记录，不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
