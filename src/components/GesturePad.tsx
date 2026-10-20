// 手势绘制组件：整页/区域自由绘制、多笔累积保留、撤回上一笔、清除
// mode=auto：停顿自动尝试比对（解锁）；mode=manual：点“画好了”提交（设置）
// EXPORTS: GesturePad (default)

import { useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, Check } from 'lucide-react';
import { NEON_COLORS, type GesturePadProps, type Stroke } from '@/lib/neon';
import { cn } from '@/lib/utils';

export default function GesturePad({
  onComplete,
  error,
  color,
  showColorPicker = false,
  onPickColor,
  autoSubmitDelay = 700,
  fullscreen = false,
  mode = 'auto',
  onEmpty,
  toolsClassName,
  doneClassName,
  pickerClassName,
}: GesturePadProps & {
  fullscreen?: boolean;
  mode?: 'auto' | 'manual';
  onEmpty?: () => void;
  toolsClassName?: string;
  doneClassName?: string;
  pickerClassName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmentsRef = useRef<Stroke[]>([]);
  const currentRef = useRef<Stroke>([]);
  const drawingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, force] = useState(0);

  // 同步 canvas 内部分辨率与 CSS 尺寸（防止 0 尺寸画不上）
  const ensureSize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { r, ctx };
  };

  const norm = (canvas: HTMLCanvasElement, x: number, y: number): [number, number] => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return [0, 0];
    return [((x - r.left) / r.width) * 100, ((y - r.top) / r.height) * 100];
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sized = ensureSize();
    if (!sized) return;
    const { r, ctx } = sized;
    ctx.clearRect(0, 0, r.width, r.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const all = [...segmentsRef.current, currentRef.current];
    for (const seg of all) {
      if (seg.length < 2) continue;
      ctx.beginPath();
      seg.forEach(([x, y], i) => {
        const px = (x / 100) * r.width;
        const py = (y / 100) * r.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const fit = () => {
      ensureSize();
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const collect = (): Stroke[] =>
    segmentsRef.current.filter((s) => s.length >= 2);

  const trySubmit = () => {
    clearTimer();
    const segs = collect();
    if (segs.length >= 1) {
      onComplete(segs);
    } else {
      onEmpty?.();
    }
  };

  const handleStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    clearTimer();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    drawingRef.current = true;
    currentRef.current = [norm(canvas, e.clientX, e.clientY)];
    redraw();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const p = norm(canvas, e.clientX, e.clientY);
    const last = currentRef.current[currentRef.current.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) return;
    currentRef.current.push(p);
    redraw();
  };

  const handleEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentRef.current.length >= 2) {
      segmentsRef.current.push(currentRef.current);
    }
    currentRef.current = [];
    force((n) => n + 1);
    if (mode === 'auto') {
      clearTimer();
      timerRef.current = setTimeout(trySubmit, autoSubmitDelay);
    }
  };

  const undo = () => {
    clearTimer();
    segmentsRef.current.pop();
    redraw();
    force((n) => n + 1);
  };

  const clearAll = () => {
    clearTimer();
    segmentsRef.current = [];
    currentRef.current = [];
    const canvas = canvasRef.current;
    const sized = canvas && ensureSize();
    if (sized) sized.ctx.clearRect(0, 0, sized.r.width, sized.r.height);
    force((n) => n + 1);
  };

  const toolBtn =
    'flex items-center gap-1 rounded-full bg-black/25 px-2.5 py-1.5 text-xs text-white/95 backdrop-blur hover:bg-black/40';

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-0'
          : 'relative w-full'
      }
    >
      <canvas
        ref={canvasRef}
        className={`block touch-none ${
          fullscreen ? 'h-full w-full' : 'h-[44vh] w-full rounded-2xl'
        }`}
        style={{ background: 'transparent' }}
        onPointerDown={handleStart}
        onPointerMove={handleMove}
        onPointerUp={handleEnd}
        onPointerCancel={handleEnd}
        onPointerLeave={handleEnd}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className={cn('absolute z-10 flex gap-2', toolsClassName ?? 'right-3 top-3')}>
        <button type="button" onClick={undo} className={toolBtn}>
          <Undo2 className="size-3.5" /> 撤回
        </button>
        <button type="button" onClick={clearAll} className={toolBtn}>
          <Eraser className="size-3.5" /> 清除
        </button>
      </div>

      {mode === 'manual' && (
        <button
          type="button"
          onClick={trySubmit}
          className={cn(
            'z-10 flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow hover:opacity-90',
            doneClassName ?? 'absolute bottom-4 right-3',
          )}
        >
          <Check className="size-4" /> 画好了
        </button>
      )}

      {showColorPicker && (
        <div
          className={cn(
            'absolute left-0 right-0 z-10 flex flex-wrap items-center justify-center gap-2 px-4',
            pickerClassName ?? 'bottom-4',
          )}
        >
          {NEON_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPickColor?.(c)}
              className="size-7 rounded-full transition-transform"
              style={{
                background: c,
                boxShadow: `0 0 10px ${c}`,
                transform: color === c ? 'scale(1.25)' : 'scale(1)',
                outline: color === c ? '2px solid #fff' : 'none',
              }}
              aria-label={c}
            />
          ))}
        </div>
      )}

      {error && (
        <p className="absolute bottom-20 left-0 right-0 z-10 px-4 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
