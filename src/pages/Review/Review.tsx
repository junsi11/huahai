// 回忆复盘：日/周/月/年，复盘情况 + 复盘感想都保存，按周期分类
// EXPORTS: ReviewPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, Timer, ListTodo, Repeat, Save, Trash2, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReactECharts from 'echarts-for-react';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import type { IReview } from '@/lib/types';

type Period = 'day' | 'week' | 'month' | 'year';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function ReviewPage() {
  const { data, refresh } = useAllData();
  const [period, setPeriod] = useState<Period>('week');

  const now = new Date();
  const dayKey = today();
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const monthKey = format(now, 'yyyy-MM');
  const yearKey = format(now, 'yyyy');

  const key =
    period === 'day'
      ? `day-${dayKey}`
      : period === 'week'
        ? `week-${weekStart}`
        : period === 'month'
          ? `month-${monthKey}`
          : `year-${yearKey}`;

  const inRange = (d: string) => {
    switch (period) {
      case 'day':
        return d === dayKey;
      case 'week':
        return d >= weekStart && d <= weekEnd;
      case 'month':
        return d.slice(0, 7) === monthKey;
      case 'year':
        return d.slice(0, 4) === yearKey;
    }
  };

  // 聚合数据
  const tx = data.transactions.filter((t) => inRange(t.date));
  const income = tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const focus = data.pomodoros.filter((p) => inRange(p.date)).reduce((s, p) => s + p.focusMinutes, 0);
  const doneTasks = data.tasks.filter((t) => t.done && t.due && inRange(t.due.slice(0, 10))).length;
  const habitDays = data.checkins.filter((c) => inRange(c.date)).length;

  // 周复盘每日趋势
  const daily = useMemo(() => {
    if (period !== 'week') return null;
    const days = eachDayOfInterval({ start: new Date(weekStart), end: new Date(weekEnd) });
    return days.map((d) => {
      const k = format(d, 'yyyy-MM-dd');
      const exp = data.transactions.filter((t) => t.date === k && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const foc = data.pomodoros.filter((p) => p.date === k).reduce((s, p) => s + p.focusMinutes, 0);
      return { day: format(d, 'EEEEE'), expense: exp, focus: foc };
    });
  }, [data, period, weekStart, weekEnd]);

  const weekChart = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['支出(元)', '专注(分)'], top: 0 },
    grid: { left: 40, right: 16, top: 32, bottom: 16 },
    xAxis: { type: 'category', data: daily?.map((d) => d.day) ?? [], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      { name: '支出(元)', type: 'bar', data: daily?.map((d) => d.expense) ?? [], itemStyle: { color: '#E79BB0' }, barMaxWidth: 18 },
      { name: '专注(分)', type: 'line', data: daily?.map((d) => d.focus) ?? [], itemStyle: { color: '#5D8A72' } },
    ],
  };

  const existing = data.reviews.find((r) => r.key === key);
  const [situation, setSituation] = useState(existing?.situation ?? '');
  const [summary, setSummary] = useState(existing?.summary ?? '');

  // 切换周期时载入对应已存内容
  const switchPeriod = (p: Period) => {
    setPeriod(p);
    const k =
      p === 'day'
        ? `day-${dayKey}`
        : p === 'week'
          ? `week-${weekStart}`
          : p === 'month'
            ? `month-${monthKey}`
            : `year-${yearKey}`;
    const ex = data.reviews.find((r) => r.key === k);
    setSituation(ex?.situation ?? '');
    setSummary(ex?.summary ?? '');
  };

  const saveReview = async () => {
    const r: IReview = {
      id: existing?.id ?? `r-${key}`,
      period,
      key,
      situation: situation.trim() || undefined,
      summary: summary.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await service.reviews.put(r);
    toast.success('回忆复盘已保存');
    void refresh();
  };

  // 载入历史复盘到上方编辑框
  const loadReview = (r: IReview) => {
    setPeriod(r.period);
    setSituation(r.situation ?? '');
    setSummary(r.summary ?? '');
  };

  const deleteReview = async (id: string) => {
    await service.reviews.del(id);
    toast.success('已删除');
    void refresh();
  };

  // 当前周期类型下的历史复盘（倒序）
  const historyList = useMemo(
    () =>
      data.reviews
        .filter((r) => r.period === period)
        .sort((a, b) => b.createdAt - a.createdAt),
    [data.reviews, period],
  );

  const periodTag = (r: IReview) => {
    const raw = r.key.replace(/^(day|week|month|year)-/, '');
    switch (r.period) {
      case 'day':
        return raw;
      case 'week':
        return `周起 ${raw}`;
      case 'month':
        return `${raw} 月`;
      case 'year':
        return `${raw} 年`;
    }
  };

  const rangeLabel =
    period === 'day'
      ? dayKey
      : period === 'week'
        ? `${weekStart} ~ ${weekEnd}`
        : period === 'month'
          ? `${monthKey} 月`
          : `${yearKey} 年`;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">回忆复盘</h1>
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      </div>

      <Tabs value={period} onValueChange={(v) => switchPeriod(v as Period)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="day">日复盘</TabsTrigger>
          <TabsTrigger value="week">周复盘</TabsTrigger>
          <TabsTrigger value="month">月复盘</TabsTrigger>
          <TabsTrigger value="year">年复盘</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 汇总统计 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">¥{expense}</div>
              <div className="text-xs text-muted-foreground">支出 / 收入 ¥{income}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Timer className="size-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">{focus} 分</div>
              <div className="text-xs text-muted-foreground">专注时长</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ListTodo className="size-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">{doneTasks} 项</div>
              <div className="text-xs text-muted-foreground">完成任务</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Repeat className="size-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">{habitDays} 次</div>
              <div className="text-xs text-muted-foreground">习惯打卡</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 周趋势 */}
      {period === 'week' && daily && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">每日趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactECharts option={weekChart} style={{ height: 200 }} />
          </CardContent>
        </Card>
      )}

      {/* 复盘情况 + 复盘感想 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">复盘情况</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="这一周期发生了什么？做了哪些事、完成了什么…"
            rows={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">复盘感想</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="回顾这个周期，写下你的总结与心得…"
            rows={4}
          />
          <Button className="w-full" onClick={() => void saveReview()}>
            <Save className="mr-1 size-4" /> 保存回忆复盘
          </Button>
        </CardContent>
      </Card>

      {/* 历史复盘：按当前日/周/月/年查看已保存记录 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" /> 历史{period === 'day' ? '日' : period === 'week' ? '周' : period === 'month' ? '月' : '年'}复盘（{historyList.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyList.length === 0 ? (
            <p className="text-sm text-muted-foreground">该周期类型还没有保存过的复盘</p>
          ) : (
            historyList.map((r) => (
              <div key={r.id} className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {periodTag(r)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => loadReview(r)}>
                      载入查看
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => void deleteReview(r.id)} aria-label="删除">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {r.situation && (
                  <p className="whitespace-pre-wrap text-sm"><span className="text-muted-foreground">情况：</span>{r.situation}</p>
                )}
                {r.summary && (
                  <p className="mt-1 whitespace-pre-wrap text-sm"><span className="text-muted-foreground">感想：</span>{r.summary}</p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
