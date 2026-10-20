// 健康与生理期：健康记录（心情自定义）、生理期两步记录（先记开始，结束时点结束）、预测、趋势、编辑/删除
// EXPORTS: HealthPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactECharts from 'echarts-for-react';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { IHealth, IPeriod } from '@/lib/types';

const MOODS = ['开心', '平静', '一般', '低落', '烦躁', '期待', '疲惫', '兴奋'];
const FLOW = ['少', '中', '多'];
const SYMPTOMS = ['痛经', '乏力', '腰酸', '头痛', '情绪低落', '腹胀'];

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function predictNext(periods: IPeriod[]): { nextStart: string; avg: number } | null {
  const valid = periods
    .filter((p) => p.start && p.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (valid.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < valid.length; i++) {
    const gap = daysBetween(valid[i - 1].start, valid[i].start);
    if (gap >= 15 && gap <= 60) intervals.push(gap);
  }
  if (intervals.length === 0) return null;
  const avg = Math.round(intervals.reduce((s, x) => s + x, 0) / intervals.length);
  const last = valid[valid.length - 1].start;
  const next = new Date(new Date(last).getTime() + avg * 86400000);
  return { nextStart: format(next, 'yyyy-MM-dd'), avg };
}

export default function HealthPage() {
  const { data, refresh } = useAllData();
  const [tab, setTab] = useState<'health' | 'period'>('health');

  // 健康记录表单
  const [hDate, setHDate] = useState(today());
  const [sleep, setSleep] = useState('');
  const [weight, setWeight] = useState('');
  const [exercise, setExercise] = useState('');
  const [mood, setMood] = useState('平静');
  const [healthDelete, setHealthDelete] = useState<string | null>(null);

  // 生理期表单：先记开始，结束时点结束
  const [pStart, setPStart] = useState('');
  const [flow, setFlow] = useState('中');
  const [feelings, setFeelings] = useState<string[]>([]);
  const [pNote, setPNote] = useState('');
  const [periodDelete, setPeriodDelete] = useState<string | null>(null);
  const [endFor, setEndFor] = useState<IPeriod | null>(null);
  const [endDate, setEndDate] = useState('');

  const addHealth = async () => {
    const h: IHealth = {
      id: randomId(),
      date: hDate,
      sleep: sleep ? Number(sleep) : undefined,
      weight: weight ? Number(weight) : undefined,
      exercise: exercise ? Number(exercise) : undefined,
      mood,
      createdAt: Date.now(),
    };
    await service.health.put(h);
    toast.success('健康记录已保存');
    setSleep('');
    setWeight('');
    setExercise('');
    void refresh();
  };

  // 第一步：记录开始日期（结束日期留空，标记进行中）
  const startPeriod = async () => {
    if (!pStart) {
      toast.error('请选择开始日期');
      return;
    }
    // 防止重复进行中
    const ongoing = data.periods.some((p) => p.start && !p.end);
    if (ongoing) {
      toast.error('已有一条未结束的生理期，请先结束它');
      return;
    }
    const p: IPeriod = {
      id: randomId(),
      start: pStart,
      end: '',
      flow,
      feelings: feelings.length ? feelings : undefined,
      note: pNote.trim() || undefined,
      createdAt: Date.now(),
    };
    await service.periods.put(p);
    toast.success('已记录开始，结束时点「结束」即可');
    setPStart('');
    setFeelings([]);
    setPNote('');
    void refresh();
  };

  // 第二步：结束进行中的生理期
  const finishPeriod = async () => {
    if (!endFor) return;
    if (!endDate) {
      toast.error('请选择结束日期');
      return;
    }
    if (endDate < endFor.start) {
      toast.error('结束日期不能早于开始日期');
      return;
    }
    await service.periods.put({ ...endFor, end: endDate });
    toast.success('生理期已结束');
    setEndFor(null);
    setEndDate('');
    void refresh();
  };

  const toggleFeeling = (f: string) => {
    setFeelings((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const pred = useMemo(() => predictNext(data.periods), [data.periods]);

  const periodTrend = useMemo(() => {
    const sorted = [...data.periods].filter((p) => p.start && p.end).sort((a, b) => a.start.localeCompare(b.start));
    const recent = sorted.slice(-6);
    return recent.map((p) => ({ name: p.start.slice(5), days: daysBetween(p.start, p.end) + 1 }));
  }, [data.periods]);

  const periodChart = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 16, bottom: 16 },
    xAxis: { type: 'category', data: periodTrend.map((p) => p.name), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      { name: '经期天数', type: 'bar', data: periodTrend.map((p) => p.days), itemStyle: { color: '#C97A8E' }, barMaxWidth: 22 },
    ],
  };

  const healthList = [...data.health].sort((a, b) => b.date.localeCompare(a.date));
  const periodList = [...data.periods].sort((a, b) => (b.start || '').localeCompare(a.start || ''));

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">健康与生理期</h1>
          <p className="text-sm text-muted-foreground">呵护身体每一天</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'health' | 'period')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="health">健康记录</TabsTrigger>
          <TabsTrigger value="period">生理期</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'health' ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">新增记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>日期</Label>
                <Input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>睡眠(小时)</Label>
                  <Input type="number" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7.5" />
                </div>
                <div className="space-y-1">
                  <Label>体重(kg)</Label>
                  <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="52" />
                </div>
                <div className="space-y-1">
                  <Label>运动(分钟)</Label>
                  <Input type="number" value={exercise} onChange={(e) => setExercise(e.target.value)} placeholder="30" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>心情（可自定义）</Label>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMood(m)}
                      className={cn(
                        'rounded-lg border px-2.5 py-1 text-xs',
                        mood === m ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                  <Input
                    className="h-8 w-24 text-xs"
                    placeholder="自定义…"
                    value={MOODS.includes(mood) ? '' : mood}
                    onChange={(e) => {
                      if (e.target.value.trim()) setMood(e.target.value.trim());
                    }}
                  />
                </div>
              </div>
              <Button className="w-full" onClick={() => void addHealth()}>
                保存记录
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">历史记录</CardTitle>
            </CardHeader>
            <CardContent>
              {healthList.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">暂无记录</p>
              ) : (
                <ul className="divide-y">
                  {healthList.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{h.date}</span>
                        <span className="ml-2 text-muted-foreground">
                          {h.sleep ? `${h.sleep}h ` : ''}
                          {h.weight ? `${h.weight}kg ` : ''}
                          {h.exercise ? `${h.exercise}min ` : ''}
                          {h.mood ? `${h.mood}` : ''}
                        </span>
                      </div>
                      <button onClick={() => setHealthDelete(h.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {pred && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 text-center">
                <div className="text-sm text-muted-foreground">预计下次生理期</div>
                <div className="mt-1 text-2xl font-semibold text-primary">{pred.nextStart}</div>
                <div className="mt-1 text-xs text-muted-foreground">平均周期 {pred.avg} 天</div>
              </CardContent>
            </Card>
          )}
          {!pred && data.periods.filter((p) => p.start && p.end).length > 0 && (
            <Card>
              <CardContent className="pt-4 text-center text-sm text-muted-foreground">
                记录满 2 次正常周期后自动预测
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">开始新的生理期</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>开始日期</Label>
                <Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>经期流量</Label>
                <div className="flex gap-1">
                  {FLOW.map((f) => (
                    <Button key={f} size="sm" variant={flow === f ? 'default' : 'outline'} onClick={() => setFlow(f)}>
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>身体感受</Label>
                <div className="flex flex-wrap gap-1">
                  {SYMPTOMS.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={feelings.includes(s) ? 'default' : 'outline'}
                      onClick={() => toggleFeeling(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label>备注</Label>
                <Input value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="选填" />
              </div>
              <Button className="w-full" onClick={() => void startPeriod()}>
                记录开始
              </Button>
            </CardContent>
          </Card>

          {/* 进行中的生理期（可结束） */}
          {periodList.filter((p) => !p.end).length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">进行中的生理期</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {periodList.filter((p) => !p.end).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                    <span className="size-2.5 rounded-full bg-destructive" />
                    <span className="flex-1">{p.start} 开始</span>
                    <Button size="sm" variant="outline" onClick={() => { setEndFor(p); setEndDate(p.start); }}>
                      <Check className="mr-1 size-4" /> 结束
                    </Button>
                    <button onClick={() => setPeriodDelete(p.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {periodTrend.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">近6个月周期趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ReactECharts option={periodChart} style={{ height: 180 }} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">历史记录</CardTitle>
            </CardHeader>
            <CardContent>
              {periodList.filter((p) => p.end).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">暂无已结束记录</p>
              ) : (
                <ul className="divide-y">
                  {periodList.filter((p) => p.end).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{p.start} ~ {p.end}</span>
                        <div className="text-xs text-muted-foreground">
                          流量：{p.flow}
                          {p.feelings?.length ? ` · ${p.feelings.join('、')}` : ''}
                          {p.note ? ` · ${p.note}` : ''}
                        </div>
                      </div>
                      <button onClick={() => setPeriodDelete(p.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 结束生理期对话框 */}
      <Dialog open={!!endFor} onOpenChange={(o) => !o && setEndFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>结束生理期（{endFor?.start} 开始）</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>结束日期</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => void finishPeriod()}>
              确认结束
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!healthDelete} onOpenChange={(o) => !o && setHealthDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条健康记录？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHealthDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (healthDelete) void service.health.del(healthDelete); setHealthDelete(null); void refresh(); }}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!periodDelete} onOpenChange={(o) => !o && setPeriodDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条生理期记录？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPeriodDelete(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (periodDelete) void service.periods.del(periodDelete); setPeriodDelete(null); void refresh(); }}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
