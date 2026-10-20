// 手势设置页：全屏直接在背景画 -> 画好后填名称（可切图形/写字）-> 保存
// EXPORTS: GestureSetupPage (default)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GesturePad from '@/components/GesturePad';
import { NEON_COLORS, type Stroke } from '@/lib/neon';
import { service } from '@/lib/service';
import { auth } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

export default function GestureSetupPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [stage, setStage] = useState<'draw' | 'name'>('draw');
  const [segments, setSegments] = useState<Stroke[]>([]);
  const [color, setColor] = useState(NEON_COLORS[0]);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'char' | 'shape'>('shape');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const onDrawn = (segs: Stroke[]) => {
    setSegments(segs);
    setError('');
    setStage('name');
  };

  const save = async () => {
    const accountId = auth.getCurrentAccount();
    if (!accountId) {
      toast.error('请先登录');
      navigate('/login');
      return;
    }
    setSaving(true);
    try {
      await service.gesture.put(accountId, {
        segments,
        points: segments.flat(),
        color,
        label: label.trim() || undefined,
        kind,
        createdAt: Date.now(),
      });
      auth.setGestureConfigured(true);
      refresh();
      toast.success('手势设置成功');
      navigate('/home');
    } catch {
      toast.error('保存失败，请重试');
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full">
      {/* 上方提示 */}
      <div className="pointer-events-none absolute left-0 right-0 top-14 z-[2] px-6 text-center">
        <h1 className="text-xl font-semibold text-white drop-shadow">设置手势密码</h1>
        <p className="mt-1 text-sm text-white/90 drop-shadow">
          可绘制爱心、对勾等图案，或者写字
        </p>
      </div>

      {/* 全屏绘制（无白框、无界限，可压住字） */}
      <GesturePad
        key={stage}
        fullscreen
        mode="manual"
        onComplete={onDrawn}
        onEmpty={() => toast.error('先画一笔，再点画好了')}
        error={error}
        color={color}
        showColorPicker={stage === 'draw'}
        onPickColor={setColor}
        toolsClassName="right-3 top-14"
        doneClassName="absolute bottom-32 left-1/2 -translate-x-1/2"
        pickerClassName="bottom-16"
      />

      {/* 画好后：填名称（图形/字可切换） */}
      {stage === 'name' && (
        <div className="absolute bottom-24 left-0 right-0 z-20 mx-auto w-[min(92%,22rem)] space-y-3 rounded-2xl bg-black/35 p-4 backdrop-blur">
          <p className="text-center text-sm text-white">这个图案 / 字是什么？</p>
          <div className="flex gap-2">
            {(
              [
                { v: 'shape', t: '图形' },
                { v: 'char', t: '写字' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setKind(o.v)}
                className={`flex-1 rounded-full border px-3 py-1.5 text-sm ${
                  kind === o.v
                    ? 'border-white bg-white/20 text-white'
                    : 'border-white/30 text-white/80'
                }`}
              >
                {o.t}
              </button>
            ))}
          </div>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === 'char' ? '例如：字“王”' : '例如：爱心'}
            maxLength={12}
            className="bg-white/90"
          />
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? '保存中…' : '保存手势'}
          </Button>
          <Button
            variant="ghost"
            className="w-full text-white/80"
            onClick={() => {
              setStage('draw');
              setSegments([]);
            }}
          >
            重画
          </Button>
        </div>
      )}

      {/* 最下面：切换账号登录 */}
      <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center">
        <Button
          variant="ghost"
          className="text-white drop-shadow"
          onClick={() => navigate('/login')}
        >
          切换账号登录
        </Button>
      </div>
    </div>
  );
}
