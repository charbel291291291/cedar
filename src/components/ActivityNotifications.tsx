import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Volume2, VolumeX, ShoppingCart, TrendingUp, Users, Zap } from 'lucide-react';
import {
  type ActivityItem,
  generateFakeActivity,
  realOrderToActivity,
  playNotifSound,
} from '@/lib/activityFeed';

// ── Config ────────────────────────────────────────────────────────────────────
const MAX_VISIBLE    = 3;     // max cards on screen at once
const DISPLAY_MS     = 5500;  // auto-dismiss after 5.5s
const MIN_INTERVAL   = 8000;  // min ms between new notifications
const MAX_INTERVAL   = 22000; // max ms between new notifications
const REAL_RATIO     = 0.30;  // 30% chance to pull from real queue

// ── Single notification card ──────────────────────────────────────────────────
function NotifCard({
  item,
  onDismiss,
  muted,
}: {
  item: ActivityItem;
  onDismiss: (id: string) => void;
  muted: boolean;
}) {
  const [visible,  setVisible]  = useState(false);
  const [progress, setProgress] = useState(100);
  const [paused,   setPaused]   = useState(false);
  const startRef   = useRef<number>(Date.now());
  const pausedAtRef = useRef<number>(0);
  const rafRef     = useRef<number>(0);

  // Slide-in after mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    playNotifSound(muted);
    return () => clearTimeout(t);
  }, []);

  // Progress bar countdown
  useEffect(() => {
    startRef.current = Date.now();

    const tick = () => {
      if (!paused) {
        const elapsed  = Date.now() - startRef.current;
        const remaining = Math.max(0, 100 - (elapsed / DISPLAY_MS) * 100);
        setProgress(remaining);
        if (remaining <= 0) {
          dismiss();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(item.id), 320);
  }, [item.id, onDismiss]);

  const handleMouseEnter = useCallback(() => {
    setPaused(true);
    pausedAtRef.current = Date.now();
  }, []);
  const handleMouseLeave = useCallback(() => {
    // Shift start time forward by however long we paused
    startRef.current += Date.now() - pausedAtRef.current;
    setPaused(false);
  }, []);

  const kindIcon: Record<string, React.ReactNode> = {
    purchase:  <ShoppingCart className="w-3.5 h-3.5 text-primary" />,
    topup:     <Zap className="w-3.5 h-3.5 text-emerald-400" />,
    milestone: <TrendingUp className="w-3.5 h-3.5 text-amber-400" />,
    active:    <Users className="w-3.5 h-3.5 text-blue-400" />,
  };

  const kindGlow: Record<string, string> = {
    purchase:  'shadow-primary/15',
    topup:     'shadow-emerald-500/15',
    milestone: 'shadow-amber-500/15',
    active:    'shadow-blue-500/15',
  };

  const progressColor: Record<string, string> = {
    purchase:  'bg-primary',
    topup:     'bg-emerald-400',
    milestone: 'bg-amber-400',
    active:    'bg-blue-400',
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative w-[260px] sm:w-[300px] overflow-hidden
        rounded-2xl border border-white/[0.09]
        shadow-xl ${kindGlow[item.kind]}
        transition-all duration-300 ease-out cursor-default
        ${visible
          ? 'opacity-100 translate-x-0 translate-y-0 scale-100'
          : 'opacity-0 -translate-x-4 scale-95'
        }
      `}
      style={{ background: 'rgba(14,14,20,0.97)', backdropFilter: 'blur(20px)' }}
    >
      {/* Real badge */}
      {item.isReal && (
        <div className="absolute top-2 right-7 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400/70">live</span>
        </div>
      )}

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/10 transition-all z-10"
      >
        <X className="w-2.5 h-2.5" />
      </button>

      {/* Content */}
      <div className="flex items-start gap-3 px-3.5 pt-3 pb-2.5">
        {/* Emoji orb */}
        <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-base shrink-0 mt-0.5">
          {item.emoji}
        </div>

        <div className="flex-1 min-w-0 pr-2">
          {item.kind === 'milestone' ? (
            <p className="text-[11px] font-black text-white/80 leading-snug">{item.service}</p>
          ) : (
            <>
              <p className="text-[11px] font-black text-white leading-snug truncate">
                <span className="text-primary">{item.name}</span>
                {' '}{item.service}
              </p>
            </>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {kindIcon[item.kind]}
            <span className="text-[9px] font-bold text-white/30">{item.timeLabel}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] bg-white/[0.05] mx-3.5 mb-2.5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-none ${progressColor[item.kind]}`}
          style={{ width: `${progress}%`, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}

// ── Live stats bar ────────────────────────────────────────────────────────────
function AnimatedCount({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(target / (duration / 30));
    const t = setInterval(() => {
      start = Math.min(start + step, target);
      setCount(start);
      if (start >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [target]);
  return <>{count.toLocaleString()}</>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ActivityNotifications() {
  const [items,   setItems]   = useState<ActivityItem[]>([]);
  const [queue,   setQueue]   = useState<ActivityItem[]>([]);
  const [muted,   setMuted]   = useState(false);
  const [stats,   setStats]   = useState({ users: 0, ordersToday: 0, activeNow: 0 });
  const realQueueRef = useRef<ActivityItem[]>([]);

  // ── Fetch initial stats ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        const [{ count: users }, { count: ordersToday }] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('orders').select('*', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        ]);
        setStats({
          users: users ?? 0,
          ordersToday: ordersToday ?? 0,
          activeNow: Math.floor(Math.random() * 8) + 3, // simulated active
        });
      } catch {}
    })();
  }, []);

  // ── Subscribe to real orders via Supabase Realtime ───────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed')
      // @ts-ignore
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'orders',
      }, (payload: any) => {
        const activity = realOrderToActivity({
          id:           payload.new.id,
          service_name: payload.new.service_name ?? undefined,
          created_at:   payload.new.created_at,
        });
        realQueueRef.current.push(activity);
        // Update ordersToday counter
        setStats(s => ({ ...s, ordersToday: s.ordersToday + 1 }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Show next notification ────────────────────────────────────────────────
  const showNext = useCallback(() => {
    setItems(prev => {
      if (prev.length >= MAX_VISIBLE) return prev;

      // Try real first (30% chance if available)
      let next: ActivityItem | null = null;
      if (realQueueRef.current.length > 0 && Math.random() < REAL_RATIO) {
        next = realQueueRef.current.shift()!;
      } else {
        // Pull from fake queue or generate fresh
        setQueue(q => {
          if (q.length > 0) {
            next = q[0];
            return q.slice(1);
          }
          next = generateFakeActivity();
          return q;
        });
        if (!next) next = generateFakeActivity();
      }

      return [...prev, next];
    });
  }, []);

  // ── Random interval ticker ────────────────────────────────────────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
      timeout = setTimeout(() => { showNext(); schedule(); }, delay);
    };
    // First one after 3s
    const initial = setTimeout(() => { showNext(); schedule(); }, 3000);
    return () => { clearTimeout(initial); clearTimeout(timeout); };
  }, [showNext]);

  // ── Pre-generate queue in background ─────────────────────────────────────
  useEffect(() => {
    setQueue(Array.from({ length: 10 }, generateFakeActivity));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  return (
    <>
      {/* ── Floating notification stack — bottom-left desktop, bottom-center mobile ── */}
      <div
        className={`
          fixed z-[9990] flex flex-col-reverse gap-2
          bottom-[80px] left-3
          lg:bottom-6 lg:left-4
          pointer-events-none
        `}
      >
        {items.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <NotifCard item={item} onDismiss={dismiss} muted={muted} />
          </div>
        ))}
      </div>

      {/* ── Mute toggle — desktop only, subtle ── */}
      <button
        onClick={() => setMuted(m => !m)}
        className="fixed bottom-[80px] right-3 lg:bottom-6 lg:right-4 z-[9990] w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.08] transition-all"
        title={muted ? 'Unmute notifications' : 'Mute notifications'}
      >
        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      {/* ── Live stats strip — top of page, subtle ── */}
      {stats.users > 0 && (
        <div className="fixed top-[64px] sm:top-[80px] left-0 right-0 z-40 pointer-events-none">
          <div className="flex items-center justify-center gap-4 sm:gap-8 py-1.5 border-b border-white/[0.04]"
            style={{ background: 'rgba(5,5,5,0.85)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
                <AnimatedCount target={stats.activeNow} /> online
              </span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
                <AnimatedCount target={stats.ordersToday} /> orders today
              </span>
            </div>
            <div className="w-px h-3 bg-white/10" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25">
                <AnimatedCount target={stats.users} /> members
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
