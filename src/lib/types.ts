// EXPORTS: IAccount, IGestureConf, ITransaction, ITask, IPomodoro, IDiary, IMemo, ICheckin, IHealth, IPeriod, IGoal, ICountdown, ICalendarEvent, IReview, IMark, IDBEntity

export interface IAccount {
  id: string;
  account: string;       // 手机号或邮箱
  username: string;
  passwordHash: string;  // 加盐哈希
  salt: string;
  createdAt: number;
}

export interface IGestureConf {
  id: string;
  // 兼容旧版：单段扁平点序列（0-100 归一化）
  points?: Array<[number, number]>;
  // 多笔分段：每一段是一条笔画的归一化点序列
  segments: Array<Array<[number, number]>>;
  // 设置时选定的画笔颜色（荧光色），解锁时固定使用
  color: string;
  // 用户给手势起的名字（如“爱心”），仅作提示备注
  label?: string;
  // 手势类型：写字（char）或图形（shape），仅作备注
  kind?: 'char' | 'shape';
  createdAt: number;
}

export interface ITransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;          // YYYY-MM-DD
  note?: string;
  image?: string;        // 备注图片 dataURL
  createdAt: number;
}

export interface ITask {
  id: string;
  title: string;
  description?: string;
  due?: string;          // YYYY-MM-DD HH:mm
  priority: 'low' | 'medium' | 'high';
  remind?: boolean;
  done: boolean;
  createdAt: number;
}

export interface IPomodoro {
  id: string;
  date: string;          // YYYY-MM-DD
  focusMinutes: number;
  cycles: number;        // 本次完成的番茄数
  label?: string;        // 专注内容（学习英语等）
  createdAt: number;
}

export interface IDiary {
  id: string;
  date: string;          // YYYY-MM-DD
  mood?: string;
  weather?: string;
  content: string;
  images?: string[];     // Blob 数据 URL
  drawing?: string;      // 手绘数据 URL（与正文同篇，可直接写也可画）
  createdAt: number;
}

export interface IMemo {
  id: string;
  title: string;
  content?: string;
  date: string;
  tags: string[];
  pinned?: boolean;
  drawing?: string;      // 涂鸦 blob dataURL
  images?: string[];     // 图片 dataURL
  audio?: string;        // 录音 dataURL
  audioDuration?: number;
  remind?: boolean;
  createdAt: number;
}

export interface ICheckin {
  id: string;
  habitId: string;
  date: string;          // YYYY-MM-DD
  createdAt: number;
}

export interface IHabit {
  id: string;
  name: string;
  frequency: number;     // 目标次数（按 goalPeriod 周期）
  goalPeriod: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  color: string;
  createdAt: number;
}

export interface IHealth {
  id: string;
  date: string;
  sleep?: number;        // 小时
  weight?: number;
  exercise?: number;     // 分钟
  mood?: string;
  createdAt: number;
}

export interface IPeriod {
  id: string;
  start: string;         // YYYY-MM-DD
  end: string;           // YYYY-MM-DD
  flow?: string;
  feelings?: string[];
  note?: string;
  createdAt: number;
}

export interface IGoal {
  id: string;
  name: string;
  category: string;
  target: number;
  unit: string;
  startDate: string;
  endDate?: string;
  current: number;
  createdAt: number;
}

export interface ICountdown {
  id: string;
  name: string;
  date: string;          // 目标日期
  note?: string;
  remind?: boolean;      // 到点提醒
  createdAt: number;
}

export interface ICalendarEvent {
  id: string;
  date: string;
  title: string;
  color?: string;
  // 优先级：1重要且紧急 2紧急不重要 3重要不紧急 4不重要不紧急 5记账
  priority?: number;
  remind?: boolean;
  image?: string;         // 事件配图 dataURL
  createdAt: number;
}

export interface IReview {
  id: string;
  period: 'day' | 'week' | 'month' | 'year';
  key: string;           // 周期标识：日 yyyy-MM-dd / 周 yyyy-WW / 月 yyyy-MM / 年 yyyy
  situation?: string;   // 复盘情况（这一周期发生了什么）
  summary?: string;     // 复盘感想
  createdAt: number;
}

export interface IMark {
  id: string;
  date: string;
  type: string;
  color: string;
  createdAt: number;
}

export type IDBEntity =
  | IAccount
  | IGestureConf
  | ITransaction
  | ITask
  | IPomodoro
  | IDiary
  | IMemo
  | IHabit
  | ICheckin
  | IHealth
  | IPeriod
  | IGoal
  | ICountdown
  | ICalendarEvent
  | IReview
  | IMark;
