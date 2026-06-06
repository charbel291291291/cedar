import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldCheck, Delete, X, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

// ─── Web Audio synth ──────────────────────────────────────────────────────────
function usePinAudio(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const ctx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  return useCallback((kind: 'tap' | 'del' | 'error' | 'success') => {
    if (muted) return;
    try {
      const ac = ctx();
      const now = ac.currentTime;
      const tone = (freq: number, type: OscillatorType, start: number, dur: number, vol: number) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(vol, now + start);
        g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        o.connect(g); g.connect(ac.destination);
        o.start(now + start);
        o.stop(now + start + dur);
      };
      if (kind === 'tap')     tone(780, 'sine', 0, 0.07, 0.08);
      if (kind === 'del')     tone(420, 'sine', 0, 0.07, 0.06);
      if (kind === 'error') { tone(180, 'sawtooth', 0, 0.12, 0.09); tone(140, 'sawtooth', 0.12, 0.15, 0.07); }
      if (kind === 'success') { tone(523, 'sine', 0, 0.15, 0.07); tone(659, 'sine', 0.16, 0.15, 0.07); tone(784, 'sine', 0.32, 0.25, 0.07); }
    } catch {}
  }, [muted, ctx]);
}

// ─── Sub-labels for number keys ───────────────────────────────────────────────
const SUB: Record<string, string> = {
  '2':'ABC','3':'DEF','4':'GHI','5':'JKL',
  '6':'MNO','7':'PQRS','8':'TUV','9':'WXYZ',
};

// ─── Single keypad button ─────────────────────────────────────────────────────
function Key({
  label, icon, variant = 'digit', disabled, onPress,
}: {
  label?: string;
  icon?: React.ReactNode;
  variant?: 'digit' | 'action' | 'danger';
  disabled?: boolean;
  onPress: () => void;
}) {
  const [active, setActive] = useState(false);

  const fire = () => {
    if (disabled) return;
    setActive(true);
    onPress();
    setTimeout(() => setActive(false), 120);
  };

  const base =
    'relative flex flex-col items-center justify-center rounded-[1.4rem] select-none ' +
    'transition-all duration-100 overflow-hidden border touch-manipulation ' +
    'h-[68px] sm:h-[72px] w-full ';

  const styles: Record<string, string> = {
    digit: active
      ? 'scale-[0.88] bg-primary/25 border-primary/50 shadow-[0_0_24px_rgba(var(--primary-rgb),0.35)]'
      : 'bg-white/[0.06] border-white/[0.08] hover:bg-white/[0.10] hover:border-white/[0.16] active:scale-[0.88]',
    action: active
      ? 'scale-[0.88] bg-white/10 border-white/20'
      : 'bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.08] active:scale-[0.88]',
    danger: active
      ? 'scale-[0.88] bg-red-500/20 border-red-500/40'
      : 'bg-white/[0.03] border-white/[0.05] hover:bg-red-500/10 hover:border-red-500/20 active:scale-[0.88]',
  };

  return (
    <button
      onPointerDown={fire}
      disabled={disabled}
      className={base + styles[variant] + (disabled ? ' opacity-30 cursor-not-allowed' : '')}
    >
      {/* Ripple on press */}
      {active && variant === 'digit' && (
        <span className="absolute inset-0 rounded-[1.4rem] bg-primary/20 animate-ping" />
      )}

      {label !== undefined && (
        <>
          <span className="relative text-[22px] font-black text-white leading-none">{label}</span>
          {SUB[label] && (
            <span className="relative text-[7px] font-black tracking-[0.22em] text-white/20 mt-0.5">{SUB[label]}</span>
          )}
        </>
      )}
      {icon && <span className="relative">{icon}</span>}
    </button>
  );
}

// ─── Orbital ring animation ───────────────────────────────────────────────────
function VaultOrb({ status }: { status: 'idle' | 'error' | 'success' }) {
  const ring = 'absolute rounded-full border pointer-events-none';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center mx-auto">
      {/* Outer slow ring */}
      <div className={`${ring} w-[120px] h-[120px] border-white/[0.05] animate-[spin_20s_linear_infinite]`} />
      {/* Middle ring with dot */}
      <div className={`${ring} w-[96px] h-[96px] animate-[spin_10s_linear_infinite] ${
        status === 'success' ? 'border-emerald-500/30' : status === 'error' ? 'border-red-500/30' : 'border-primary/15'
      }`}>
        <div className={`absolute -top-[3px] left-1/2 -translate-x-1/2 w-[6px] h-[6px] rounded-full ${
          status === 'success' ? 'bg-emerald-400' : status === 'error' ? 'bg-red-400' : 'bg-primary/70'
        }`} />
      </div>
      {/* Inner counter-ring */}
      <div className={`${ring} w-[76px] h-[76px] border-white/[0.04] animate-[spin_15s_linear_infinite_reverse]`} />

      {/* Core icon */}
      <div className={`relative w-16 h-16 rounded-[1.5rem] flex items-center justify-center border backdrop-blur-xl transition-all duration-700 ${
        status === 'success'
          ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_40px_rgba(16,185,129,0.4)]'
          : status === 'error'
          ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.35)]'
          : 'bg-white/[0.07] border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
      }`}>
        <div className="absolute inset-0 rounded-[1.5rem] blur-xl opacity-40"
          style={{ background: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'hsl(var(--primary))' }} />
        <span className={`relative text-2xl transition-all duration-300 ${status !== 'idle' ? 'scale-110' : ''}`}>
          {status === 'success' ? '🔓' : status === 'error' ? '🔒' : '🔐'}
        </span>
      </div>
    </div>
  );
}

// ─── PIN dot display ──────────────────────────────────────────────────────────
function PinDots({ length, status }: { length: number; status: 'idle' | 'error' | 'success' }) {
  return (
    <div className="flex gap-3.5" aria-label="PIN input progress">
      {[0, 1, 2, 3].map(i => {
        const filled = length > i;
        return (
          <div
            key={i}
            className={`w-11 h-[52px] rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              filled
                ? status === 'error'
                  ? 'border-red-500/60 bg-red-500/10 scale-[1.07]'
                  : status === 'success'
                  ? 'border-emerald-500/60 bg-emerald-500/10 scale-[1.07]'
                  : 'border-primary/60 bg-primary/10 scale-[1.12]'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className={`rounded-full transition-all duration-200 ${
              filled
                ? status === 'error'
                  ? 'w-3 h-3 bg-red-400 shadow-[0_0_14px_#ef4444]'
                  : status === 'success'
                  ? 'w-3 h-3 bg-emerald-400 shadow-[0_0_14px_#10b981]'
                  : 'w-3 h-3 bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]'
                : 'w-2 h-2 bg-white/10'
            }`} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminPinVault({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin]       = useState('');
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle');
  const [muted, setMuted]   = useState(false);
  const play = usePinAudio(muted);
  const SECRET_PIN = '1201';

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handlePress(e.key);
      if (e.key === 'Backspace') handleDelete();
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, status]);

  const handlePress = (num: string) => {
    if (status !== 'idle' || pin.length >= 4) return;
    play('tap');
    const next = pin + num;
    setPin(next);
    if (next.length === 4) setTimeout(() => verify(next), 80);
  };

  const handleDelete = () => {
    if (status !== 'idle') return;
    play('del');
    setPin(p => p.slice(0, -1));
  };

  const verify = (code: string) => {
    if (code === SECRET_PIN) {
      setStatus('success');
      play('success');
      setTimeout(() => {
        onSuccess();
        toast.success('Identity Verified. Accessing Core Engine.');
      }, 1300);
    } else {
      setStatus('error');
      play('error');
      setTimeout(() => {
        setStatus('idle');
        setPin('');
      }, 750);
    }
  };

  const statusLabel = {
    idle:    'ENTER ADMIN PIN',
    error:   'INVALID — TRY AGAIN',
    success: 'ACCESS GRANTED',
  }[status];

  const statusColor = {
    idle:    'text-white/25',
    error:   'text-red-400',
    success: 'text-emerald-400',
  }[status];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden touch-none select-none"
      style={{ background: 'radial-gradient(ellipse 90% 80% at 50% 50%, #0d0d1f 0%, #050505 100%)' }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)' }} />
        {status === 'error' && (
          <div className="absolute inset-0 animate-[fadeRed_0.7s_ease_forwards]"
            style={{ background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.06) 0%, transparent 60%)' }} />
        )}
        {status === 'success' && (
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, transparent 60%)' }} />
        )}
      </div>

      {/* Content card — shake on error */}
      <div className={`relative w-full max-w-[320px] mx-5 flex flex-col items-center gap-0
        ${status === 'error' ? 'animate-[vaultShake_0.65s_cubic-bezier(.36,.07,.19,.97)]' : ''}
        ${status === 'success' ? 'animate-[vaultSuccessScale_0.5s_ease_forwards]' : ''}
      `}>

        {/* Top controls */}
        <div className="w-full flex items-center justify-between mb-6">
          <button
            onClick={onCancel}
            className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.07] text-white/25 hover:text-white/60 hover:bg-white/[0.09] transition-all active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 text-white/15">
            <ShieldCheck className="w-3 h-3 text-emerald-500/40" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">VAULT ACCESS</span>
          </div>

          <button
            onClick={() => setMuted(m => !m)}
            className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.07] text-white/25 hover:text-white/60 hover:bg-white/[0.09] transition-all active:scale-90"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Vault orb */}
        <VaultOrb status={status} />

        {/* Title */}
        <div className="text-center mt-7 mb-8">
          <h2 className="text-[22px] font-black tracking-[0.05em] text-white leading-none">
            {status === 'success' ? 'UNLOCKED' : 'SECURE VAULT'}
          </h2>
          <p className={`text-[9px] font-black uppercase tracking-[0.42em] mt-2.5 transition-colors duration-300 ${statusColor}`}>
            {statusLabel}
          </p>
        </div>

        {/* PIN dots */}
        <PinDots length={pin.length} status={status} />

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2.5 w-full mt-9">
          {['1','2','3','4','5','6','7','8','9'].map(n => (
            <Key
              key={n}
              label={n}
              disabled={status !== 'idle'}
              onPress={() => handlePress(n)}
            />
          ))}
          {/* Bottom row */}
          <Key
            icon={<X className="w-[18px] h-[18px] text-white/30" />}
            variant="danger"
            onPress={onCancel}
          />
          <Key
            label="0"
            disabled={status !== 'idle'}
            onPress={() => handlePress('0')}
          />
          <Key
            icon={<Delete className="w-[18px] h-[18px] text-white/40" />}
            variant="action"
            disabled={status !== 'idle' || pin.length === 0}
            onPress={handleDelete}
          />
        </div>

        {/* Footer badge */}
        <div className="mt-8 flex items-center gap-2 opacity-[0.14]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[7.5px] font-black uppercase tracking-[0.38em] text-white">
            AES-256 · SECURE KERNEL
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      </div>

      <style>{`
        @keyframes vaultShake {
          0%,100%  { transform: translateX(0) rotate(0deg); }
          12%      { transform: translateX(-9px) rotate(-0.5deg); }
          24%      { transform: translateX(9px)  rotate( 0.5deg); }
          36%      { transform: translateX(-7px) rotate(-0.3deg); }
          48%      { transform: translateX(7px)  rotate( 0.3deg); }
          60%      { transform: translateX(-4px); }
          72%      { transform: translateX(4px);  }
          84%      { transform: translateX(-2px); }
        }
        @keyframes vaultSuccessScale {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.04); }
          70%  { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes fadeRed {
          0%   { opacity: 0; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
