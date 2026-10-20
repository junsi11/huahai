// 备忘录：文本 + 手绘 + 图片 + 录音（播放），画笔多色，编辑/删除
// EXPORTS: MemoPage (default)

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Pin, PinOff, ImagePlus, Mic, Square, Palette } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import FreeDrawPad from '@/components/FreeDrawPad';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import type { IMemo } from '@/lib/types';

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// 录音组件：MediaRecorder 录音，转 dataURL
function Recorder({ value, onChange }: { value?: string; onChange: (dataUrl: string, duration: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onChange(reader.result as string, seconds);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error('无法录音，请检查麦克风权限');
    }
  };

  const stop = () => {
    recRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {recording ? (
          <Button variant="destructive" size="sm" onClick={stop}>
            <Square className="mr-1 size-4" /> 停止 ({mm}:{ss})
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => void start()}>
            <Mic className="mr-1 size-4" /> 开始录音
          </Button>
        )}
      </div>
      {value && !recording && (
        <audio controls src={value} className="w-full" />
      )}
      <p className="text-xs text-muted-foreground">录音保存在本机备忘录中，可播放（不联网、不上传）</p>
    </div>
  );
}

export default function MemoPage() {
  const { data, refresh } = useAllData();
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<IMemo | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [drawing, setDrawing] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [audioDur, setAudioDur] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(
    () =>
      [...data.memos]
        .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || b.createdAt - a.createdAt),
    [data.memos],
  );

  // 按年/月/日筛选查看（空=不限）
  const [fYear, setFYear] = useState('');
  const [fMonth, setFMonth] = useState('');
  const [fDay, setFDay] = useState('');
  const memoDate = (m: IMemo) => m.date || format(new Date(m.createdAt), 'yyyy-MM-dd');
  const years = useMemo(
    () => Array.from(new Set(list.map((m) => memoDate(m).slice(0, 4)))).sort().reverse(),
    [list],
  );
  const filtered = useMemo(
    () =>
      list.filter((m) => {
        const d = memoDate(m);
        return (
          (!fYear || d.startsWith(fYear)) &&
          (!fMonth || d.slice(5, 7) === fMonth) &&
          (!fDay || d.slice(8, 10) === fDay)
        );
      }),
    [list, fYear, fMonth, fDay],
  );

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setContent('');
    setTags('');
    setDrawing(null);
    setImages([]);
    setAudio(null);
    setAudioDur(0);
    setOpen(true);
  };
  const openEdit = (m: IMemo) => {
    setEditing(m);
    setTitle(m.title);
    setContent(m.content ?? '');
    setTags(m.tags.join(','));
    setDrawing(m.drawing ?? null);
    setImages(m.images ?? []);
    setAudio(m.audio ?? null);
    setAudioDur(m.audioDuration ?? 0);
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
    if (!title.trim()) {
      toast.error('请输入标题');
      return;
    }
    const base = {
      title: title.trim(),
      content: content.trim() || undefined,
      tags: tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      drawing: drawing ?? undefined,
      images: images.length ? images : undefined,
      audio: audio ?? undefined,
      audioDuration: audio ? audioDur : undefined,
    };
    if (editing) {
      await service.memos.put({ ...editing, ...base });
      toast.success('备忘录已更新');
    } else {
      const memo: IMemo = {
        id: randomId(),
        date: today(),
        createdAt: Date.now(),
        ...base,
      };
      await service.memos.put(memo);
      toast.success('备忘录已保存');
    }
    setOpen(false);
    void refresh();
  };

  const togglePin = async (m: IMemo) => {
    await service.memos.put({ ...m, pinned: !m.pinned });
    void refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await service.memos.del(deleteId);
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">备忘录</h1>
          <p className="text-sm text-muted-foreground">文本 · 手绘 · 图片 · 录音</p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 size-4" /> 新建
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
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} 条</span>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {list.length === 0 ? '还没有备忘录' : '该日期没有备忘录'}
          </p>
        ) : (
          filtered.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  {m.pinned && <Pin className="size-4 text-primary" />}
                  <span className="truncate">{m.title}</span>
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => void togglePin(m)}>
                    {m.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(m)} aria-label="编辑">
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(m.id)} aria-label="删除">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {m.content && <p className="whitespace-pre-wrap text-sm">{m.content}</p>}
                {m.drawing && (
                  <img src={m.drawing} alt="drawing" className="w-full rounded-lg border" />
                )}
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.images.map((img, i) => (
                      <img key={i} src={img} alt="memo" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
                {m.audio && (
                  <audio controls src={m.audio} className="w-full" />
                )}
                <div className="flex flex-wrap gap-1">
                  {m.tags.map((t) => (
                    <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground">{m.date}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 新建/编辑备忘录对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '修改备忘录' : '新建备忘录'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="备忘标题" />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="写点什么…" rows={4} />
            </div>
            <div className="space-y-2">
              <Label>标签（用逗号分隔）</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如：灵感, 工作" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Palette className="size-3.5" /> 手绘</Label>
              <FreeDrawPad
                value={drawing ?? undefined}
                onChange={(d) => setDrawing(d)}
                height={180}
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mic className="size-3.5" /> 录音</Label>
              <Recorder
                value={audio ?? undefined}
                onChange={(d, dur) => {
                  setAudio(d);
                  setAudioDur(dur);
                }}
              />
            </div>
            <Button className="w-full" onClick={() => void onSave()}>
              {editing ? '保存修改' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条备忘录？</AlertDialogTitle>
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
