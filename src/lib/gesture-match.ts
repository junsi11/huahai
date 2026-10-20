// 手势笔迹匹配工具：多笔分段、重采样、归一化、同类形状容错比对
// EXPORTS: resamplePoints, normalizePoints, strokeSimilarity, isGestureMatch

type Stroke = Array<[number, number]>;
// 兼容：可传多段 segments，也可传单段扁平点
export type GestureInput = Stroke | Stroke[];

// 把输入规整为分段数组
export function toSegments(g: GestureInput): Stroke[] {
  if (!g || g.length === 0) return [];
  const first = g[0] as unknown;
  // 段数组：首项是一个点数组 [x,y]；扁平点：首项是数字对
  if (Array.isArray(first) && first.length === 2 && typeof first[0] === 'number') {
    // first=[x,y]，说明整体是扁平点序列
    return [g as Stroke];
  }
  return g as Stroke[];
}

// 重采样到固定数量（线性插值），消除笔画速度差异
export function resamplePoints(points: Stroke, count = 48): Stroke {
  if (points.length <= 1) return points;
  if (points.length === count) return points;
  const lens: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    total += d;
    lens.push(total);
  }
  if (total <= 0) return points.slice(0, count);
  const out: Stroke = [];
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * total;
    let seg = lens.findIndex((l) => l >= target);
    if (seg <= 0) seg = 1;
    const segLen = lens[seg] - lens[seg - 1];
    const t = segLen > 0 ? (target - lens[seg - 1]) / segLen : 0;
    const a = points[seg - 1];
    const b = points[seg];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

// 归一化：平移中心到原点 + 缩放到固定包围盒（保持比例），消除大小/位置差异
export function normalizePoints(points: Stroke, size = 100): Stroke {
  if (points.length === 0) return points;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = size / Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale] as [number, number]);
}

// 单条笔画相似度 0-1（越大越像）
export function strokeSimilarity(a: Stroke, b: Stroke): number {
  const A = normalizePoints(resamplePoints(a, 48), 100);
  const B = normalizePoints(resamplePoints(b, 48), 100);
  if (A.length === 0 || B.length === 0) return 0;
  const n = Math.min(A.length, B.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.hypot(A[i][0] - B[i][0], A[i][1] - B[i][1]);
  }
  const avg = sum / n;
  // 平均距离 0 -> 1；分母放宽到 85，容纳胖瘦、比例、轻微不规则
  return Math.max(0, 1 - avg / 85);
}

// 多段整体相似度：段数对齐后逐段平均
export function gestureSimilarity(a: GestureInput, b: GestureInput): number {
  const A = toSegments(a);
  const B = toSegments(b);
  if (A.length === 0 || B.length === 0) return 0;
  const minSeg = Math.min(A.length, B.length);
  if (Math.abs(A.length - B.length) > 1) return 0;
  let total = 0;
  for (let i = 0; i < minSeg; i++) {
    total += strokeSimilarity(A[i], B[i]);
  }
  return total / minSeg;
}

// 是否匹配（同类形状即可，阈值进一步放宽，不规则但相像也过）
export function isGestureMatch(a: GestureInput, b: GestureInput, threshold = 0.4): boolean {
  return gestureSimilarity(a, b) >= threshold;
}
