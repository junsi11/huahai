// 手势解锁页：只留 花海/绘制手势解锁/切换账号/撤回/清除；30秒未成功弹词输入；点花海6次彩蛋
// EXPORTS: GestureUnlockPage (default)

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Image } from '@/components/ui/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GesturePad from '@/components/GesturePad';
import { service } from '@/lib/service';
import { auth } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { isGestureMatch } from '@/lib/gesture-match';
import { useOrientationBg } from '@/lib/use-orientation-bg';
import type { Stroke } from '@/lib/neon';

const LOCK_SECONDS = 30;
const MAX_TRIES = 5;
const WORD_TIMEOUT = 30;

export default function GestureUnlockPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const bg = useOrientationBg();
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [penColor, setPenColor] = useState('#FF4D9E');
  const confRef = useRef<{ segments?: Stroke[]; points?: Stroke; label?: string } | null>(null);
  const readyRef = useRef(false);
  const triesRef = useRef(0);
  const [padKey, setPadKey] = useState(0);
  const [showWord, setShowWord] = useState(false);
  const [word, setWord] = useState('');
  const flowerClicks = useRef(0);

  // 读取当前账号自己的手势
  useEffect(() => {
    let alive = true;
    const accountId = auth.getCurrentAccount();
    service.gesture.get(accountId).then((conf) => {
      if (!alive) return;
      if (!conf || (!conf.segments?.length && !conf.points?.length)) {
        navigate('/gesture-setup', { replace: true });
        return;
      }
      confRef.current = conf;
      readyRef.current = true;
      if (conf.color) setPenColor(conf.color);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 错误锁定倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [countdown > 0]);

  // 30 秒未成功 -> 弹词输入框
  useEffect(() => {
    const t = setTimeout(() => setShowWord(true), WORD_TIMEOUT * 1000);
    return () => clearTimeout(t);
  }, []);

  const enterHome = () => {
    triesRef.current = 0;
    refresh();
    navigate('/home');
  };

  const onComplete = (segments: Stroke[]) => {
    if (countdown > 0) return;
    const conf = confRef.current;
    if (!readyRef.current || !conf) return;
    const ref = conf.segments && conf.segments.length > 0 ? conf.segments : conf.points!;
    if (isGestureMatch(ref, segments)) {
      toast.success('解锁成功');
      enterHome();
      return;
    }
    triesRef.current += 1;
    setError('不太像，可撤回补一笔或清除重画');
    if (triesRef.current >= MAX_TRIES) {
      setCountdown(LOCK_SECONDS);
      setError(`错误次数过多，已锁定 ${LOCK_SECONDS} 秒`);
      setPadKey((k) => k + 1);
    }
  };

  const submitWord = () => {
    const conf = confRef.current;
    const expect = (conf?.label || '').trim().toLowerCase();
    if (!expect) {
      setShowWord(false);
      return;
    }
    if (word.trim().toLowerCase() === expect) {
      toast.success('解锁成功');
      enterHome();
    } else {
      setError('词不对，再想想');
    }
  };

  // 彩蛋：点“花海”6 次直接解锁，无提示
  const onFlowerClick = () => {
    flowerClicks.current += 1;
    if (flowerClicks.current >= 6) enterHome();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Image
        src={bg.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: bg.objectPosition }}
        loading="eager"
      />
      <div className="absolute inset-0 bg-background/25" />

      <GesturePad
        key={padKey}
        fullscreen
        mode="auto"
        onComplete={onComplete}
        error={countdown > 0 ? `已锁定 ${countdown} 秒` : error}
        color={penColor}
        toolsClassName="right-3 top-16"
      />

      {/* 标题（可被笔迹盖住）；点 6 次彩蛋 */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 z-[2] text-center">
        <h1
          onClick={onFlowerClick}
          className="pointer-events-auto inline-block text-2xl font-semibold text-white drop-shadow"
        >
          花海
        </h1>
        <p className="mt-1 text-sm text-white/90 drop-shadow">
          {countdown > 0 ? `${countdown} 秒后可重试` : '绘制手势解锁'}
        </p>
      </div>

      {/* 最下面：忘记手势密码 / 切换账号登录 */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex flex-col items-center gap-1">
        {countdown <= 0 && (
          <>
            <Button
              variant="ghost"
              className="text-white drop-shadow"
              onClick={() => navigate('/login', { state: { resetGesture: true } })}
            >
              忘记手势密码？
            </Button>
            <Button
              variant="ghost"
              className="text-white/80 drop-shadow"
              onClick={() => navigate('/login')}
            >
              切换账号登录
            </Button>
          </>
        )}
      </div>

      {/* 30 秒未成功：输入第一次设置的词 */}
      {showWord && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 px-6">
          <div className="w-[min(92%,22rem)] space-y-3 rounded-2xl bg-white/95 p-5">
            <p className="text-center text-sm text-foreground">你绘制的是什么？</p>
            <Input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="填写第一次设置的词，如：爱心"
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitWord();
              }}
            />
            <Button className="w-full" onClick={submitWord}>
              确定
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowWord(false)}>
              返回继续画
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
