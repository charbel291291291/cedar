import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatUsd } from '@/lib/formatCurrency'
import StatusBadge from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import VipCard, { VipBadge, VipLadder } from '@/components/VipCard'
import {
  ShieldCheck, Copy, Check, Wallet, ShoppingBag, ChevronRight,
  Gift, Key, Clock, Zap, Share2, Mail, Star, TrendingUp, LogOut,
  Lock, Package, RefreshCw, CheckCircle2, Crown, Rocket,
} from 'lucide-react'

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const initial = email.slice(0, 1).toUpperCase()
  return (
    <div className="relative">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[1.75rem] bg-gradient-to-br from-primary/30 via-primary/15 to-primary/5 border border-primary/25 flex items-center justify-center shadow-2xl shadow-primary/20">
        <span className="text-3xl sm:text-4xl font-black text-primary select-none">{initial}</span>
      </div>
      {isAdmin && (
        <div className="absolute -top-2 -right-2 bg-amber-500 rounded-lg px-1.5 py-0.5 shadow-lg">
          <span className="text-[8px] font-black text-black uppercase tracking-wider">ADMIN</span>
        </div>
      )}
      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#050505] shadow" />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">{label}</span>
    </div>
  )
}

// ─── Row item ─────────────────────────────────────────────────────────────────
function RowItem({
  icon: Icon, iconColor = 'text-primary', iconBg = 'bg-primary/10 border-primary/20',
  title, subtitle, right, onClick, disabled,
}: {
  icon: React.ElementType; iconColor?: string; iconBg?: string
  title: string; subtitle?: string; right?: React.ReactNode
  onClick?: () => void; disabled?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] transition-all ${
        onClick ? 'hover:bg-white/[0.06] tap-feedback active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none' : ''
      } group`}
    >
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[11px] font-black text-white/80">{title}</p>
        {subtitle && <p className="text-[9px] font-bold text-white/30 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </Tag>
  )
}

export default function Profile() {
  const { user, session, isDemo, signOut, resetPasswordForEmail } = useAuth()
  const queryClient = useQueryClient()

  const [codeCopied, setCodeCopied]     = useState(false)
  const [emailCopied, setEmailCopied]   = useState(false)
  const [resetSent, setResetSent]       = useState(false)
  const [resetLoading, setResetLoading] = useState(false)


  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: userRow, isLoading: userLoading } = useQuery({
    queryKey: ['users', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users').select('balance, referral_code, referred_by_id, role, vip_level, total_spent')
        .eq('id', user!.id).single()
      if (error) throw error
      return data
    },
    enabled: !!session && !!user?.id,
  })

  const { data: vipStats } = useQuery({
    queryKey: ['vip-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_vip_stats')
      if (error) throw error
      return data as {
        level: number; label: string; color: string; discount: number;
        total_spent: number; next_level: number | null; next_label: string | null;
        next_min_spent: number | null; next_discount: number | null; spent_to_next: number | null;
      }
    },
    enabled: !!session && !!user?.id,
    staleTime: 30_000,
  })

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['profile-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders').select('*, services(name), packages(name, price)')
        .eq('user_id', user!.id).order('created_at', { ascending: false }).limit(3)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && !!user?.id,
  })

  const { data: referralStats } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_referral_stats')
      if (error) throw error
      return data as { referral_code: string; total_referrals: number; total_earned: number }
    },
    enabled: !!session && !!user?.id,
    staleTime: 30_000,
  })


  // ── Derived ───────────────────────────────────────────────────────────────
  const email        = user?.email ?? ''
  const username     = email.split('@')[0] ?? 'User'
  const memberSince  = user?.created_at ? format(new Date(user.created_at), 'MMM yyyy') : '—'
  const lastSignIn   = user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy · HH:mm') : '—'
  const balance      = Number(userRow?.balance ?? 0)
  const isAdmin      = userRow?.role === 'admin'
  const referralCode = referralStats?.referral_code ?? userRow?.referral_code ?? (isDemo ? 'CEDAR-DEMO' : null)
  const vipLevel     = userRow?.vip_level ?? 1

  // ── Handlers ──────────────────────────────────────────────────────────────
  const copyCode = () => {
    if (!referralCode) return
    navigator.clipboard.writeText(referralCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
    toast.success('Referral code copied!')
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(email)
    setEmailCopied(true)
    setTimeout(() => setEmailCopied(false), 2000)
    toast.success('Email copied!')
  }

  const shareReferral = () => {
    const text = `Join CedarBoost with my referral code ${referralCode ?? ''} and get rewarded! 🚀\n${window.location.origin}`
    if (navigator.share) {
      void navigator.share({ text })
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const handlePasswordReset = async () => {
    if (!email) return
    setResetLoading(true)
    const { error } = await resetPasswordForEmail(email)
    setResetLoading(false)
    if (error) toast.error('Failed to send reset email.')
    else { setResetSent(true); toast.success('Password reset email sent!') }
  }

  const handleSignOut = async () => {
    queryClient.clear()
    await signOut()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto space-y-4 pb-28 sm:pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── 1. HERO ──────────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] border border-white/5 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <Avatar email={email} isAdmin={isAdmin} />
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter capitalize">{username}</h1>
            <button
              onClick={copyEmail}
              className="flex items-center gap-1.5 text-muted-foreground text-xs font-bold hover:text-white transition-colors group mx-auto"
            >
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[220px]">{email}</span>
              {emailCopied
                ? <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Verified</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <Clock className="w-3 h-3 text-white/35" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/35">Since {memberSince}</span>
            </div>
            <VipBadge level={vipLevel} size="md" />
            {isAdmin && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Star className="w-3 h-3 text-amber-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">Admin</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. WALLET SNAPSHOT ───────────────────────────────────────────── */}
      <div className="relative glass rounded-[2rem] border border-white/5 p-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-5">
          <SectionHeader icon={Wallet} label="Wallet Balance" />
          {userLoading ? (
            <Skeleton className="h-11 w-40 rounded-xl" />
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tighter">{formatUsd(balance)}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-2">USD</span>
            </div>
          )}
          <div className="flex gap-3">
            <Link
              to="/dashboard"
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-2xl btn-primary-premium text-white text-[10px] font-black uppercase tracking-widest tap-feedback"
            >
              <Zap className="w-3.5 h-3.5" /> Recharge
            </Link>
            <Link
              to="/dashboard"
              className="flex-1 h-11 flex items-center justify-center gap-2 rounded-2xl bg-white/[0.05] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08] text-[10px] font-black uppercase tracking-widest transition-all tap-feedback"
            >
              <TrendingUp className="w-3.5 h-3.5" /> History
            </Link>
          </div>
        </div>
      </div>

      {/* ── 3. VIP STATUS ────────────────────────────────────────────────── */}
      {vipStats ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Crown className="w-3.5 h-3.5 text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">VIP Status</span>
          </div>
          <VipCard stats={vipStats} />
          <VipLadder currentLevel={vipStats.level} />
        </div>
      ) : userLoading ? (
        <div className="h-40 rounded-[2rem] bg-white/[0.03] border border-white/5 animate-pulse" />
      ) : null}

      {/* ── 4. QUICK ACTIONS ─────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] border border-white/5 p-5 sm:p-6 space-y-3">
        <SectionHeader icon={ShoppingBag} label="Quick Actions" />
        <div className="grid grid-cols-2 gap-3">
          <Link to="/smm-engine"
            className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-primary/8 border border-primary/20 hover:bg-primary/15 transition-all tap-feedback active:scale-[0.98] group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-black text-white">SMM Engine</p>
              <p className="text-[9px] font-bold text-white/35 mt-0.5">Followers · Likes · Views</p>
            </div>
          </Link>
          <Link to="/dashboard"
            className="flex flex-col items-start gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all tap-feedback active:scale-[0.98] group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-black text-white">Top Up Wallet</p>
              <p className="text-[9px] font-bold text-white/35 mt-0.5">USDT · OMT · Wish</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── 5. RECENT ORDERS ─────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] border border-white/5 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader icon={Package} label="Recent Orders" />
          <Link
            to="/orders"
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary/50 hover:text-primary transition-colors"
          >
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {ordersLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-2xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white/10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/20">No orders yet</p>
            <Link
              to="/smm-engine"
              className="text-[9px] font-black uppercase tracking-widest text-primary/50 hover:text-primary transition-colors mt-1"
            >
              Place your first order →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(orders as any[]).map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black truncate">{order.services?.name ?? 'Service'}</p>
                  <p className="text-[9px] font-bold text-white/35 truncate mt-0.5">{order.packages?.name ?? '—'}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={order.status} />
                  <span className="text-[8px] font-bold text-white/25">
                    {order.created_at ? format(new Date(order.created_at), 'MMM d') : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. REFERRAL ──────────────────────────────────────────────────── */}
      <div className="relative glass rounded-[2rem] border border-white/5 p-5 sm:p-6 space-y-4 overflow-hidden">
        <div className="absolute -bottom-8 -right-8 w-36 h-36 bg-primary/6 rounded-full blur-2xl pointer-events-none" />
        <SectionHeader icon={Gift} label="Referral Program" />
        <div className="space-y-1.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/25">Your Code</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center h-12 px-4 rounded-2xl bg-white/[0.04] border border-white/10 font-mono text-base font-black tracking-[0.2em] text-white overflow-hidden">
              {referralCode === null ? <Skeleton className="h-4 w-28 rounded" /> : <span className="truncate">{referralCode}</span>}
            </div>
            <button
              onClick={copyCode} disabled={!referralCode}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all tap-feedback active:scale-95 disabled:opacity-40"
            >
              {codeCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={shareReferral} disabled={!referralCode}
              className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.05] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all tap-feedback active:scale-95 disabled:opacity-40"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-black text-primary">{referralStats?.total_referrals ?? 0}</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mt-1">Referrals</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-black text-emerald-400">{formatUsd(referralStats?.total_earned ?? 0)}</p>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mt-1">Earned</p>
          </div>
        </div>
        <p className="text-[9px] font-bold text-white/25 text-center leading-relaxed">
          Share your code · friend signs up · you both get rewarded
        </p>
      </div>

      {/* ── 6. SECURITY ──────────────────────────────────────────────────── */}
      <div className="glass rounded-[2rem] border border-white/5 p-5 sm:p-6 space-y-3">
        <SectionHeader icon={Lock} label="Security" />
        <RowItem
          icon={ShieldCheck} iconColor="text-emerald-400" iconBg="bg-emerald-500/10 border-emerald-500/20"
          title={isDemo ? 'Demo Session' : 'Account Secured'}
          subtitle={isDemo ? 'No sign in required for this preview' : 'SSL encrypted · session protected'}
        />
        {!isDemo && (
          <>
            <RowItem
              icon={Clock} iconColor="text-blue-400" iconBg="bg-blue-500/10 border-blue-500/20"
              title="Last Sign In" subtitle={lastSignIn}
            />
            <RowItem
              icon={Key}
              title={resetSent ? 'Reset Email Sent!' : 'Change Password'}
              subtitle={resetSent ? 'Check your inbox' : 'Send a password reset link to your email'}
              onClick={handlePasswordReset}
              disabled={resetSent || resetLoading}
              right={
                resetLoading ? <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                : resetSent   ? <Check className="w-4 h-4 text-emerald-400" />
                : <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/35 transition-colors" />
              }
            />
          </>
        )}
      </div>

      {/* ── 7. SIGN OUT ──────────────────────────────────────────────────── */}
      {!isDemo && (
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive font-black text-[10px] uppercase tracking-widest hover:bg-destructive/20 transition-all tap-feedback active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      )}
    </div>
  )
}
