import { Routes, Route } from 'react-router-dom';
import AuthProvider from '@/components/AuthProvider';
import { AuthLayout } from '@/components/AuthLayout';
import { MainLayout } from '@/components/MainLayout';
import AuthGate from '@/pages/AuthGate/AuthGate';
import LoginPage from '@/pages/Login/Login';
import RegisterPage from '@/pages/Register/Register';
import GestureSetupPage from '@/pages/GestureSetup/GestureSetup';
import GestureUnlockPage from '@/pages/GestureUnlock/GestureUnlock';
import DashboardPage from '@/pages/Dashboard/Dashboard';
import LedgerPage from '@/pages/Ledger/Ledger';
import CalendarPage from '@/pages/Calendar/Calendar';
import SettingsPage from '@/pages/Settings/Settings';
import TasksPage from '@/pages/Tasks/Tasks';
import PomodoroPage from '@/pages/Pomodoro/Pomodoro';
import DiaryPage from '@/pages/Diary/Diary';
import MemoPage from '@/pages/Memo/Memo';
import HabitsPage from '@/pages/Habits/Habits';
import HealthPage from '@/pages/Health/Health';
import GoalsPage from '@/pages/Goals/Goals';
import ReviewPage from '@/pages/Review/Review';
import SchedulePage from '@/pages/Schedule/Schedule';
import BackupPage from '@/pages/Backup/Backup';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* 鉴权相关，独立全屏布局 */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/gesture-setup" element={<GestureSetupPage />} />
          <Route path="/gesture-unlock" element={<GestureUnlockPage />} />
        </Route>

        {/* 主应用：底部导航布局 */}
        <Route element={<MainLayout />}>
          <Route index element={<AuthGate />} />
          <Route path="/home" element={<DashboardPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/memo" element={<MemoPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/backup" element={<BackupPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
