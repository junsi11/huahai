// 日记：心情/天气可自定义，正文可写可画可传图（一体），编辑/删除
// EXPORTS: DiaryPage (default)

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, ImagePlus, Sun, Cloud, CloudRain, Cloudy, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import FreeDrawPad from '@/components/FreeDrawPad';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import type { IDiary } from '@/lib/types';

const MOODS = ['开心', '平静', '一般', '低落', '烦躁', '期待', '疲惫', '兴奋'];
const WEATHERS = [
  { key: '晴', icon: Sun },
  { key: '多云', icon: Cloudy },
  { key: '阴', icon: Cloud },
  { key: '雨', icon: CloudRain },
];

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// 可自定义选择器：预设 chips + 自由输入
function CustomPicker({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [custom, setCustom] = useState('');
  const isPreset = options.includes(value);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs',
              value === o ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          className="h-8 text-xs"
          placeholder={placeholder ?? '自定义…'}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (custom.trim()) onChange(custom.trim());
          }}
        >
          添加
        </Button>
      </div>
      {!isPreset && value && (
        <span className="text-xs text-primary">当前自定义：{value}</span>
      )}
    </div>
  );
}

export default function DiaryPage() {
  const { data, refresh } = useAllData();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IDiary | null>(null);
  const [date, setDate] = useState(today());
  const [mood, setMood] = useState('平静');
  const [weather, setWeather] = useState('晴');
  const [content, setContent] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // 按年/月/日筛选查看（空=不限）
  const [fYear, setFYear] = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fDay, setFDay] = useState('');

  const list = useMemo(
    () => [...data.diaries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [data.diaries],
  );

  const years = useMemo(
    () => Array.from(new Set(list.map((d) => d.date.slice(0, 4)))).sort().reverse(),
    [list],
  );
  const filtered = useMemo(
    () =>
      list.filter(
        (d) =>
          (!fYear || d.date.startsWith(fYear)) &&
          (!fMonth || d.date.slice(5, 7) === fMonth) &&
          (!fDay || d.date.slice(8, 10) === fDay),
      ),
    [list, fYear, fMonth, fDay],
  );

  const openAdd = () => {
    setEditing(null);
    setDate(today());
    setMood('平静');
    setWeather('晴');
    setContent('');
    setDrawing(null);
    setImages([]);
    setOpen(true);
  };
  const openEdit = (d: IDiary) => {
    setEditing(d);
    setDate(d.date);
    setMood(d.mood ?? '平静');
    setWeather(d.weather ?? '晴');
    setContent(d.content);
    setDrawing(d.drawing ?? null);
    setImages(d.images ?? []);
    setOpen(true);
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .slice(0, 3)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => {
          setImages((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(f);
      });
  };

  const onSave = async () => {
    if (!content.trim() && !drawing) {
      toast.error('请写点文字或画点什么');
      return;
    }
    if (editing) {
      await service.diaries.put({
        ...editing,
        date,
        mood,
        weather,
        content: content.trim(),
        drawing: drawing ?? undefined,
        images: images.length ? images : undefined,
      });
      toast.success('日记已更新');
    } else {
      const diary: IDiary = {
        id: randomId(),
        date,
        mood,
        weather,
        content: content.trim(),
        drawing: drawing ?? undefined,
        images: images.length ? images : undefined,
        createdAt: Date.now(),
      };
      await service.diaries.put(diary);
      toast.success('日记已保存');
    }
    setOpen(false);
    void refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await service.diaries.del(deleteId);
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">日记</h1>
          <p className="text-sm text-muted-foreground">共 {list.length} 篇</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 size-4" /> 写日记
        </Button>
      </div>

      {/* 按年/月/日筛选查看 */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
        <span className="text-xs text-muted-foreground">按日期看：</span>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={fYear}
          onChange={(e) => { setFYear(e.target.value); setFMonth(''); setFDay(''); }}
        >
          <option value="">全部年份</option>
          {years.map((y) => <option key={y} value={y}>{y}年</option>)}
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={fMonth}
          onChange={(e) => { setFMonth(e.target.value); setFDay(''); }}
        >
          <option value="">全部月份</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
            <option key={m} value={m}>{Number(m)}月</option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          value={fDay}
          onChange={(e) => setFDay(e.target.value)}
        >
          <option value="">全部日期</option>
          {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
            <option key={d} value={d}>{Number(d)}日</option>
          ))}
        </select>
        {(fYear || fMonth || fDay) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFYear(''); setFMonth(''); setFDay(''); }}>
            清除
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} 篇</span>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {list.length === 0 ? '还没有日记，点击右上角开始记录' : '该日期没有日记'}
          </p>
        ) : (
          filtered.map((d) => (
            <Card key={d.id}>
              <CardContent className="pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{d.date}</div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{d.mood}</span>
                    {d.weather && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {d.weather}
                      </span>
                    )}
                    <button onClick={() => openEdit(d)} className="text-muted-foreground hover:text-primary" aria-label="编辑">
                      <Pencil className="size-4" />
                    </button>
                    <button onClick={() => setDeleteId(d.id)} className="text-muted-foreground hover:text-destructive" aria-label="删除">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                {d.content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{d.content}</p>}
                {d.drawing && (
                  <div className="mt-2">
                    <img src={d.drawing} alt="手绘" className="w-full rounded-lg border" />
                  </div>
                )}
                {d.images && d.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.images.map((img, i) => (
                      <img key={i} src={img} alt="diary" className="h-20 w-20 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 写日记对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '修改日记' : '写日记'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>日期</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>心情（可自定义）</Label>
              <CustomPicker options={MOODS} value={mood} onChange={setMood} placeholder="输入心情…" />
            </div>
            <div className="space-y-2">
              <Label>天气（可自定义）</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEATHERS.map((w) => {
                  const Icon = w.icon;
                  return (
                    <button
                      key={w.key}
                      type="button"
                      onClick={() => setWeather(w.key)}
                      className={cn(
                        'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs',
                        weather === w.key && 'border-primary bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="size-3.5" />
                      {w.key}
                    </button>
                  );
                })}
                <Input
                  className="h-8 w-24 text-xs"
                  placeholder="自定义…"
                  value={weather.startsWith('自定义') ? '' : (WEATHERS.some((x) => x.key === weather) ? '' : '')}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.trim()) setWeather(v.trim());
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>正文</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="写文字…" rows={5} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Palette className="size-3.5" /> 手绘</Label>
              <FreeDrawPad
                value={drawing ?? undefined}
                onChange={(d) => setDrawing(d)}
                height={200}
              />
            </div>
            <div className="space-y-2">
              <Label>图片</Label>
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img src={img} alt={`pic-${i}`} className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground"
                >
                  <ImagePlus className="size-5" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    addImages(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => void onSave()}>
              {editing ? '保存修改' : '保存日记'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这篇日记？</AlertDialogTitle>
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
