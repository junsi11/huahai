// 综合日历：月视图、多源聚合、优先级排序、事件（颜色/图片/提醒）、记账合并、编辑/删除
// EXPORTS: CalendarPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Wallet, ListTodo, BookOpen, Repeat, HeartPulse, PenLine, Timer, ImagePlus, X, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { requestNotifyPermission, notify } from '@/lib/notification';
import type { ICalendarEvent } from '@/lib/types';

const COLORS = ['#E79BB0', '#5D8A72', '#7B9AE5', '#F4A259', '#B080E0', '#C97A8E', '#4A90D9', '#E67E5A', '#9C6ADE', '#2FBF9E', '#E74C8B', '#F5B84C'];

const PRIORITIES = [
  { value: 1, label: '重要且紧急', color: '#E53935' },
  { value: 2, label: '紧急不重要', color: '#F5B84C' },
  { value: 3, label: '重要不紧急', color: '#4A90D9' },
  { value: 4, label: '不重要不紧急', color: '#9C9C9C' },
  { value: 5, label: '记账', color: '#5D8A72' },
];

// 公历主要节日（仅节日当天，不含调休）
const HOLIDAYS: Record<string, string> = {
  '2026-01-01': '元旦',
  '2026-02-16': '除夕',
  '2026-02-17': '春节',
  '2026-02-18': '初二',
  '2026-02-19': '初三',
  '2026-04-04': '清明',
  '2026-05-01': '劳动节',
  '2026-06-19': '端午',
  '2026-09-25': '中秋',
  '2026-10-01': '国庆',
  '2026-10-02': '国庆',
  '2026-10-03': '国庆',
};

function fmtDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function CalendarPage() {
  const { data, refresh } = useAllData();
  const [cur, setCur] = useState(() => new Date());
  const [selected, setSelected] = useState(() => fmtDate(new Date()));
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ICalendarEvent | null>(null);
  // 事件表单
  const [evTitle, setEvTitle] = useState('');
  const [evColor, setEvColor] = useState('#E79BB0');
  const [evPriority, setEvPriority] = useState<number>(1);
  const [evRemind, setEvRemind] = useState(false);
  const [evImage, setEvImage] = useState<string | null>(null);

  const year = cur.getFullYear();
  const month = cur.getMonth();
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // 周一=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = fmtDate(new Date());

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dayKey = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const prev = () => setCur(new Date(year, month - 1, 1));
  const next = () => setCur(new Date(year, month + 1, 1));

  // 聚合某日事项
  const aggregateFor = (key: string) => {
    const tx = data.transactions.filter((t) => t.date === key);
    const tasks = data.tasks.filter((t) => t.due?.slice(0, 10) === key);
    const diaries = data.diaries.filter((d) => d.date === key);
    const memos = data.memos.filter((m) => m.date === key);
    const habits = data.checkins.filter((c) => c.date === key).length;
    const health = data.health.find((h) => h.date === key);
    const pomodoros = data.pomodoros.filter((p) => p.date === key);
    const events = data.events.filter((e) => e.date === key);
    const period = data.periods.find((p) => key >= p.start && key <= p.end);
    return { tx, tasks, diaries, memos, habits, health, pomodoros, events, period };
  };

  const sel = aggregateFor(selected);

  const dotCount = (key: string) => {
    const a = aggregateFor(key);
    return (
      a.tx.length +
      a.tasks.length +
      a.diaries.length +
      a.memos.length +
      a.habits +
      (a.health ? 1 : 0) +
      a.pomodoros.length +
      a.events.length +
      (a.period ? 1 : 0)
    );
  };

  // 打开新建
  const openAdd = () => {
    setEditing(null);
    setEvTitle('');
    setEvColor('#E79BB0');
    setEvPriority(1);
    setEvRemind(false);
    setEvImage(null);
    setOpen(true);
  };
  // 打开编辑
  const openEdit = (e: ICalendarEvent) => {
    setEditing(e);
    setEvTitle(e.title);
    setEvColor(e.color ?? '#E79BB0');
    setEvPriority(e.priority ?? 1);
    setEvRemind(e.remind ?? false);
    setEvImage(e.image ?? null);
    setOpen(true);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(f);
  };
  function setImage(url: string) {
    setEvImage(url);
  }

  const saveEvent = async () => {
    if (!evTitle.trim()) {
      toast.error('请输入事件名称');
      return;
    }
    const base = {
      date: selected,
      title: evTitle.trim(),
      color: evColor,
      priority: evPriority,
      remind: evRemind,
      image: evImage ?? undefined,
    };
    if (editing) {
      await service.events.put({ ...editing, ...base });
      toast.success('事件已修改');
    } else {
      await service.events.put({ ...base, id: randomId(), createdAt: Date.now() });
      toast.success('事件已创建');
    }
    setOpen(false);
    void refresh();
  };

  const onDeleteEvent = async () => {
    if (!deleteId) return;
    await service.events.del(deleteId);
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  // 当天事件按优先级排序
  const sortedEvents = useMemo(() => {
    return [...sel.events].sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4));
  }, [sel.events]);

  // 当天提醒检查（进入页面时）
  useMemo(() => {
    requestNotifyPermission();
    const todayEvents = data.events.filter((e) => e.date === today && e.remind);
    if (todayEvents.length > 0) {
      notify('花海日历提醒', `今天有 ${todayEvents.length} 个待办事项`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const legend = [
    { label: '生理期', color: '#C97A8E' },
    { label: '重要且紧急', color: '#E53935' },
    { label: '紧急不重要', color: '#F5B84C' },
    { label: '重要不紧急', color: '#4A90D9' },
    { label: '不重要不紧急', color: '#9C9C9C' },
    { label: '记账', color: '#5D8A72' },
  ];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">日历</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prev}>
            <ChevronLeft className="size-5" />
          </Button>
          <span className="w-24 text-center font-medium">{year}年{month + 1}月</span>
          <Button variant="ghost" size="icon" onClick={next}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center text-xs text-muted-foreground">
            {['一', '二', '三', '四', '五', '六', '日'].map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (cell === null) return <div key={i} />;
              const key = dayKey(cell);
              const count = dotCount(key);
              const period = data.periods.find((p) => key >= p.start && key <= p.end);
              const isSelected = key === selected;
              const isToday = key === today;
              const holiday = HOLIDAYS[key];
              const dayEvents = data.events.filter((e) => e.date === key);
              const topPri = dayEvents.length
                ? PRIORITIES.find((p) => p.value === Math.min(...dayEvents.map((e) => e.priority ?? 4)))
                : null;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(key)}
                  className={cn(
                    'relative flex h-12 flex-col items-center justify-center rounded-lg text-sm transition-colors',
                    isSelected && 'bg-primary/15 text-primary',
                    period && 'bg-[#C97A8E]/30',
                  )}
                >
                  <span className={cn(isToday && 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground')}>
                    {cell}
                  </span>
                  {holiday && (
                    <span className={cn('text-[8px] leading-none', isToday ? 'text-white' : 'text-red-500')}>
                      {holiday}
                    </span>
                  )}
                  {count > 0 && (
                    <span className="absolute bottom-0.5 flex gap-0.5">
                      {topPri ? (
                        <span className="size-1 rounded-full" style={{ backgroundColor: topPri.color }} />
                      ) : (
                        <span className="size-1 rounded-full bg-primary" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 选中日期聚合 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">{selected} 事项</CardTitle>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 size-4" /> 新建事件
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sel.period && (
            <div className="flex items-center gap-2 rounded-lg bg-[#C97A8E]/15 px-3 py-2 text-sm">
              <HeartPulse className="size-4 text-[#C97A8E]" /> 生理期区间
            </div>
          )}
          {/* 事件按优先级排序 */}
          {sortedEvents.map((e) => {
            const pri = PRIORITIES.find((p) => p.value === (e.priority ?? 4));
            return (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{e.title}</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{pri?.label ?? '普通'}</span>
                    {e.remind && <Bell className="size-3" />}
                    {e.image && '· 📷'}
                  </div>
                </div>
                {e.image && (
                  <img src={e.image} alt="ev" className="h-8 w-8 rounded object-cover" />
                )}
                <button onClick={() => openEdit(e)} className="text-muted-foreground hover:text-primary" aria-label="编辑">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => setDeleteId(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="删除">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
          {/* 记账聚合为一项 */}
          {sel.tx.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-[#5D8A72]/30 bg-[#5D8A72]/10 px-3 py-2 text-sm">
              <Wallet className="size-4 text-[#5D8A72]" />
              <span className="flex-1">记账 {sel.tx.length} 笔</span>
              <span className="text-xs text-muted-foreground">
                <span className="text-success">+¥{sel.tx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)}</span>
                {' '}
                <span className="text-destructive">-¥{sel.tx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)}</span>
              </span>
            </div>
          )}
          {sel.tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm">
              <ListTodo className="size-4 text-primary" />
              <span className={cn('flex-1', t.done && 'line-through text-muted-foreground')}>{t.title}</span>
              <span className="text-xs text-muted-foreground">{t.done ? '已完成' : '待办'}</span>
            </div>
          ))}
          {sel.diaries.map((d) => (
            <div key={d.id} className="flex items-center gap-2 text-sm">
              <BookOpen className="size-4 text-primary" />
              <span className="flex-1 truncate">{d.content.slice(0, 30)}</span>
            </div>
          ))}
          {sel.memos.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <PenLine className="size-4 text-primary" />
              <span className="flex-1">{m.title}</span>
            </div>
          ))}
          {sel.habits > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Repeat className="size-4 text-primary" />
              <span className="flex-1">习惯打卡 {sel.habits} 项</span>
            </div>
          )}
          {sel.pomodoros.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Timer className="size-4 text-primary" />
              <span className="flex-1">
                番茄 {sel.pomodoros.reduce((s, p) => s + p.focusMinutes, 0)} 分钟
              </span>
            </div>
          )}
          {sel.health && (
            <div className="flex items-center gap-2 text-sm">
              <HeartPulse className="size-4 text-primary" />
              <span className="flex-1">健康记录：{sel.health.mood ?? '—'} {sel.health.sleep ? `· ${sel.health.sleep}h` : ''}</span>
            </div>
          )}
          {Object.values({
            tx: sel.tx.length,
            tasks: sel.tasks.length,
            diaries: sel.diaries.length,
            memos: sel.memos.length,
            habits: sel.habits,
            health: sel.health ? 1 : 0,
            pomodoros: sel.pomodoros.length,
            events: sel.events.length,
            period: sel.period ? 1 : 0,
          }).every((v) => v === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">这一天暂无记录</p>
          )}
        </CardContent>
      </Card>

      {/* 新建/编辑事件对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '修改事件' : `新建事件（${selected}）`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>事件名称</Label>
              <Input value={evTitle} onChange={(e) => setEvTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>优先级</Label>
              <Select value={String(evPriority)} onValueChange={(v) => setEvPriority(Number(v))}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEvColor(c)}
                    className={cn('size-6 rounded-full', evColor === c && 'ring-2 ring-primary ring-offset-1')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>配图</Label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                  <ImagePlus className="size-4" />
                  选择图片
                  <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
                </label>
                {evImage && (
                  <div className="relative">
                    <img src={evImage} alt="ev" className="h-12 w-12 rounded-lg object-cover" />
                    <button
                      onClick={() => setImage(null)}
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                      aria-label="移除"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex items-center gap-2 text-sm"><Bell className="size-4" /> 本地提醒</span>
              <Switch checked={evRemind} onCheckedChange={setEvRemind} />
            </div>
            <Button className="w-full" onClick={() => void saveEvent()}>
              {editing ? '保存修改' : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个事件？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDeleteEvent()}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
