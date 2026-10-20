// 首页仪表盘：多卡片总览，支持显隐与排序（配置存 localStorage）
// EXPORTS: DashboardPage (default)

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Timer,
  ListTodo,
  Repeat,
  HeartPulse,
  Target,
  CalendarClock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUp,
  ArrowDown,
  StretchHorizontal,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import useAllData from '@/lib/use-all-data';
import { store } from '@/lib/localstore';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';
import { useAuth } from '@/lib/auth-context';
import EasterEgg from '@/components/EasterEgg';
import { useOrientationBg } from '@/lib/use-orientation-bg';

const BASE = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '') + '/';

// 公历主要节日（用于日历标注；仅节日当天，不含调休）
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

interface ICardConf {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  visible: boolean;
  order: number;
  span: number; // 1=半宽 2=整行
}

const DEFAULT_CONF: ICardConf[] = [
  { key: 'ledger', label: '记账', icon: Wallet, visible: true, order: 0, span: 1 },
  { key: 'pomodoro', label: '番茄专注', icon: Timer, visible: true, order: 1, span: 1 },
  { key: 'tasks', label: '今日任务', icon: ListTodo, visible: true, order: 2, span: 1 },
  { key: 'countdown', label: '倒计时', icon: CalendarClock, visible: true, order: 3, span: 1 },
  { key: 'habits', label: '习惯打卡', icon: Repeat, visible: true, order: 4, span: 1 },
  { key: 'health', label: '健康心情', icon: HeartPulse, visible: true, order: 5, span: 1 },
  { key: 'goals', label: '目标追踪', icon: Target, visible: true, order: 6, span: 1 },
  { key: 'calendar', label: '日历预览', icon: CalendarDays, visible: true, order: 7, span: 1 },
];

// 卡片短按进入的对应页面（倒计时并入目标页）
const CARD_ROUTE: Record<string, string> = {
  ledger: '/ledger',
  pomodoro: '/pomodoro',
  tasks: '/tasks',
  habits: '/habits',
  health: '/health',
  goals: '/goals',
  countdown: '/goals',
  calendar: '/calendar',
};

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
function monthKey(d: string): string {
  return d.slice(0, 7);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data } = useAllData();
  const { accountId } = useAuth();
  const bg = useOrientationBg();
  const [welcomeClicks, setWelcomeClicks] = useState(0);
  const [noseClicks, setNoseClicks] = useState(0);
  const [egg, setEgg] = useState<{ src: string; text?: string } | null>(null);
  // 生理期当日手动标记（红=已来 / 绿=未来），存本地覆盖自动判断
  const [periodMark, setPeriodMark] = useState<'in' | 'out' | null>(() =>
    store.get<'in' | 'out' | null>(`period_mark_${today()}`, null),
  );

  // 卡片布局（顺序/大小/显隐），长按拖动或箭头移动，半宽/整行切换，存本地
  type LayoutMap = Record<string, { order: number; span: number; visible: boolean }>;
  const [layout, setLayout] = useState<LayoutMap>(() => {
    const vis = store.get<Record<string, boolean>>('dash_cards', {});
    const lay = store.get<Record<string, { order: number; span: number }>>('dash_layout', {});
    const m: LayoutMap = {};
    DEFAULT_CONF.forEach((c) => {
      m[c.key] = { order: lay[c.key]?.order ?? c.order, span: lay[c.key]?.span ?? 1, visible: vis[c.key] ?? c.visible };
    });
    return m;
  });
  const [dragKey, setDragKey] = useState<string | null>(null);
  // 长按才显示某张卡的移动/大小工具；默认隐藏
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 是否处于长按（长按只出工具条，不跳转；短按才进详情页）
  const longPressRef = useRef(false);
  const startPress = (key: string) => {
    longPressRef.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressRef.current = true;
      setActiveCard(key);
    }, 500);
  };
  const endPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };
  // 短按卡片进入对应工具页；长按已激活工具条则不跳转
  const onCardClick = (key: string) => {
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }
    const to = CARD_ROUTE[key];
    if (to) navigate(to);
  };

  const persistLayout = (m: LayoutMap) => {
    store.set('dash_layout', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { order: v.order, span: v.span }])));
    store.set('dash_cards', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.visible])));
  };

  const confs = useMemo<ICardConf[]>(
    () =>
      DEFAULT_CONF.filter((c) => layout[c.key]?.visible)
        .map((c) => ({ ...c, order: layout[c.key].order, span: layout[c.key].span }))
        .sort((a, b) => a.order - b.order),
    [layout],
  );

  const reorder = (keys: string[]) => {
    setLayout((prev) => {
      const n: LayoutMap = {};
      keys.forEach((k, i) => { n[k] = { ...prev[k], order: i }; });
      persistLayout(n);
      return n;
    });
  };
  const moveCard = (key: string, dir: number) => {
    const keys = confs.map((c) => c.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    reorder(keys);
  };
  const toggleSpan = (key: string) => {
    setLayout((prev) => {
      const n = { ...prev, [key]: { ...prev[key], span: prev[key].span === 1 ? 2 : 1 } };
      persistLayout(n);
      return n;
    });
  };
  const dropCard = (target: string) => {
    if (!dragKey || dragKey === target) return;
    const keys = confs.map((c) => c.key);
    const a = keys.indexOf(dragKey);
    const b = keys.indexOf(target);
    keys.splice(b, 0, keys.splice(a, 1)[0]);
    reorder(keys);
    setDragKey(null);
  };

  // 本月记账统计
  const month = monthKey(today());
  const monthTx = data.transactions.filter((t) => monthKey(t.date) === month);
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // 今日番茄
  const todayPomodoro = data.pomodoros.filter((p) => p.date === today());
  const todayFocus = todayPomodoro.reduce((s, p) => s + p.focusMinutes, 0);
  const todayCycles = todayPomodoro.reduce((s, p) => s + p.cycles, 0);

  // 今日任务
  const todayTasks = data.tasks.filter((t) => t.due?.slice(0, 10) === today());
  const doneTasks = todayTasks.filter((t) => t.done).length;

  // 习惯连续天数
  const habitStreak = useMemo(() => {
    if (data.checkins.length === 0) return 0;
    const dates = new Set(data.checkins.map((c) => c.date));
    let streak = 0;
    const d = new Date();
    while (dates.has(format(d, 'yyyy-MM-dd'))) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [data.checkins]);

  // 今日健康心情
  const todayHealth = data.health.find((h) => h.date === today());
  const moods = ['开心', '平静', '一般', '低落', '烦躁'];
  const rawMood = todayHealth?.mood;
  const moodName = rawMood ? moods[Number(rawMood)] ?? rawMood : '';

  // 今日已打卡习惯集合
  const todayCheckedSet = new Set(
    data.checkins.filter((c) => c.date === today()).map((c) => c.habitId),
  );

  // 生理期：今天是否落在任一已开始周期内（自动判断），可被当日手动标记覆盖
  const periodActive = data.periods.some(
    (p) => p.start && today() >= p.start && (!p.end || today() <= p.end),
  );
  const periodState: 'in' | 'out' = periodMark ?? (periodActive ? 'in' : 'out');

  // 目标进度
  const goalsWithProgress = data.goals.map((g) => ({
    g,
    pct: g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0,
  }));

  // 最近倒计时
  const nearestCountdown = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const list = data.countdowns
      .filter((c) => new Date(c.date).getTime() >= now.getTime())
      .sort((a, b) => a.date.localeCompare(b.date));
    return list[0];
  }, [data.countdowns]);

  // 迷你日历（当月）
  const miniCalendar = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // 周一为0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    const daySet = new Set(data.events.map((e) => e.date));
    return { y, m, cells, daySet };
  }, [data.events]);

  const renderLedger = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4 text-primary" /> 本月记账
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-semibold text-success">
            <TrendingUp className="size-4" /> ¥{income}
          </div>
          <p className="text-xs text-muted-foreground">收入</p>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 text-lg font-semibold text-destructive">
            <TrendingDown className="size-4" /> ¥{expense}
          </div>
          <p className="text-xs text-muted-foreground">支出</p>
        </div>
        <div>
          <div className="text-lg font-semibold">¥{balance}</div>
          <p className="text-xs text-muted-foreground">结余</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderPomodoro = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Timer className="size-4 text-primary" /> 番茄专注
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-center">
        <div>
          <div className="text-lg font-semibold">{todayFocus} 分钟</div>
          <p className="text-xs text-muted-foreground">今日专注时长</p>
        </div>
        <div>
          <div className="text-lg font-semibold">{todayCycles} 个</div>
          <p className="text-xs text-muted-foreground">今日番茄数</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderTasks = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="size-4 text-primary" /> 今日任务
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-around text-center">
        <div>
          <div className="text-lg font-semibold">{todayTasks.length}</div>
          <p className="text-xs text-muted-foreground">待办</p>
        </div>
        <div>
          <div className="text-lg font-semibold text-success">{doneTasks}</div>
          <p className="text-xs text-muted-foreground">已完成</p>
        </div>
        <div>
          <div className="text-lg font-semibold">{todayTasks.length - doneTasks}</div>
          <p className="text-xs text-muted-foreground">未完成</p>
        </div>
      </CardContent>
    </Card>
  );

  const renderHabits = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Repeat className="size-4 text-primary" /> 习惯打卡
          </span>
          <Badge variant="secondary">连续 {habitStreak} 天</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有习惯，去习惯打卡页新建</p>
        ) : (
          <ul className="space-y-2">
            {data.habits.map((h) => {
              const checked = todayCheckedSet.has(h.id);
              return (
                <li key={h.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{
                      backgroundColor: checked ? h.color : 'transparent',
                      border: checked ? 'none' : '1.5px solid #c4c4c4',
                    }}
                  >
                    {checked && '✓'}
                  </span>
                  <span className={cn('flex-1 truncate', !checked && 'text-muted-foreground')}>
                    {h.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {checked ? '已打卡' : '未打卡'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );

  const renderHealth = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="size-4 text-primary" /> 健康心情
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-around text-center">
        <div>
          <div className="text-lg font-semibold">{moodName || '—'}</div>
          <p className="text-xs text-muted-foreground">今日心情</p>
        </div>
        <div>
          <div className="text-lg font-semibold">
            {todayHealth?.sleep ? `${todayHealth.sleep}h` : '—'}
          </div>
          <p className="text-xs text-muted-foreground">睡眠</p>
        </div>
        <div>
          <div className="text-lg font-semibold">
            {todayHealth?.exercise ? `${todayHealth.exercise}分` : '—'}
          </div>
          <p className="text-xs text-muted-foreground">运动</p>
        </div>
        {/* 生理期：运动右侧，单个可点框，红=已来 / 绿=未来 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const next = periodState === 'in' ? 'out' : 'in';
            setPeriodMark(next);
            store.set(`period_mark_${today()}`, next);
          }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className={cn(
              'size-5 rounded border',
              periodState === 'in'
                ? 'border-red-500 bg-red-500'
                : 'border-green-500 bg-green-500',
            )}
          />
          <span className="text-xs text-muted-foreground">
            生理期{periodState === 'in' ? '已来' : '未来'}
          </span>
        </button>
      </CardContent>
    </Card>
  );

  const renderGoals = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="size-4 text-primary" /> 目标追踪
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {goalsWithProgress.slice(0, 3).map(({ g, pct }) => (
          <div key={g.id} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="truncate">{g.name}</span>
              <span>
                {g.current}/{g.target} {g.unit} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ))}
        {goalsWithProgress.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无目标</p>
        )}
      </CardContent>
    </Card>
  );

  const renderCountdown = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" /> 倒计时
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nearestCountdown ? (
          <div className="flex items-center justify-between">
            <span className="truncate">{nearestCountdown.name}</span>
            <Badge>
              {Math.max(
                0,
                Math.ceil(
                  (new Date(nearestCountdown.date).getTime() -
                    new Date(today()).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )}{' '}
              天
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无倒计时</p>
        )}
      </CardContent>
    </Card>
  );

  const renderCalendar = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-primary" /> 日历预览
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
          {miniCalendar.cells.map((cell, i) => {
            if (cell === null) return <div key={i} />;
            const key = `${miniCalendar.y}-${String(miniCalendar.m + 1).padStart(2, '0')}-${String(cell).padStart(2, '0')}`;
            const holiday = HOLIDAYS[key];
            const isToday = cell === new Date().getDate();
            return (
              <div
                key={i}
                className={cn(
                  'flex h-9 flex-col items-center justify-center rounded-md leading-tight',
                  isToday && 'bg-primary text-primary-foreground',
                  !isToday &&
                    miniCalendar.daySet.has(key) &&
                    'bg-primary/15',
                )}
              >
                <span>{cell}</span>
                {holiday && (
                  <span className={cn('text-[8px]', isToday ? 'text-white' : 'text-red-500')}>
                    {holiday}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  const renderByKey: Record<string, () => React.ReactNode> = {
    ledger: () => renderLedger,
    pomodoro: () => renderPomodoro,
    tasks: () => renderTasks,
    habits: () => renderHabits,
    health: () => renderHealth,
    goals: () => renderGoals,
    countdown: () => renderCountdown,
    calendar: () => renderCalendar,
  };

  return (
    <div className="space-y-4 p-4">
      {/* 顶部问候：横屏用横图人头、竖屏用竖图人头，定位偏上露出脸部 */}
      <div className="relative overflow-hidden rounded-3xl">
        <Image
          src={bg.src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: bg.isPortrait ? '50% 18%' : '50% 28%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-primary/30 to-transparent" />
        <div className="relative p-5 text-white">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Sparkles className="size-4" />
            {format(new Date(), 'M月d日 EEEE', { locale: zhCN })}
          </div>
          <button
            className="mt-1 text-left text-lg font-semibold"
            onClick={() => {
              setWelcomeClicks((c) => {
                const n = c + 1;
                if (n >= 6) {
                  setEgg({ src: 'sister.mp4' });
                  return 0;
                }
                return n;
              });
            }}
            title={welcomeClicks > 0 ? `再点 ${6 - welcomeClicks} 次有惊喜` : undefined}
          >
            {accountId ? '欢迎回来' : '花海日记'}
          </button>
          <p className="text-sm opacity-90">记录生活的每一朵小花</p>
        </div>
        {/* 隐藏彩蛋4：点中顶部图人物任意位置 6 次 → 自己视频；横/竖屏分别覆盖人物区域，左侧文字区不触发 */}
        <button
          onClick={() =>
            setNoseClicks((c) => {
              const n = c + 1;
              if (n >= 6) {
                setEgg({ src: 'me.mp4' });
                return 0;
              }
              return n;
            })
          }
          aria-label="hidden"
          className="absolute z-10 top-0 h-full"
          style={bg.isPortrait ? { left: '26%', width: '48%' } : { left: '38%', width: '44%' }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {confs.map((c, idx) => {
          const render = renderByKey[c.key];
          if (!render) return null;
          return (
            <div
              key={c.key}
              draggable
              onDragStart={() => setDragKey(c.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropCard(c.key)}
              onPointerDown={() => startPress(c.key)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onClick={() => onCardClick(c.key)}
              style={{ gridColumn: c.span === 2 ? 'span 2' : 'span 1' }}
              className={cn(
                'relative cursor-pointer',
                dragKey === c.key ? 'opacity-50' : '',
              )}
              title="点按进入，长按可移动/拉大拉小"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-black/40 p-0.5 backdrop-blur transition ${activeCard === c.key ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <GripVertical className="size-3.5 text-white/70" />
                <button onClick={() => moveCard(c.key, -1)} disabled={idx === 0} className="rounded p-1 text-white/90 hover:bg-white/20 disabled:opacity-30" aria-label="上移">
                  <ArrowUp className="size-3.5" />
                </button>
                <button onClick={() => moveCard(c.key, 1)} disabled={idx === confs.length - 1} className="rounded p-1 text-white/90 hover:bg-white/20 disabled:opacity-30" aria-label="下移">
                  <ArrowDown className="size-3.5" />
                </button>
                <button onClick={() => toggleSpan(c.key)} className="rounded p-1 text-white/90 hover:bg-white/20" aria-label="拉大拉小" title="切换半宽/整行">
                  <StretchHorizontal className="size-3.5" />
                </button>
                <button onClick={() => setActiveCard(null)} className="rounded p-1 text-white/70 hover:bg-white/20" aria-label="收起">
                  ×
                </button>
              </div>
              {render()}
            </div>
          );
        })}
      </div>

      {egg && <EasterEgg src={egg.src} text={egg.text} onClose={() => setEgg(null)} />}
    </div>
  );
}
