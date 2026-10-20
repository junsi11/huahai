// 花海 App 统一数据服务：封装全部实体读写，供页面调用
// EXPORTS: service

import { idb, STORES, type StoreName } from './db';
import type {
  IAccount,
  IGestureConf,
  ITransaction,
  ITask,
  IPomodoro,
  IDiary,
  IMemo,
  IHabit,
  ICheckin,
  IHealth,
  IPeriod,
  IGoal,
  ICountdown,
  ICalendarEvent,
  IReview,
  IMark,
} from './types';

function s(name: StoreName) {
  return name;
}

export const service = {
  accounts: {
    put: (v: IAccount) => idb.put(s('accounts'), v),
    get: (k: string) => idb.get<IAccount>(s('accounts'), k),
    all: () => idb.getAll<IAccount>(s('accounts')),
  },
  // 手势按账号独立存储：key 为账号 id，各账号互不干扰，不回退到别的账号
  gesture: {
    put: (accountId: string, v: Omit<IGestureConf, 'id'>) =>
      idb.put(s('gesture'), { ...v, id: accountId }),
    get: (accountId: string) => idb.get<IGestureConf>(s('gesture'), accountId),
    clear: (accountId: string) => idb.delete(s('gesture'), accountId),
  },
  transactions: {
    put: (v: ITransaction) => idb.put(s('transactions'), v),
    all: () => idb.getAll<ITransaction>(s('transactions')),
    del: (k: string) => idb.delete(s('transactions'), k),
    putAll: (v: ITransaction[]) => idb.putAll(s('transactions'), v),
    clear: () => idb.clear(s('transactions')),
  },
  tasks: {
    put: (v: ITask) => idb.put(s('tasks'), v),
    all: () => idb.getAll<ITask>(s('tasks')),
    del: (k: string) => idb.delete(s('tasks'), k),
    putAll: (v: ITask[]) => idb.putAll(s('tasks'), v),
    clear: () => idb.clear(s('tasks')),
  },
  pomodoros: {
    put: (v: IPomodoro) => idb.put(s('pomodoros'), v),
    all: () => idb.getAll<IPomodoro>(s('pomodoros')),
    putAll: (v: IPomodoro[]) => idb.putAll(s('pomodoros'), v),
    clear: () => idb.clear(s('pomodoros')),
  },
  diaries: {
    put: (v: IDiary) => idb.put(s('diaries'), v),
    all: () => idb.getAll<IDiary>(s('diaries')),
    del: (k: string) => idb.delete(s('diaries'), k),
    putAll: (v: IDiary[]) => idb.putAll(s('diaries'), v),
    clear: () => idb.clear(s('diaries')),
  },
  memos: {
    put: (v: IMemo) => idb.put(s('memos'), v),
    all: () => idb.getAll<IMemo>(s('memos')),
    del: (k: string) => idb.delete(s('memos'), k),
    putAll: (v: IMemo[]) => idb.putAll(s('memos'), v),
    clear: () => idb.clear(s('memos')),
  },
  habits: {
    put: (v: IHabit) => idb.put(s('habits'), v),
    all: () => idb.getAll<IHabit>(s('habits')),
    del: (k: string) => idb.delete(s('habits'), k),
    putAll: (v: IHabit[]) => idb.putAll(s('habits'), v),
    clear: () => idb.clear(s('habits')),
  },
  checkins: {
    put: (v: ICheckin) => idb.put(s('checkins'), v),
    all: () => idb.getAll<ICheckin>(s('checkins')),
    del: (k: string) => idb.delete(s('checkins'), k),
    putAll: (v: ICheckin[]) => idb.putAll(s('checkins'), v),
    clear: () => idb.clear(s('checkins')),
  },
  health: {
    put: (v: IHealth) => idb.put(s('health'), v),
    all: () => idb.getAll<IHealth>(s('health')),
    del: (k: string) => idb.delete(s('health'), k),
    putAll: (v: IHealth[]) => idb.putAll(s('health'), v),
    clear: () => idb.clear(s('health')),
  },
  periods: {
    put: (v: IPeriod) => idb.put(s('periods'), v),
    all: () => idb.getAll<IPeriod>(s('periods')),
    del: (k: string) => idb.delete(s('periods'), k),
    putAll: (v: IPeriod[]) => idb.putAll(s('periods'), v),
    clear: () => idb.clear(s('periods')),
  },
  goals: {
    put: (v: IGoal) => idb.put(s('goals'), v),
    all: () => idb.getAll<IGoal>(s('goals')),
    del: (k: string) => idb.delete(s('goals'), k),
    putAll: (v: IGoal[]) => idb.putAll(s('goals'), v),
    clear: () => idb.clear(s('goals')),
  },
  countdowns: {
    put: (v: ICountdown) => idb.put(s('countdowns'), v),
    all: () => idb.getAll<ICountdown>(s('countdowns')),
    del: (k: string) => idb.delete(s('countdowns'), k),
    putAll: (v: ICountdown[]) => idb.putAll(s('countdowns'), v),
    clear: () => idb.clear(s('countdowns')),
  },
  events: {
    put: (v: ICalendarEvent) => idb.put(s('events'), v),
    all: () => idb.getAll<ICalendarEvent>(s('events')),
    del: (k: string) => idb.delete(s('events'), k),
    putAll: (v: ICalendarEvent[]) => idb.putAll(s('events'), v),
    clear: () => idb.clear(s('events')),
  },
  reviews: {
    put: (v: IReview) => idb.put(s('reviews'), v),
    all: () => idb.getAll<IReview>(s('reviews')),
    del: (k: string) => idb.delete(s('reviews'), k),
    putAll: (v: IReview[]) => idb.putAll(s('reviews'), v),
    clear: () => idb.clear(s('reviews')),
  },
  marks: {
    put: (v: IMark) => idb.put(s('marks'), v),
    all: () => idb.getAll<IMark>(s('marks')),
    del: (k: string) => idb.delete(s('marks'), k),
    putAll: (v: IMark[]) => idb.putAll(s('marks'), v),
    clear: () => idb.clear(s('marks')),
  },
  rawStores: STORES,
};
