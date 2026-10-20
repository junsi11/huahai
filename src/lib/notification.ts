// 浏览器通知工具：申请权限 + 发送通知 + 声音提醒
// EXPORTS: requestNotifyPermission, notify, playBeep

export function requestNotifyPermission(): void {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function notify(title: string, body?: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/assets/icon.png' });
    } catch {
      /* 忽略 */
    }
  }
}

// 简单蜂鸣音（Web Audio）
export function playBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {
        /* 忽略 */
      }
    }, 800);
  } catch {
    /* 忽略 */
  }
}
