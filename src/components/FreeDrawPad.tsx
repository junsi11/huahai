// 自由手绘组件：多色画笔自选、橡皮、撤销、清空，导出 dataURL
// EXPORTS: FreeDrawPad (default)

import { useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#E79BB0', '#5D8A72', '#7B9AE5', '#F4A259', '#B080E0', '#C97A8E', '#4A90D9', '#E67E5A', '#2FBF9E', '#222222', '#8B4513', '#FF6B6B', '#3CB371', '#FFD700', '#FF69B4', '#87CEEB'];

export default function FreeDrawPad({
  value,
  onChange,
  height = 220,
}: {
  value?: string;
  onChange?: (dataUrl: string) => void;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#222222');
  const [penSize, setPenSize] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 初始化画布，载入初始值
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!loaded && value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLoaded(true);
      };
      img.src = value;
    }
  }, [value, loaded]);

  const pushHistory = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    historyRef.current.push(canvas.toDataURL());
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const pos = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastRef.current = pos(canvas, e);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      pushHistory(ctx, canvas);
      ctx.beginPath();
      ctx.moveTo(lastRef.current.x, lastRef.current.y);
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastRef.current) return;
    const p = pos(canvas, e);
    ctx.strokeStyle = eraser ? '#ffffff' : color;
    ctx.lineWidth = eraser ? penSize * 4 : penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };

  const onUp = () => {
    if (!drawing) return;
    setDrawing(false);
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange?.(canvas.toDataURL());
    }
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const last = historyRef.current.pop();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (last) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onChange?.(canvas.toDataURL());
      };
      img.src = last;
    } else {
      onChange?.(canvas.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushHistory(ctx, canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.(canvas.toDataURL());
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="flex flex-wrap gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setEraser(false);
              }}
              className={cn(
                'size-5 rounded-full border transition-transform',
                color === c && !eraser && 'ring-2 ring-primary ring-offset-1 scale-110',
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <button
          onClick={() => setEraser((v) => !v)}
          className={cn('flex items-center rounded-lg border p-1.5 text-muted-foreground', eraser && 'border-primary bg-primary/10 text-primary')}
          title="橡皮"
        >
          <Eraser className="size-4" />
        </button>
        <button onClick={undo} className="flex items-center rounded-lg border p-1.5 text-muted-foreground" title="撤销">
          <Undo2 className="size-4" />
        </button>
        <button onClick={clear} className="flex items-center rounded-lg border p-1.5 text-muted-foreground" title="清空">
          <Trash2 className="size-4" />
        </button>
        <select
          value={penSize}
          onChange={(e) => setPenSize(Number(e.target.value))}
          className="h-8 rounded-lg border px-1 text-xs"
          title="笔刷粗细"
        >
          <option value={2}>细</option>
          <option value={4}>中</option>
          <option value={7}>粗</option>
        </select>
      </div>
      <canvas
        ref={canvasRef}
        width={560}
        height={height * 2}
        className="w-full touch-none rounded-lg border border-dashed bg-white"
        style={{ height }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
    </div>
  );
}
