// 主应用布局：左侧分类导航（可收缩）+ 顶部头像 + 右侧"xxx的工作台"
// EXPORTS: MainLayout

import { useEffect, useState } from 'react';
import { Outlet, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import EasterEgg from '@/components/EasterEgg';
import {
  LayoutDashboard,
  Wallet,
  CalendarDays,
  Timer,
  Repeat,
  BookOpen,
  StickyNote,
  HeartPulse,
  Target,
  BarChart3,
  Database,
  CalendarRange,
  Settings,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useOrientationBg } from '@/lib/use-orientation-bg';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Image } from '@/components/ui/image';
import { store } from '@/lib/localstore';
import { service } from '@/lib/service';

interface INavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hidden?: boolean;
}
interface INavGroup {
  title: string;
  items: INavItem[];
}

const NAV: INavGroup[] = [
  {
    title: '',
    items: [{ path: '/home', label: '工作台', icon: LayoutDashboard }],
  },
  {
    title: '生活',
    items: [
      { path: '/ledger', label: '记账', icon: Wallet },
      { path: '/calendar', label: '日历', icon: CalendarDays },
      { path: '/pomodoro', label: '番茄专注', icon: Timer },
      { path: '/habits', label: '习惯打卡', icon: Repeat },
    ],
  },
  {
    title: '记录',
    items: [
      { path: '/diary', label: '日记', icon: BookOpen },
      { path: '/memo', label: '备忘录', icon: StickyNote },
      { path: '/health', label: '健康心情', icon: HeartPulse },
    ],
  },
  {
    title: '成长',
    items: [
      { path: '/goals', label: '目标倒计时', icon: Target },
      { path: '/review', label: '回忆复盘', icon: BarChart3 },
    ],
  },
  {
    title: '工具',
    items: [
      { path: '/schedule', label: '课程表', icon: CalendarRange },
      { path: '/backup', label: '备份', icon: Database },
    ],
  },
  {
    title: '系统',
    items: [{ path: '/settings', label: '设置', icon: Settings }],
  },
];

// 全屏无侧栏子页（保留机制，当前无页面使用；所有页面均带侧栏，手机靠系统返回手势）
const SUB_ROUTES: string[] = [];

export const MainLayout = () => {
  const { ready, hasAccount, loggedIn, hasGesture, accountId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => store.get<boolean>('nav_collapsed', false),
  );
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(
    () => store.get<string | null>('avatar', null),
  );
  const [workClicks, setWorkClicks] = useState(0);
  const [egg, setEgg] = useState<{ src: string; text?: string } | null>(null);
  const bg = useOrientationBg();
  const [menuOpen, setMenuOpen] = useState(false);

  // 滚动回顶部（必须在条件 return 之前调用 hook）
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // 安卓物理/边缘返回：非工作台一律先回工作台，仅在工作台放行给系统退出
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', () => {
          if (location.pathname !== '/home') {
            navigate('/home');
          } else {
            // 工作台：按返回退到后台，而不是回到鉴权页或卡死
            void App.minimizeApp();
          }
        });
        if (cancelled) {
          listener.remove();
          return;
        }
        remove = () => listener.remove();
      } catch {
        // 非原生环境忽略
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [location.pathname, navigate]);

  // 加载当前账号用户名
  useEffect(() => {
    let alive = true;
    if (accountId) {
      service.accounts
        .get(accountId)
        .then((a) => {
          if (alive && a) setUsername(a.username);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [accountId]);

  // 未完成初始化：占位
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  // 未授权：重定向到登录
  if (!hasAccount || !loggedIn) {
    return <Navigate to="/login" replace />;
  }
  if (!hasGesture) {
    return <Navigate to="/gesture-setup" replace />;
  }

  // 子页面：全屏无侧栏
  if (SUB_ROUTES.some((p) => location.pathname.startsWith(p))) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Outlet />
      </div>
    );
  }

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    store.set('nav_collapsed', next);
  };

  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* 方向自适应淡背景（横屏 bjhp / 竖屏 ssbj） */}
      <Image
        src={bg.src}
        alt=""
        className="fixed inset-0 -z-10 h-full w-full object-cover opacity-20"
        style={{ objectPosition: bg.objectPosition }}
        loading="eager"
      />

      {/* 竖屏抽屉遮罩 */}
      {bg.isPortrait && menuOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* 左侧导航栏：横屏固定侧栏，竖屏抽屉 */}
      <aside
        className={cn(
          'z-30 flex h-screen shrink-0 flex-col border-r bg-card/90 backdrop-blur transition-all duration-200',
          bg.isPortrait
            ? cn(
                'fixed left-0 top-0 transition-transform',
                menuOpen ? 'translate-x-0' : '-translate-x-full',
                collapsed ? 'w-14' : 'w-64',
              )
            : cn('sticky top-0', collapsed ? 'w-14' : 'w-52'),
        )}
      >
        {/* 顶部头像区 */}
        <div className="flex flex-col items-center gap-2 border-b px-2 py-4">
          <div className="flex w-full items-center gap-2">
            {avatar ? (
              <img
                src={avatar}
                alt="头像"
                className="size-9 shrink-0 rounded-full object-cover ring-2 ring-primary/30"
              />
            ) : (
              <CircleUser className={cn('shrink-0 text-primary', collapsed ? 'size-9' : 'size-9')} />
            )}
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{username || '花海'}</div>
                <div className="truncate text-[10px] text-muted-foreground">私人工作台</div>
              </div>
            )}
          </div>
        </div>

        {/* 导航分组 */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((group) => (
            <div key={group.title || 'top'} className="mb-3">
              {group.title && !collapsed && (
                <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent"
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'size-5 shrink-0',
                              isActive ? 'text-primary' : 'text-muted-foreground',
                            )}
                          />
                          {!collapsed && (
                            <span
                              className={cn(
                                'truncate',
                                isActive ? 'font-medium text-primary' : 'text-muted-foreground',
                              )}
                            >
                              {item.label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 收缩按钮 */}
        <button
          onClick={toggleCollapse}
          className="flex w-full items-center justify-center border-t py-3 text-muted-foreground hover:bg-accent"
          title={collapsed ? '展开' : '收缩'}
        >
          {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        </button>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* 顶部栏：仅工作台首页显示"xxx的工作台"标题，其余页面只留竖屏汉堡 */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/80 px-4 py-4 backdrop-blur sm:px-6">
          <button
            onClick={() => {
              if (bg.isPortrait) setMenuOpen(true);
              else toggleCollapse();
            }}
            className="rounded-lg p-1 hover:bg-accent"
            aria-label="打开导航"
          >
            <Menu className="size-5" />
          </button>
          {location.pathname === '/home' && (
            <div>
              <button
                className="text-left text-lg font-semibold"
                onClick={() => {
                  setWorkClicks((c) => {
                    const n = c + 1;
                    if (n >= 6) {
                      setEgg({ src: 'mom.mp4' });
                      return 0;
                    }
                    return n;
                  });
                }}
                title={workClicks > 0 ? `再点 ${6 - workClicks} 次有惊喜` : undefined}
              >
                {username ? `${username}的工作台` : '花海工作台'}
              </button>
              <p className="text-xs text-muted-foreground">记录生活，慢慢变好</p>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      {egg && <EasterEgg src={egg.src} text={egg.text} onClose={() => setEgg(null)} />}
    </div>
  );
};
