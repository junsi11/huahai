// 备份与恢复：JSON 完整备份/恢复、CSV 模块化导出导入
// EXPORTS: BackupPage (default)

import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload, FileJson, FileSpreadsheet, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { idb, STORES } from '@/lib/db';
import { randomId } from '@/lib/crypto';

const MODULES = [
  { key: 'transactions', label: '记账' },
  { key: 'tasks', label: '任务' },
  { key: 'pomodoros', label: '番茄' },
  { key: 'diaries', label: '日记' },
  { key: 'memos', label: '备忘录' },
  { key: 'habits', label: '习惯' },
  { key: 'checkins', label: '打卡记录' },
  { key: 'health', label: '健康' },
  { key: 'periods', label: '生理期' },
  { key: 'goals', label: '目标' },
  { key: 'countdowns', label: '倒计时' },
  { key: 'events', label: '日历事件' },
  { key: 'reviews', label: '复盘' },
];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ];
  return lines.join('\n');
}

export default function BackupPage() {
  const { refresh } = useAllData();
  const [tab, setTab] = useState<'json' | 'csv'>('json');
  const [csvModule, setCsvModule] = useState('transactions');
  const [csvRange, setCsvRange] = useState('all');

  const rangeKey = (d: string): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    if (csvRange === '7d') {
      const t = new Date();
      t.setDate(t.getDate() - 7);
      return d >= t.toISOString().slice(0, 10) && d <= today;
    }
    if (csvRange === 'month') return d.slice(0, 7) === today.slice(0, 7);
    if (csvRange === 'year') return d.slice(0, 4) === today.slice(0, 4);
    return true;
  };

  const exportJSON = async () => {
    try {
      const dump: Record<string, unknown[]> = {};
      for (const s of STORES) {
        dump[s] = await idb.getAll(s as never);
      }
      const meta = { app: 'huahai', version: 1, exportedAt: new Date().toISOString() };
      download(`huahai-backup-${Date.now()}.json`, JSON.stringify({ meta, ...dump }, null, 2));
      toast.success('JSON 备份已导出');
    } catch {
      toast.error('导出失败');
    }
  };

  const importJSON = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.meta || parsed.meta.app !== 'huahai') {
        toast.error('不是有效的花海备份文件');
        return;
      }
      // 逐 store 恢复
      for (const s of STORES) {
        const rows = parsed[s];
        if (Array.isArray(rows) && rows.length > 0) {
          await idb.putAll(s as never, rows as never);
        }
      }
      toast.success('数据已恢复');
      void refresh();
    } catch {
      toast.error('文件格式错误，导入已中止');
    }
  };

  const exportCSV = async () => {
    const rows = await idb.getAll(csvModule as never);
    const filtered = rows.filter((r) => {
      const d = (r as { date?: string }).date;
      return d ? rangeKey(d) : true;
    });
    if (filtered.length === 0) {
      toast.info('该范围内无数据');
      return;
    }
    download(`huahai-${csvModule}-${csvRange}.csv`, toCSV(filtered as Record<string, unknown>[]));
    toast.success('CSV 已导出');
  };

  const importCSV = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 1) {
        toast.error('文件为空');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map((line) => {
        const vals = line.split(',').map((v) => v.replace(/^"|"$/g, ''));
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const raw = vals[i];
          if (raw !== undefined && raw !== '') {
            const num = Number(raw);
            obj[h] = Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(raw) ? num : raw;
          }
        });
        return { id: randomId(), ...obj };
      });
      // 追加模式
      const store = csvModule as never;
      for (const r of rows) {
        await idb.put(store, r);
      }
      toast.success(`已导入 ${rows.length} 条记录`);
      void refresh();
    } catch {
      toast.error('CSV 解析失败');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">备份与恢复</h1>
        <p className="text-sm text-muted-foreground">数据仅存本机，导出即安心</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'json' | 'csv')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="json">JSON 完整备份</TabsTrigger>
          <TabsTrigger value="csv">CSV 模块导出</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'json' ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileJson className="size-4 text-primary" /> 完整备份
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                将全部业务数据导出为 JSON 文件保存至本地，可随时完整恢复。
              </p>
              <Button className="w-full" onClick={() => void exportJSON()}>
                <Download className="mr-1 size-4" /> 导出 JSON 备份
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="size-4 text-primary" /> 完整恢复
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">选择本地 JSON 备份文件执行完整数据还原。</p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
                <HardDrive className="size-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">点击选择备份文件</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importJSON(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="size-4 text-primary" /> 模块导出
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">模块</p>
                  <Select value={csvModule} onValueChange={setCsvModule}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULES.map((m) => (
                        <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">时间范围</p>
                  <Select value={csvRange} onValueChange={setCsvRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">近7天</SelectItem>
                      <SelectItem value="month">本月</SelectItem>
                      <SelectItem value="year">本年</SelectItem>
                      <SelectItem value="all">全部</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full" onClick={() => void exportCSV()}>
                <Download className="mr-1 size-4" /> 导出 CSV
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="size-4 text-primary" /> 导入 CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">以追加模式导入 CSV 数据到当前模块。</p>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
                <FileSpreadsheet className="size-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">选择 CSV 文件</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importCSV(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
