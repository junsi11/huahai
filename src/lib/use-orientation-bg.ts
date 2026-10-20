// 根据视口方向选择背景：横屏用 bjhp（横图），竖屏用 ssbj（竖图）
// EXPORTS: useOrientationBg

import { useEffect, useState } from 'react';

const BASE = (import.meta.env.MIAODA_CLIENT_BASE_PATH || '').replace(/\/$/, '') + '/';

export interface OrientationBg {
  src: string;
  objectPosition: string;
  isPortrait: boolean;
}

function detect(): OrientationBg {
  const isPortrait = window.innerHeight > window.innerWidth * 1.05;
  return {
    isPortrait,
    // 竖屏用竖图（人物居中、脸在上部），横屏用横图（人物偏中右）
    src: `${BASE}assets/${isPortrait ? 'bg-portrait.png' : 'bg-landscape.png'}`,
    // 竖图脸在上方约 15%，横图脸在中上部，定位保留人脸
    objectPosition: isPortrait ? '50% 12%' : '50% 35%',
  };
}

export function useOrientationBg(): OrientationBg {
  const [bg, setBg] = useState<OrientationBg>(detect);
  useEffect(() => {
    const onResize = () => setBg(detect());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bg;
}
