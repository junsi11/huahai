// 番茄专注：倒计时控制、自定义时长、专注小标题、到点声音提醒、专注时长饼图（日/周/月/年）
// EXPORTS: PomodoroPage (default)

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play, Pause, X, Check, Timer, Coffee, Settings2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactECharts from 'echarts-for-react';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format, startOfWeek, addDays } from 'date-fns';
import { playBeep, notify } from '@/lib/notification';
import type { IPomodoro } from '@/lib/types';

type Phase = 'focus' | 'short' | 'long' | 'idle';
type RangeKey = 'day' | 'week' | 'month' | 'year';

export default function PomodoroPage() {
  const { data, refresh } = useAllData();
  const [focusLen, setFocusLen] = useState(25);
  const [shortLen, setShortLen] = useState(5);
  const [longLen, setLongLen] = useState(15);
  const [focusLabel, setFocusLabel] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [range, setRange] = useState<RangeKey>('week');

  const totalSecs =
    phase === 'focus' ? focusLen * 60 : phase === 'short' ? shortLen * 60 : phase === 'long' ? longLen * 60 : 0;

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const start = () => {
    if (phase === 'idle') setPhase('focus');
    setRunning(true);
    stopTimer();
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          stopTimer();
          setRunning(false);
          if (phase === 'focus') {
            void recordFocus();
            // 到点：声音 + 通知
            playBeep();
            notify('番茄专注完成', `完成 ${focusLen} 分钟专注`);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const pause = () => {
    setRunning(false);
    stopTimer();
  };

  const resetPhase = (next: Phase, secs: number) => {
    stopTimer();
    setRunning(false);
    setPhase(next);
    setSecondsLeft(secs);
  };

  const abandon = () => {
    resetPhase('idle', 0);
  };

  const recordFocus = async () => {
    const rec: IPomodoro = {
      id: randomId(),
      date: format(new Date(), 'yyyy-MM-dd'),
      focusMinutes: focusLen,
      cycles: 1,
      label: focusLabel.trim() || undefined,
      createdAt: Date.now(),
    };
    await service.pomodoros.put(rec);
    toast.success('完成一个番茄！休息一下吧');
    void refresh();
  };

  const finish = () => {
    if (phase === 'focus') void recordFocus();
    resetPhase('short', shortLen * 60);
    toast.info('进入短休息');
  };

  // 显示时间
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  // 总专注时长（全部）
  const totalFocus = data.pomodoros.reduce((s, p) => s + p.focusMinutes, 0);

  // 按范围聚合饼图
  const rangeData = useMemo(() => {
    const now = new Date();
    const todayKey = format(now, 'yyyy-MM-dd');
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const monthKey = format(now, 'yyyy-MM');
    const yearKey = format(now, 'yyyy');
    let list = data.pomodoros;
    if (range === 'day') list = list.filter((p) => p.date === todayKey);
    else if (range === 'week') list = list.filter((p) => p.date >= weekStart);
    else if (range === 'month') list = list.filter((p) => p.date.slice(0, 7) === monthKey);
    else list = list.filter((p) => p.date.slice(0, 4) === yearKey);
    // 按 label 聚合
    const map = new Map<string, number>();
    for (const p of list) {
      const key = p.label || '未分类';
      map.set(key, (map.get(key) ?? 0) + p.focusMinutes);
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return arr;
  }, [data.pomodoros, range]);

  const rangeFocus = rangeData.reduce((s, d) => s + d.value, 0);

  const pieOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data: rangeData.length
          ? rangeData
          : [{ name: '暂无数据', value: 1, itemStyle: { color: '#eee' } }],
        label: { fontSize: 11 },
      },
    ],
  };

  // 周柱状趋势
  const weekData = (() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const key = format(d, 'yyyy-MM-dd');
      const mins = data.pomodoros
        .filter((p) => p.date === key)
        .reduce((s, p) => s + p.focusMinutes, 0);
      return { day: format(d, 'EEEE', { weekStartsOn: 1 }), mins };
    });
    return days;
  })();

  const weekBarOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 16, bottom: 16 },
    xAxis: { type: 'category', data: weekData.map((d) => d.day), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      { name: '专注分钟', type: 'bar', data: weekData.map((d) => d.mins), itemStyle: { color: '#E79BB0' }, barMaxWidth: 22 },
    ],
  };

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todayRecs = data.pomodoros.filter((p) => p.date === todayKey);
  const todayFocus = todayRecs.reduce((s, p) => s + p.focusMinutes, 0);
  const todayCycles = todayRecs.reduce((s, p) => s + p.cycles, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">番茄专注</h1>
          <p className="text-sm text-muted-foreground">
            今日 {todayFocus} 分钟 · {todayCycles} 个 · 累计 {totalFocus} 分钟
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-1 size-4" /> 设置
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>专注设置</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>本次专注内容（如：学习英语）</Label>
                <Input placeholder="选填" value={focusLabel} onChange={(e) => setFocusLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>专注时长（分钟）</Label>
                <Input type="number" value={focusLen} onChange={(e) => setFocusLen(Number(e.target.value) || 25)} />
              </div>
              <div className="space-y-2">
                <Label>短休息（分钟）</Label>
                <Input type="number" value={shortLen} onChange={(e) => setShortLen(Number(e.target.value) || 5)} />
              </div>
              <div className="space-y-2">
                <Label>长休息（分钟）</Label>
                <Input type="number" value={longLen} onChange={(e) => setLongLen(Number(e.target.value) || 15)} />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (!running) resetPhase(phase, totalSecs || focusLen * 60);
                  toast.success('设置已保存');
                }}
              >
                应用
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 主计时器 */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {phase === 'focus' && <><Timer className="size-4 text-primary" />专注中{focusLabel ? `：${focusLabel}` : ''}</>}
            {phase === 'short' && <><Coffee className="size-4" />短休息</>}
            {phase === 'long' && <><Coffee className="size-4" />长休息</>}
            {phase === 'idle' && (focusLabel ? `准备专注：${focusLabel}` : '准备开始')}
          </div>
          <div className="text-6xl font-bold tabular-nums tracking-tight text-primary">
            {phase === 'idle' ? `${focusLen}:00` : `${mm}:${ss}`}
          </div>
          <div className="flex gap-3">
            {running ? (
              <Button variant="secondary" onClick={pause}>
                <Pause className="mr-1 size-4" /> 暂停
              </Button>
            ) : (
              <Button onClick={start}>
                <Play className="mr-1 size-4" /> 开始
              </Button>
            )}
            <Button variant="outline" onClick={finish} disabled={phase === 'idle'}>
              <Check className="mr-1 size-4" /> 结束
            </Button>
            <Button variant="ghost" onClick={abandon} disabled={phase === 'idle'}>
              <X className="mr-1 size-4" /> 放弃
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            提示：专注结束会响铃提醒并自动记录，支持按日/周/月/年查看专注分布
          </p>
        </CardContent>
      </Card>

      {/* 专注时长分布（饼图 + 范围切换） */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">专注内容分布</CardTitle>
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="day">日</TabsTrigger>
              <TabsTrigger value="week">周</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
              <TabsTrigger value="year">年</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            该范围专注总时长：{rangeFocus} 分钟
          </p>
          <ReactECharts option={pieOption} style={{ height: 200 }} />
        </CardContent>
      </Card>

      {/* 周趋势 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">本周专注趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts option={weekBarOption} style={{ height: 180 }} />
        </CardContent>
      </Card>
    </div>
  );
}
