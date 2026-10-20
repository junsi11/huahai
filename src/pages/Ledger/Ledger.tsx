// 记账模块：收支录入（备注可传图）、年月日明细、收支筛选、编辑/删除、统计图表
// EXPORTS: LedgerPage (default)

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Utensils, Bus, ShoppingBag, Gamepad2, Home, Stethoscope, DollarSign, Trophy, Gift, ImagePlus, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactECharts from 'echarts-for-react';
import useAllData from '@/lib/use-all-data';
import { service } from '@/lib/service';
import { randomId } from '@/lib/crypto';
import { format } from 'date-fns';
import type { ITransaction } from '@/lib/types';

const EXPENSE_CATS = [
  { key: '餐饮', icon: Utensils },
  { key: '交通', icon: Bus },
  { key: '购物', icon: ShoppingBag },
  { key: '娱乐', icon: Gamepad2 },
  { key: '生活', icon: Home },
  { key: '医疗', icon: Stethoscope },
];
const INCOME_CATS = [
  { key: '工资', icon: DollarSign },
  { key: '奖金', icon: Trophy },
  { key: '红包', icon: Gift },
  { key: '其他', icon: DollarSign },
];
const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// 筛选维度
type FilterType = 'all' | 'income' | 'expense';
// 时间粒度
type TimeScope = 'day' | 'month' | 'year';

export default function LedgerPage() {
  const { data, refresh } = useAllData();
  // 录入/编辑表单
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('餐饮');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ITransaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 筛选
  const [scope, setScope] = useState<TimeScope>('month');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [pickerDate, setPickerDate] = useState(today());
  const [pickerMonth, setPickerMonth] = useState(today().slice(0, 7));
  const [pickerYear, setPickerYear] = useState(String(new Date().getFullYear()));

  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  // 打开新增
  const openAdd = () => {
    setEditing(null);
    setType('expense');
    setCategory('餐饮');
    setAmount('');
    setDate(today());
    setNote('');
    setImage(null);
    setOpen(true);
  };
  // 打开编辑
  const openEdit = (t: ITransaction) => {
    setEditing(t);
    setType(t.type);
    setCategory(t.category);
    setAmount(String(t.amount));
    setDate(t.date);
    setNote(t.note ?? '');
    setImage(t.image ?? null);
    setOpen(true);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // 压缩到合理大小
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImage(url);
    };
    reader.readAsDataURL(f);
  };

  const onSave = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error('请输入有效金额');
      return;
    }
    if (!category) {
      toast.error('请选择分类');
      return;
    }
    if (editing) {
      const updated: ITransaction = {
        ...editing,
        type,
        category,
        amount: amt,
        date,
        note: note.trim() || undefined,
        image: image ?? undefined,
      };
      await service.transactions.put(updated);
      toast.success('已修改');
    } else {
      const tx: ITransaction = {
        id: randomId(),
        type,
        category,
        amount: amt,
        date,
        note: note.trim() || undefined,
        image: image ?? undefined,
        createdAt: Date.now(),
      };
      await service.transactions.put(tx);
      toast.success('记账成功');
    }
    setOpen(false);
    void refresh();
  };

  const onDelete = async () => {
    if (!deleteId) return;
    await service.transactions.del(deleteId);
    setDeleteId(null);
    toast.success('已删除');
    void refresh();
  };

  // 筛选后的记录
  const filtered = useMemo(() => {
    let list = data.transactions;
    if (scope === 'day') list = list.filter((t) => t.date === pickerDate);
    else if (scope === 'month') list = list.filter((t) => t.date.slice(0, 7) === pickerMonth);
    else list = list.filter((t) => t.date.slice(0, 4) === pickerYear);
    if (filterType === 'income') list = list.filter((t) => t.type === 'income');
    else if (filterType === 'expense') list = list.filter((t) => t.type === 'expense');
    return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [data.transactions, scope, pickerDate, pickerMonth, pickerYear, filterType]);

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalProfit = totalIncome - totalExpense;

  // 当前筛选范围内按日聚合（用于图表）
  const dayStats = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const t of filtered) {
      const d = map.get(t.date) ?? { income: 0, expense: 0 };
      if (t.type === 'income') d.income += t.amount;
      else d.expense += t.amount;
      map.set(t.date, d);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date: date.slice(5), income: v.income, expense: v.expense }));
  }, [filtered]);

  // 支出分类占比
  const expenseByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filtered.filter((x) => x.type === 'expense')) {
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const years = useMemo(() => {
    const set = new Set(data.transactions.map((t) => t.date.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data.transactions]);
  const months = useMemo(() => {
    const set = new Set(data.transactions.map((t) => t.date.slice(0, 7)));
    set.add(today().slice(0, 7));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [data.transactions]);

  const chartOption = {
    color: ['#5D8A72', '#E79BB0'],
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'], top: 0 },
    grid: { left: 40, right: 16, top: 32, bottom: 16 },
    xAxis: { type: 'category', data: dayStats.map((d) => d.date), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [
      { name: '收入', type: 'bar', data: dayStats.map((d) => d.income), itemStyle: { color: '#5D8A72' }, barMaxWidth: 14 },
      { name: '支出', type: 'bar', data: dayStats.map((d) => d.expense), itemStyle: { color: '#E79BB0' }, barMaxWidth: 14 },
    ],
  };

  const pieOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        data: expenseByCat.length
          ? expenseByCat
          : [{ name: '暂无数据', value: 1, itemStyle: { color: '#eee' } }],
        label: { fontSize: 11 },
      },
    ],
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">记账</h1>
          <p className="text-sm text-muted-foreground">
            总收入 ¥{totalIncome} · 总支出 ¥{totalExpense} · 结余 ¥{totalProfit}
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="mr-1 size-4" /> 记一笔
        </Button>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Tabs value={scope} onValueChange={(v) => setScope(v as TimeScope)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="day">按日</TabsTrigger>
                <TabsTrigger value="month">按月</TabsTrigger>
                <TabsTrigger value="year">按年</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as FilterType)}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="income">总收入</SelectItem>
                <SelectItem value="expense">总支出</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'day' && (
            <Input type="date" value={pickerDate} onChange={(e) => setPickerDate(e.target.value)} />
          )}
          {scope === 'month' && (
            <Select value={pickerMonth} onValueChange={setPickerMonth}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {scope === 'year' && (
            <Select value={pickerYear} onValueChange={setPickerYear}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* 图表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">收支对比</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts option={chartOption} style={{ height: 180 }} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">支出分类占比</CardTitle>
        </CardHeader>
        <CardContent>
          <ReactECharts option={pieOption} style={{ height: 180 }} />
        </CardContent>
      </Card>

      {/* 明细 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">账单明细（{filtered.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无记录
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((t) => {
                const cat = ALL_CATS.find((c) => c.key === t.category);
                const Icon = cat?.icon ?? DollarSign;
                return (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{t.category}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.date}
                        {t.note ? ` · ${t.note}` : ''}
                        {t.image && ' · 📷'}
                      </div>
                    </div>
                    <div
                      className={t.type === 'income' ? 'font-semibold text-success' : 'font-semibold text-destructive'}
                    >
                      {t.type === 'income' ? '+' : '-'}¥{t.amount}
                    </div>
                    <button
                      onClick={() => openEdit(t)}
                      className="text-muted-foreground hover:text-primary"
                      aria-label="编辑"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(t.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="删除"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 录入/编辑对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? '修改账单' : '记一笔'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Tabs value={type} onValueChange={(v) => {
              const t = v as 'expense' | 'income';
              setType(t);
              setCategory(t === 'expense' ? '餐饮' : '工资');
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense">支出</TabsTrigger>
                <TabsTrigger value="income">收入</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid grid-cols-3 gap-2">
              {cats.map((c) => {
                const Icon = c.icon;
                const active = category === c.key;
                return (
                  <Button
                    key={c.key}
                    variant={active ? 'default' : 'outline'}
                    className="h-16 flex-col gap-1"
                    onClick={() => setCategory(c.key)}
                    type="button"
                  >
                    <Icon className="size-4" />
                    <span className="text-xs">{c.key}</span>
                  </Button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>金额</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>日期</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input
                placeholder="选填"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>备注图片</Label>
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                  <ImagePlus className="size-4" />
                  选择图片
                  <input type="file" accept="image/*" className="hidden" onChange={pickImage} />
                </label>
                {image && (
                  <div className="relative">
                    <img src={image} alt="note" className="h-14 w-14 rounded-lg object-cover" />
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
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <Button onClick={() => void onSave()}>保存</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条账单？</AlertDialogTitle>
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
