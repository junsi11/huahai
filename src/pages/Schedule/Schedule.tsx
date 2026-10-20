// 课程表：手动填写 + Excel/CSV 导入；分周、单周/双周/指定周；节次多选；点格加课；左右滑周；导出图片
// 数据存本地 localStorage（纯前端离线）
// EXPORTS: SchedulePage (default)

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Pencil, Upload, Settings2, Download, ChevronLeft, ChevronRight, ImageDown, MonitorSmartphone, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { store } from '@/lib/localstore';
import { randomId } from '@/lib/crypto';

type WeekMode = 'all' | 'odd' | 'even' | 'custom';

interface Course {
  id: string;
  name: string;
  teacher?: string;
  room?: string;
  color: string;
  day: number; // 1=周一 ... 7=周日
  periods: number[]; // 多选节次（0-based），兼容旧字段 period
  mode: WeekMode;
  custom: number[];
}

interface Period {
  name: string;
  start: string;
  end: string;
}

interface ScheduleConfig {
  totalWeeks: number;
  periods: Period[];
}

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const PALETTE = [
  '#E79BB0', '#5D8A72', '#7FA9D6', '#C9A86A', '#A98BC9', '#E8856A',
  '#6FBFBF', '#9CB86B', '#D98FB8', '#8FA6C9', '#B08968', '#9C9C9C',
  '#F2B8C6', '#7BC4A8', '#93B8E8', '#E0C08A', '#C7A6E0', '#F0A08A',
  '#8ED0D0', '#B5D08A',
];

const DEFAULT_PERIODS: Period[] = [
  { name: '第1节', start: '08:00', end: '08:45' },
  { name: '第2节', start: '08:55', end: '09:40' },
  { name: '第3节', start: '10:00', end: '10:45' },
  { name: '第4节', start: '10:55', end: '11:40' },
  { name: '第5节', start: '14:00', end: '14:45' },
  { name: '第6节', start: '14:55', end: '15:40' },
  { name: '第7节', start: '16:00', end: '16:45' },
  { name: '第8节', start: '16:55', end: '17:40' },
];

const MODE_LABEL: Record<WeekMode, string> = {
  all: '每周都上',
  odd: '单周（1,3,5,7…）',
  even: '双周（2,4,6,8…）',
  custom: '指定几周',
};

// 兼容旧数据：把 period 单节转成 periods 数组
const normalize = (c: Course): Course =>
  Array.isArray(c.periods) && c.periods.length > 0 ? c : { ...c, periods: [(c as { period?: number }).period ?? 0] };

function appears(c: Course, week: number): boolean {
  if (c.mode === 'all') return true;
  if (c.mode === 'odd') return week % 2 === 1;
  if (c.mode === 'even') return week % 2 === 0;
  return c.custom.includes(week);
}

export default function SchedulePage() {
  const [courses, setCourses] = useState<Course[]>(() =>
    store.get<Course[]>('sched_courses', []).map(normalize),
  );
  const [config, setConfig] = useState<ScheduleConfig>(() =>
    store.get<ScheduleConfig>('sched_config', { totalWeeks: 16, periods: DEFAULT_PERIODS }),
  );
  const [currentWeek, setCurrentWeek] = useState(() => store.get<number>('sched_week', 1));

  const persist = (next: Course[], cfg: ScheduleConfig) => {
    setCourses(next);
    setConfig(cfg);
    store.set('sched_courses', next);
    store.set('sched_config', cfg);
  };

  // 新建/编辑
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [cName, setCName] = useState('');
  const [cTeacher, setCTeacher] = useState('');
  const [cRoom, setCRoom] = useState('');
  const [cColor, setCColor] = useState(PALETTE[0]);
  const [cDay, setCDay] = useState(1);
  const [cPeriods, setCPeriods] = useState<number[]>([0]);
  const [cMode, setCMode] = useState<WeekMode>('all');
  const [cCustom, setCCustom] = useState<number[]>([]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const swipeX = useRef<number | null>(null);

  const openAdd = (day?: number, period?: number) => {
    setEditing(null);
    setCName('');
    setCTeacher('');
    setCRoom('');
    setCColor(PALETTE[0]);
    setCDay(day ?? 1);
    setCPeriods(period !== undefined ? [period] : [0]);
    setCMode('all');
    setCCustom([]);
    setOpen(true);
  };

  const openEdit = (c: Course) => {
    setEditing(c);
    setCName(c.name);
    setCTeacher(c.teacher ?? '');
    setCRoom(c.room ?? '');
    setCColor(c.color);
    setCDay(c.day);
    setCPeriods([...c.periods]);
    setCMode(c.mode);
    setCCustom([...c.custom]);
    setOpen(true);
  };

  const save = () => {
    if (!cName.trim()) {
      toast.error('请填写课程名称');
      return;
    }
    if (cPeriods.length === 0) {
      toast.error('请至少选一节');
      return;
    }
    const base: Course = {
      id: editing?.id ?? randomId(),
      name: cName.trim(),
      teacher: cTeacher.trim() || undefined,
      room: cRoom.trim() || undefined,
      color: cColor,
      day: cDay,
      periods: [...cPeriods].sort((a, b) => a - b),
      mode: cMode,
      custom: cMode === 'custom' ? cCustom : [],
    };
    const next = editing ? courses.map((c) => (c.id === editing.id ? base : c)) : [...courses, base];
    persist(next, config);
    toast.success(editing ? '课程已更新' : '课程已添加');
    setOpen(false);
  };

  const togglePeriod = (p: number) => {
    setCPeriods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };
  const toggleCustomWeek = (w: number) => {
    setCCustom((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b)));
  };

  // 当前周出现在某个 (day, period) 的课程
  const cellCourses = (day: number, period: number) =>
    courses.filter((c) => c.day === day && c.periods.includes(period) && appears(c, currentWeek));

  // 左右滑周（边界停住）
  const weekOptions = useMemo(() => Array.from({ length: config.totalWeeks }, (_, i) => i + 1), [config.totalWeeks]);
  const goWeek = (w: number) => {
    const clamped = Math.min(config.totalWeeks, Math.max(1, w));
    setCurrentWeek(clamped);
    store.set('sched_week', clamped);
  };

  // Excel / CSV 导入
  const onImport = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      let headerIdx = rows.findIndex((r) =>
        Array.isArray(r) && r.some((v) => String(v ?? '').includes('课程') || String(v ?? '').includes('名称')),
      );
      if (headerIdx < 0) headerIdx = 0;
      const header = (rows[headerIdx] ?? []).map((v) => String(v ?? '').trim());
      const col = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
      const iName = col(['课程', '名称', '课名']);
      const iDay = col(['星期', '天']);
      const iPeriod = col(['节次', '节', '第']);
      const iTeacher = col(['老师', '教师']);
      const iRoom = col(['教室', '地点']);
      const iWeeks = col(['周次', '上课周', '周期']);

      const parseDay = (v: unknown): number => {
        const s = String(v ?? '');
        const m = s.match(/([1-7])/);
        if (m) return Number(m[1]);
        const map: Record<string, number> = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7 };
        for (const k of Object.keys(map)) if (s.includes(k)) return map[k];
        return 1;
      };
      const parseWeeks = (v: unknown): { mode: WeekMode; custom: number[] } => {
        const s = String(v ?? '').trim();
        if (!s || s.includes('全') || s.includes('每')) return { mode: 'all', custom: [] };
        if (s.includes('单')) return { mode: 'odd', custom: [] };
        if (s.includes('双')) return { mode: 'even', custom: [] };
        const nums = (s.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1 && n <= config.totalWeeks);
        return nums.length ? { mode: 'custom', custom: nums } : { mode: 'all', custom: [] };
      };

      const imported: Course[] = [];
      for (const r of rows.slice(headerIdx + 1)) {
        if (!Array.isArray(r)) continue;
        const name = String(iName >= 0 ? r[iName] : r[0] ?? '').trim();
        if (!name) continue;
        const w = parseWeeks(iWeeks >= 0 ? r[iWeeks] : '');
        const pNum = Number(String(iPeriod >= 0 ? r[iPeriod] : 1).match(/\d+/)?.[0] ?? 1);
        imported.push({
          id: randomId(),
          name,
          teacher: iTeacher >= 0 ? String(r[iTeacher] ?? '').trim() || undefined : undefined,
          room: iRoom >= 0 ? String(r[iRoom] ?? '').trim() || undefined : undefined,
          color: PALETTE[imported.length % PALETTE.length],
          day: parseDay(iDay >= 0 ? r[iDay] : 1),
          periods: [Math.max(0, pNum - 1)],
          mode: w.mode,
          custom: w.custom,
        });
      }
      if (imported.length === 0) {
        toast.error('没解析到课程，请按列填写：课程名/星期/节次/老师/教室/周次');
        return;
      }
      persist([...courses, ...imported], config);
      toast.success(`已导入 ${imported.length} 门课程`);
    } catch {
      toast.error('文件解析失败，请上传 .xlsx 或 .csv');
    }
  };

  // 导出 CSV 备份
  const exportCsv = () => {
    const header = ['课程名', '星期', '节次', '老师', '教室', '周次'];
    const lines = courses.map((c) =>
      [
        c.name,
        `周${c.day}`,
        c.periods.map((p) => p + 1).join(','),
        c.teacher ?? '',
        c.room ?? '',
        c.mode === 'all' ? '全周' : c.mode === 'odd' ? '单周' : c.mode === 'even' ? '双周' : c.custom.join(','),
      ].join(','),
    );
    const csv = '\ufeff' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '课程表.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // 导出当前周课表为图片
  const exportImage = () => {
    const cols = 7;
    const rows = config.periods.length;
    const cw = 150, ch = 74, pad = 40, headH = 60;
    const canvas = document.createElement('canvas');
    canvas.width = pad * 2 + cw * cols;
    canvas.height = pad * 2 + headH + ch * rows;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${currentWeek} 周课程表`, canvas.width / 2, pad);
    // 表头
    ctx.font = '14px sans-serif';
    DAY_LABELS.forEach((d, i) => {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(pad + i * cw, pad + 24, cw, headH - 24);
      ctx.fillStyle = '#555';
      ctx.fillText(d, pad + i * cw + cw / 2, pad + 52);
    });
    // 格子
    config.periods.forEach((p, ri) => {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(pad, pad + headH + ri * ch, cw, ch);
      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, pad + 6, pad + headH + ri * ch + 18);
      ctx.fillText(`${p.start}-${p.end}`, pad + 6, pad + headH + ri * ch + 36);
      DAY_LABELS.forEach((_, di) => {
        ctx.strokeStyle = '#e5e5e5';
        ctx.strokeRect(pad + di * cw, pad + headH + ri * ch, cw, ch);
        const list = cellCourses(di + 1, ri);
        list.forEach((c, k) => {
          const y = pad + headH + ri * ch + 6 + k * 34;
          ctx.fillStyle = c.color;
          ctx.fillRect(pad + di * cw + 4, y, cw - 8, 30);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(c.name, pad + di * cw + cw / 2, y + 14);
          ctx.font = '10px sans-serif';
          ctx.fillText([c.teacher, c.room].filter(Boolean).join(' · '), pad + di * cw + cw / 2, y + 26);
        });
      });
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `课程表-第${currentWeek}周.png`;
    a.click();
    toast.success('课表图片已导出');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">课程表</h1>
          <p className="text-sm text-muted-foreground">手动填写或导入 Excel，分周复用，左右滑动换周</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 size-4" /> 导入Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 size-4" /> 导出CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportImage}>
            <ImageDown className="mr-1 size-4" /> 导出图片
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="mr-1 size-4" /> 设置
          </Button>
          <Button size="sm" onClick={() => openAdd()}>
            <Plus className="mr-1 size-4" /> 新建课程
          </Button>
        </div>
      </div>

      {/* 当前周切换：箭头 + 左右滑动 */}
      <div
        className="flex items-center justify-center gap-3 rounded-lg border bg-card p-2"
        onPointerDown={(e) => { swipeX.current = e.clientX; }}
        onPointerUp={(e) => {
          if (swipeX.current === null) return;
          const dx = e.clientX - swipeX.current;
          if (dx < -50) goWeek(currentWeek + 1);
          else if (dx > 50) goWeek(currentWeek - 1);
          swipeX.current = null;
        }}
      >
        <Button size="icon" variant="ghost" disabled={currentWeek <= 1} onClick={() => goWeek(currentWeek - 1)} aria-label="上一周">
          <ChevronLeft className="size-5" />
        </Button>
        <select
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={currentWeek}
          onChange={(e) => goWeek(Number(e.target.value))}
        >
          {weekOptions.map((w) => (
            <option key={w} value={w}>第 {w} 周</option>
          ))}
        </select>
        <Button size="icon" variant="ghost" disabled={currentWeek >= config.totalWeeks} onClick={() => goWeek(currentWeek + 1)} aria-label="下一周">
          <ChevronRight className="size-5" />
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">共 {config.totalWeeks} 周 · 滑屏换周</span>
      </div>

      {/* 网格课表：点空格直接加课，点已有课编辑 */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-16 border bg-muted/40 p-2 font-medium">节次</th>
              {DAY_LABELS.map((d) => (
                <th key={d} className="border bg-muted/40 p-2 font-medium">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.periods.map((p, pi) => (
              <tr key={pi}>
                <td className="border bg-muted/20 p-1.5 text-center align-top">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.start}-{p.end}</div>
                </td>
                {DAY_LABELS.map((_, di) => {
                  const list = cellCourses(di + 1, pi);
                  return (
                    <td
                      key={di}
                      className="cursor-pointer border p-1 align-top hover:bg-primary/5"
                      onClick={() => (list.length ? openEdit(list[0]) : openAdd(di + 1, pi))}
                    >
                      <div className="space-y-1">
                        {list.map((c) => (
                          <div
                            key={c.id}
                            className="rounded p-1.5 text-white"
                            style={{ backgroundColor: c.color }}
                            onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                          >
                            <div className="font-medium leading-tight">{c.name}</div>
                            {c.teacher && <div className="text-[10px] opacity-90">{c.teacher}</div>}
                            {c.room && <div className="text-[10px] opacity-90">@{c.room}</div>}
                          </div>
                        ))}
                        {list.length === 0 && <div className="py-1 text-center text-[10px] text-transparent hover:text-muted-foreground">＋</div>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 全部课程管理 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">全部课程（{courses.length}）</h3>
        {courses.length === 0 && <p className="text-sm text-muted-foreground">还没有课程，点表格空格直接加课，或右上角新建/导入Excel</p>}
        <div className="grid gap-2 md:grid-cols-2">
          {courses.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-2 p-3">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DAY_LABELS[c.day - 1]} · {c.periods.map((p) => config.periods[p]?.name ?? `第${p + 1}节`).join('/')} · {MODE_LABEL[c.mode]}
                    {c.mode === 'custom' && `（${c.custom.join(',')}周）`}
                    {c.teacher && ` · ${c.teacher}`}
                    {c.room && ` · ${c.room}`}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="编辑">
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteId(c.id)} aria-label="删除">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 添加到桌面说明（系统服务卡片/常驻widget纯网页做不到） */}
      <Card>
        <CardContent className="flex items-start gap-2 p-3 text-xs text-muted-foreground">
          <MonitorSmartphone className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">放到桌面（添加到主屏幕）</p>
            <p>纯网页做不出华为服务卡片/手机桌面常驻小组件，那需要原生开发。可行做法：手机用浏览器打开本页 → 菜单「添加到主屏幕」，电脑 Chrome 地址栏右侧「安装/创建快捷方式」，点开即看课表；也可点「导出图片」把本周课表存成图片手动使用。</p>
          </div>
        </CardContent>
      </Card>

      {/* 新建/编辑课程 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '修改课程' : '新建课程'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>课程名称</Label>
              <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="如：高等数学" />
            </div>
            <div className="space-y-1">
              <Label>星期</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={cDay} onChange={(e) => setCDay(Number(e.target.value))}>
                {DAY_LABELS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>节次（可多选连堂）</Label>
              <div className="flex flex-wrap gap-1.5">
                {config.periods.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => togglePeriod(i)}
                    className={`h-8 rounded-md border px-2 text-xs ${cPeriods.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>出现周</Label>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'odd', 'even', 'custom'] as WeekMode[]).map((m) => (
                  <Button key={m} size="sm" variant={cMode === m ? 'default' : 'outline'} onClick={() => setCMode(m)}>
                    {MODE_LABEL[m]}
                  </Button>
                ))}
              </div>
              {cMode === 'custom' && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {weekOptions.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => toggleCustomWeek(w)}
                      className={`h-7 w-8 rounded text-xs ${cCustom.includes(w) ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>颜色</Label>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setCColor(col)}
                    className={`size-7 rounded-full border-2 ${cColor === col ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>老师（选填）</Label>
                <Input value={cTeacher} onChange={(e) => setCTeacher(e.target.value)} placeholder="选填" />
              </div>
              <div className="space-y-1">
                <Label>教室（选填）</Label>
                <Input value={cRoom} onChange={(e) => setCRoom(e.target.value)} placeholder="选填" />
              </div>
            </div>
            <Button className="w-full" onClick={save}>{editing ? '保存修改' : '添加'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这门课程？</AlertDialogTitle>
            <AlertDialogDescription>删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteId) persist(courses.filter((c) => c.id !== deleteId), config);
              setDeleteId(null);
            }}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 设置：总周数 + 节次增删改时间 */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>课程表设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>总周数</Label>
              <Input
                type="number"
                min={1}
                value={config.totalWeeks}
                onChange={(e) => setConfig({ ...config, totalWeeks: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="space-y-1">
              <Label>节次与时间（可增删改，不限8节）</Label>
              {config.periods.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="w-16 text-xs"
                    value={p.name}
                    onChange={(e) => {
                      const next = [...config.periods];
                      next[i] = { ...p, name: e.target.value };
                      setConfig({ ...config, periods: next });
                    }}
                  />
                  <Input type="time" value={p.start} onChange={(e) => {
                    const next = [...config.periods];
                    next[i] = { ...p, start: e.target.value };
                    setConfig({ ...config, periods: next });
                  }} />
                  <span className="text-xs text-muted-foreground">-</span>
                  <Input type="time" value={p.end} onChange={(e) => {
                    const next = [...config.periods];
                    next[i] = { ...p, end: e.target.value };
                    setConfig({ ...config, periods: next });
                  }} />
                  <Button size="icon" variant="ghost" onClick={() => {
                    const next = config.periods.filter((_, idx) => idx !== i);
                    setConfig({ ...config, periods: next });
                  }} aria-label="删除本节">
                    <X className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => {
                const n = config.periods.length + 1;
                setConfig({
                  ...config,
                  periods: [...config.periods, { name: `第${n}节`, start: '18:00', end: '18:45' }],
                });
              }}>
                <Plus className="mr-1 size-4" /> 添加一节
              </Button>
            </div>
            <Button className="w-full" onClick={() => {
              persist(courses, config);
              setSettingsOpen(false);
              toast.success('设置已保存');
            }}>保存设置</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
