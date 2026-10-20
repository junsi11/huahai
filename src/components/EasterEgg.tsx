// 彩蛋全屏：本地视频播放（自动循环、可开关声音、可关闭）
// 用法：<EasterEgg src="sister.mp4" text="曹馨云天天开心❤" onClose={...} />
import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

const _base = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '');
const BASE = _base ? _base + '/' : '';

export default function EasterEgg({ src, text, onClose }: { src: string; text?: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  // 自动播放（先静音保证能起播），切换声音
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (!muted) void v.play().catch(() => setMuted(true));
  }, [muted]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={`${BASE}assets/videos/${src}`}
        autoPlay
        loop
        playsInline
        muted={muted}
        className="h-full w-full object-contain"
      />

      {/* 声音开关 */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white/90 backdrop-blur"
        title={muted ? '开启声音' : '关闭声音'}
      >
        {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>
      <button
        onClick={onClose}
        className="absolute left-4 top-4 z-20 flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white/90 backdrop-blur"
        title="关闭"
      >
        <X className="size-5" />
      </button>

      {text && (
        <div className="pointer-events-none absolute bottom-10 left-0 right-0 z-10 text-center">
          <span className="text-2xl font-bold text-white drop-shadow-[0_0_14px_rgba(255,180,210,0.9)] sm:text-3xl">{text}</span>
        </div>
      )}
    </div>
  );
}
