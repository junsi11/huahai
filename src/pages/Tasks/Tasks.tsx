// 任务管理：创建、筛选、完成、删除
// EXPORTS: TasksPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Check, Flag, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ITask } from '@/lib/types';

const PRIORITY_META = {
  high: { label: '高', color: 'text-destructive' },
  medium: { label: '中', color: 'text-warning' },
  low: { label: '低', color: 'text-muted-foreground' },
};

export default function TasksPage() {
  const { data, refresh } = useAllData();
  const [filter, setFilter] = useState<'today' | 'week' | 'all'>('today');
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 表单
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [remind, setRemind] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const wkStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const wkEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const filtered = useMemo(() => {
    const list = [...data.tasks].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (b.due ?? '').localeCompare(a.due ?? '');
    });
    if (filter === 'today') return list.filter((t) => t.due?.slice(0, 10) === today);
    if (filter === 'week')
      return list.filter((t) => {
        const d = t.due?.slice(0, 10) ?? '';
        return d >= wkStart && d <= wkEnd;
      });
    return list;
  }, [data.tasks, filter, today, wkStart, wkEnd]);

  const onAdd = async () => {
    if (!title.trim()) {
      toast.error('请输入任务标题');
      return;
    }
    const task: ITask = {
      id: randomId(),
      title: title.trim(),
      description: desc.trim() || undefined,
      due: due || undefined,
      priority,
      remind,
      done: false,
      createdAt: Date.now(),
    };
    await service.tasks.put(task);
    toast.success('任务已创建');
    setTitle('');
    setDesc('');
    setDue('');
    setPriority('medium');
    setRemind(false);
    setOpen(false);
    void refresh();
  };

  const toggleDone = async (t: ITask) => {
    await service.tasks.put({ ...t, done: !t.done });
    void refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await service.tasks.del(deleteId);
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">任务</h1>
          <p className="text-sm text-muted-foreground">
            待办 {data.tasks.filter((t) => !t.done).length} · 已完成 {data.tasks.filter((t) => t.done).length}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-4" /> 新建任务
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建任务</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>标题</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="任务标题" />
              </div>
              <div className="space-y-2">
                <Label>描述</Label>
                <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="选填" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>截止时间</Label>
                  <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>优先级</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as ITask['priority'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="text-sm">本地提醒</span>
                </div>
                <Switch checked={remind} onCheckedChange={setRemind} />
              </div>
              <Button className="w-full" onClick={() => void onAdd()}>
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">今日</TabsTrigger>
          <TabsTrigger value="week">本周</TabsTrigger>
          <TabsTrigger value="all">全部</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无任务，点击右上角新建
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => {
                const pm = PRIORITY_META[t.priority];
                const overdue = t.due && t.due.slice(0, 10) < today && !t.done;
                return (
                  <li key={t.id} className="flex items-start gap-3 py-3">
                    <button
                      onClick={() => void toggleDone(t)}
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                        t.done ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                      )}
                      aria-label="完成"
                    >
                      {t.done && <Check className="size-3" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn('text-sm font-medium', t.done && 'text-muted-foreground line-through')}>
                        {t.title}
                      </div>
                      {t.description && <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Flag className={cn('size-3', pm.color)} />
                        <span className={pm.color}>{pm.label}</span>
                        {t.due && (
                          <span className={cn(overdue && 'font-medium text-destructive')}>
                            截止 {t.due.slice(5, 10).replace('-', '月')}日 {t.due.slice(11, 16)}
                          </span>
                        )}
                        {t.remind && (
                          <span className="flex items-center gap-1 text-primary">
                            <Clock className="size-3" /> 提醒
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setDeleteId(t.id)} className="text-muted-foreground hover:text-destructive" aria-label="删除">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
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
