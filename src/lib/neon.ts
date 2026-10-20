// 手势相关共享常量与类型（独立文件，供设置/解锁/画板共用）

// 单条笔画的归一化点序列（0-100）
export type Stroke = Array<[number, number]>;

// 首次设置手势时可选的荧光色板
export const NEON_COLORS = [
  '#FF4D9E',
  '#FFE14D',
  '#4DFFB8',
  '#4DC3FF',
  '#B06BFF',
  '#FF7A4D',
  '#FF5C5C',
  '#7CFF4D',
];

export interface GesturePadProps {
  onComplete: (segments: Stroke[]) => void;
  error?: string;
  color: string;
  showColorPicker?: boolean;
  onPickColor?: (c: string) => void;
  autoSubmitDelay?: number;
}
