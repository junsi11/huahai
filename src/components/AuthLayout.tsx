// 鉴权布局：按横竖屏全屏花海背景（横屏 bjhp / 竖屏 ssbj）+ 居中内容
// EXPORTS: AuthLayout

import { Outlet } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useOrientationBg } from '@/lib/use-orientation-bg';

export const AuthLayout = () => {
  const bg = useOrientationBg();
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Image
        src={bg.src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: bg.objectPosition }}
        loading="eager"
      />
      <div className="absolute inset-0 bg-background/30" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
};
