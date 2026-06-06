// ─── VIP tier config (mirrors DB vip_config table) ────────────────────────────
export interface VipTier {
  level: number;
  label: string;
  minSpent: number;
  discount: number;   // percentage, e.g. 8 = 8%
  color: string;      // hex
  gradient: string;   // tailwind gradient classes
  glow: string;       // tailwind shadow/glow classes
}

export const VIP_TIERS: VipTier[] = [
  { level: 1,  label: 'Bronze I',    minSpent: 0,    discount: 0,  color: '#9CA3AF', gradient: 'from-gray-500/20 to-gray-400/10',          glow: '' },
  { level: 2,  label: 'Bronze II',   minSpent: 50,   discount: 2,  color: '#6B7280', gradient: 'from-gray-400/25 to-gray-300/10',          glow: '' },
  { level: 3,  label: 'Silver I',    minSpent: 120,  discount: 4,  color: '#93C5FD', gradient: 'from-blue-400/25 to-blue-300/10',          glow: 'shadow-blue-500/20' },
  { level: 4,  label: 'Silver II',   minSpent: 250,  discount: 6,  color: '#60A5FA', gradient: 'from-blue-500/30 to-blue-400/15',          glow: 'shadow-blue-500/25' },
  { level: 5,  label: 'Gold I',      minSpent: 450,  discount: 8,  color: '#A78BFA', gradient: 'from-violet-500/30 to-purple-400/15',      glow: 'shadow-violet-500/25' },
  { level: 6,  label: 'Gold II',     minSpent: 700,  discount: 10, color: '#8B5CF6', gradient: 'from-purple-600/35 to-violet-500/20',      glow: 'shadow-violet-500/30' },
  { level: 7,  label: 'Platinum I',  minSpent: 1000, discount: 12, color: '#FCD34D', gradient: 'from-yellow-400/35 to-amber-300/20',       glow: 'shadow-yellow-500/30' },
  { level: 8,  label: 'Platinum II', minSpent: 1500, discount: 14, color: '#F59E0B', gradient: 'from-amber-500/35 to-orange-400/20',       glow: 'shadow-amber-500/30' },
  { level: 9,  label: 'Diamond',     minSpent: 2500, discount: 17, color: '#F97316', gradient: 'from-orange-500/40 to-red-400/20',         glow: 'shadow-orange-500/35' },
  { level: 10, label: 'Elite',       minSpent: 5000, discount: 20, color: '#EC4899', gradient: 'from-pink-500/40 via-purple-500/30 to-blue-500/20', glow: 'shadow-pink-500/40' },
];

export function getVipTier(level: number): VipTier {
  return VIP_TIERS.find(t => t.level === level) ?? VIP_TIERS[0];
}

export function getVipTierBySpent(totalSpent: number): VipTier {
  let tier = VIP_TIERS[0];
  for (const t of VIP_TIERS) {
    if (totalSpent >= t.minSpent) tier = t;
  }
  return tier;
}

export function getNextTier(currentLevel: number): VipTier | null {
  return VIP_TIERS.find(t => t.level === currentLevel + 1) ?? null;
}

/** Apply VIP discount to a price. Returns { original, discounted, saved, discountPct } */
export function applyVipDiscount(price: number, vipLevel: number) {
  const tier = getVipTier(vipLevel);
  const discountPct = tier.discount;
  const discounted = price * (1 - discountPct / 100);
  return {
    original:    price,
    discounted:  Math.max(0, discounted),
    saved:       price - discounted,
    discountPct,
    hasDiscount: discountPct > 0,
  };
}

/** Progress percentage towards next VIP level (0–100) */
export function vipProgress(totalSpent: number, currentLevel: number): number {
  const current = getVipTier(currentLevel);
  const next = getNextTier(currentLevel);
  if (!next) return 100;
  const range = next.minSpent - current.minSpent;
  const progress = totalSpent - current.minSpent;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

/** CSS color var for a VIP level — usable inline */
export function vipColor(level: number): string {
  return getVipTier(level).color;
}
