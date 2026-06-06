import { useMemo } from 'react';
import { Zap, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { getVipTier, getNextTier, vipProgress, VIP_TIERS } from '@/lib/vip';

interface VipStats {
  level: number;
  label: string;
  color: string;
  discount: number;
  total_spent: number;
  next_level: number | null;
  next_label: string | null;
  next_min_spent: number | null;
  next_discount: number | null;
  spent_to_next: number | null;
}

// ── VIP badge ─────────────────────────────────────────────────────────────────
export function VipBadge({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const tier = getVipTier(level);
  const isElite = level === 10;

  const sizes = { sm: 'text-[8px] px-2 py-0.5', md: 'text-[9px] px-2.5 py-1', lg: 'text-[11px] px-3 py-1.5' };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-black uppercase tracking-widest border ${sizes[size]} ${
        isElite ? 'animate-pulse' : ''
      }`}
      style={{
        color: tier.color,
        borderColor: tier.color + '40',
        backgroundColor: tier.color + '15',
        boxShadow: level >= 7 ? `0 0 12px ${tier.color}30` : undefined,
      }}
    >
      {isElite ? <Sparkles className="w-2.5 h-2.5" /> : <Crown className="w-2.5 h-2.5" />}
      VIP {level}
    </span>
  );
}

// ── Full VIP card for Profile page ────────────────────────────────────────────
export default function VipCard({ stats }: { stats: VipStats }) {
  const tier = getVipTier(stats.level);
  const nextTier = getNextTier(stats.level);
  const progress = vipProgress(stats.total_spent, stats.level);
  const isMaxLevel = stats.level === 10;
  const isElite = stats.level === 10;

  return (
    <div className={`relative rounded-[2rem] border overflow-hidden bg-gradient-to-br ${tier.gradient} shadow-xl ${tier.glow}`}
      style={{ borderColor: tier.color + '30' }}>

      {/* Elite shimmer overlay */}
      {isElite && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2.5s_ease-in-out_infinite] pointer-events-none" />
      )}

      <div className="relative p-5 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Level orb */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center border font-black text-lg shadow-lg"
              style={{
                backgroundColor: tier.color + '20',
                borderColor: tier.color + '50',
                color: tier.color,
                boxShadow: `0 0 20px ${tier.color}30`,
              }}
            >
              {isElite ? '💎' : stats.level}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{tier.label}</span>
                {isElite && <span className="text-[8px] font-black uppercase tracking-widest text-pink-400 animate-pulse">MAX</span>}
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color: tier.color + 'CC' }}>
                VIP MEMBER · LEVEL {stats.level}
              </p>
            </div>
          </div>

          {/* Discount badge */}
          {tier.discount > 0 && (
            <div
              className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl border font-black"
              style={{ backgroundColor: tier.color + '15', borderColor: tier.color + '35', color: tier.color }}
            >
              <span className="text-base leading-none">{tier.discount}%</span>
              <span className="text-[7px] uppercase tracking-wider opacity-70">OFF</span>
            </div>
          )}
          {tier.discount === 0 && (
            <div className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl border border-white/10 bg-white/5">
              <span className="text-[8px] font-black uppercase tracking-widest text-white/30 text-center leading-tight">No<br/>Disc.</span>
            </div>
          )}
        </div>

        {/* Benefits row */}
        <div className="flex gap-2 flex-wrap">
          {tier.discount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
              <Zap className="w-3 h-3" style={{ color: tier.color }} />
              <span className="text-[9px] font-black text-white/70">{tier.discount}% off all orders</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
            <Crown className="w-3 h-3" style={{ color: tier.color }} />
            <span className="text-[9px] font-black text-white/70">Priority support</span>
          </div>
          {stats.level >= 7 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08]">
              <Sparkles className="w-3 h-3" style={{ color: tier.color }} />
              <span className="text-[9px] font-black text-white/70">Exclusive deals</span>
            </div>
          )}
        </div>

        {/* Progress to next level */}
        {!isMaxLevel && nextTier && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">
                Progress to {nextTier.label}
              </span>
              <span className="text-[9px] font-black" style={{ color: tier.color }}>
                ${stats.total_spent.toFixed(0)} / ${nextTier.minSpent}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${tier.color}99, ${tier.color})`,
                  boxShadow: `0 0 8px ${tier.color}60`,
                }}
              />
            </div>

            {/* Psychological CTA */}
            {stats.spent_to_next !== null && stats.spent_to_next > 0 && (
              <div
                className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl border"
                style={{ backgroundColor: nextTier.color + '0E', borderColor: nextTier.color + '25' }}
              >
                <div>
                  <p className="text-[10px] font-black text-white/80">
                    Only <span style={{ color: nextTier.color }}>${stats.spent_to_next.toFixed(0)}</span> more to reach {nextTier.label}
                  </p>
                  <p className="text-[8px] font-bold text-white/30 mt-0.5">
                    Unlock {nextTier.discount}% discount on every order
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: nextTier.color + '80' }} />
              </div>
            )}
          </div>
        )}

        {/* Max level */}
        {isMaxLevel && (
          <div className="flex items-center justify-center gap-2 py-2 text-center">
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">
              Maximum VIP Level Reached · {tier.discount}% Discount Active
            </span>
            <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
          </div>
        )}

        {/* Total spent */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Total Spent</span>
          <span className="text-[11px] font-black text-white/60">${stats.total_spent.toFixed(2)}</span>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

// ── Mini VIP levels ladder (for profile overview) ─────────────────────────────
export function VipLadder({ currentLevel }: { currentLevel: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
      {VIP_TIERS.map(tier => (
        <div
          key={tier.level}
          className={`flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all ${
            tier.level === currentLevel ? 'scale-110' : tier.level < currentLevel ? 'opacity-60' : 'opacity-25'
          }`}
          style={tier.level <= currentLevel ? { backgroundColor: tier.color + '15' } : {}}
        >
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-black border"
            style={tier.level <= currentLevel
              ? { color: tier.color, borderColor: tier.color + '50', backgroundColor: tier.color + '20' }
              : { color: '#ffffff30', borderColor: '#ffffff10' }
            }
          >
            {tier.level}
          </div>
          <span className="text-[6px] font-black uppercase tracking-wide"
            style={{ color: tier.level <= currentLevel ? tier.color + 'CC' : '#ffffff20' }}>
            {tier.level === 10 ? '💎' : tier.label.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
