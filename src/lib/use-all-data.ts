// 统一数据加载 hook：一次性加载全部业务数据并提供刷新
// EXPORTS: useAllData (default)

import { useCallback, useEffect, useState } from 'react';
import { service } from './service';
import type {
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
} from './types';

export interface IAllData {
  transactions: ITransaction[];
  tasks: ITask[];
  pomodoros: IPomodoro[];
  diaries: IDiary[];
  memos: IMemo[];
  habits: IHabit[];
  checkins: ICheckin[];
  health: IHealth[];
  periods: IPeriod[];
  goals: IGoal[];
  countdowns: ICountdown[];
  events: ICalendarEvent[];
  reviews: IReview[];
}

const EMPTY: IAllData = {
  transactions: [],
  tasks: [],
  pomodoros: [],
  diaries: [],
  memos: [],
  habits: [],
  checkins: [],
  health: [],
  periods: [],
  goals: [],
  countdowns: [],
  events: [],
  reviews: [],
};

export default function useAllData() {
  const [data, setData] = useState<IAllData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return Promise.all([
      service.transactions.all(),
      service.tasks.all(),
      service.pomodoros.all(),
      service.diaries.all(),
      service.memos.all(),
      service.habits.all(),
      service.checkins.all(),
      service.health.all(),
      service.periods.all(),
      service.goals.all(),
      service.countdowns.all(),
      service.events.all(),
      service.reviews.all(),
    ])
      .then(
        ([transactions, tasks, pomodoros, diaries, memos, habits, checkins, health, periods, goals, countdowns, events, reviews]) => {
          setData({
            transactions,
            tasks,
            pomodoros,
            diaries,
            memos,
            habits,
            checkins,
            health,
            periods,
            goals,
            countdowns,
            events,
            reviews,
          });
          return true;
        },
      )
      .catch(() => false)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, refresh: load };
}
