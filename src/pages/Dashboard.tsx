import { useState, useEffect, useRef, useMemo, useTransition, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Wallet, Clock, ArrowLeft, Package, Plus, Copy, Check, X,
  TrendingUp, TrendingDown, Minus, ChevronDown, Send, Upload,
  FileText, Loader2, Users, Gift, ShoppingBag, Sparkles,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import PromoCodeInput from '@/components/PromoCodeInput'
import { useLanguage } from '@/i18n/LanguageContext'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { formatUsd } from '@/lib/formatCurrency'
import { uploadPaymentProof, PAYMENT_PROOFS_BUCKET } from '@/lib/uploadProof'

// ─── Animated balance delta toast ─────────────────────────────────────────────
function BalanceDelta({ delta, onDone }: { delta: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  const isPositive = delta > 0
  return (
    <div className={`fixed top-24 right-6 z-[200] animate-in slide-in-from-top-2 fade-in duration-300 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl border font-black text-sm ${
      isPositive
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-destructive/10 border-destructive/30 text-destructive'
    }`}>
      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {isPositive ? '+' : ''}{formatUsd(Math.abs(delta))} {isPositive ? 'added 💚' : 'deducted 💸'}
    </div>
  )
}

export default function Dashboard() {
  const { user, session, isDemo } = useAuth()
  const { t, dir } = useLanguage()
  const queryClient = useQueryClient()
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [referralCopied, setReferralCopied] = useState(false)
  const [referralInput, setReferralInput] = useState('')
  const [referralLoading, setReferralLoading] = useState(false)
  const [txFilter, setTxFilter] = useState<'all' | 'credit' | 'debit'>('all')
  const [txLimit, setTxLimit] = useState(15)
  const [, startTransition] = useTransition()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rechargeSuccess, setRechargeSuccess] = useState(false)

  // Animated balance delta
  const [balanceDelta, setBalanceDelta] = useState<number | null>(null)
  const prevBalanceRef = useRef<number | null>(null)

  const WHISH_NUMBER = "70-126177"
  const WHATSAPP_LINK = `https://wa.me/96170126177?text=Hello Charbel, I just sent a Whish transfer of ${topUpAmount}$ for my account ${user?.email}`

  // ── User row (balance + referral_code) ──────────────────────────────────────
  const { data: userRow, isLoading: userLoading } = useQuery({
    queryKey: ['users', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('balance, referral_code, referred_by_id')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!session && !!user?.id,
  })

  // ── Transactions ────────────────────────────────────────────────────────────
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && !!user?.id,
  })

  // ── Recent orders (preview) ────────────────────────────────────────────────
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, services(name), packages(name, price)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && !!user?.id,
  })

  // ── Pending deposits ────────────────────────────────────────────────────────
  const { data: topUps = [] } = useQuery({
    queryKey: ['topups', user?.id],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!user?.id,
  })

  // ── Referral stats ──────────────────────────────────────────────────────────
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

  // ── Realtime: balance updates ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`dashboard-users-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        (payload) => {
          const newBalance = Number((payload.new as any).balance ?? 0)
          if (prevBalanceRef.current !== null) {
            const delta = newBalance - prevBalanceRef.current
            if (Math.abs(delta) > 0.001) setBalanceDelta(delta)
          }
          prevBalanceRef.current = newBalance
          void queryClient.invalidateQueries({ queryKey: ['users', user.id] })
          void queryClient.invalidateQueries({ queryKey: ['transactions', user.id] })
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user?.id, queryClient])

  // Set initial prevBalance once loaded
  useEffect(() => {
    if (userRow && prevBalanceRef.current === null) {
      prevBalanceRef.current = Number(userRow.balance ?? 0)
    }
  }, [userRow])

  const balance = userRow?.balance ?? 0

  // Memoize filtered transactions — avoids re-filtering on every render
  const txFiltered = useMemo(() =>
    (transactions as any[]).filter(tx =>
      txFilter === 'all' ? true : (tx.direction ?? 'debit') === txFilter
    ),
  [transactions, txFilter])

  const txVisible = useMemo(() => txFiltered.slice(0, txLimit), [txFiltered, txLimit])

  // ── Handle filter tab click — low-priority update ────────────────────────────
  const handleTxFilter = useCallback((f: 'all' | 'credit' | 'debit') => {
    startTransition(() => { setTxFilter(f); setTxLimit(15); });
  }, [startTransition])

  // ── Copy referral code ──────────────────────────────────────────────────────
  const copyReferralCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code)
    setReferralCopied(true)
    setTimeout(() => setReferralCopied(false), 2000)
    toast.success('Referral code copied!')
  }, [])

  const copyNumber = useCallback(() => {
    navigator.clipboard.writeText(WHISH_NUMBER)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Whish Number Copied!')
  }, [])

  // ── Apply referral ──────────────────────────────────────────────────────────
  const handleApplyReferral = async () => {
    const code = referralInput.trim().toUpperCase()
    if (!code) return
    if (isDemo) {
      toast.success('Referral preview applied in demo mode.', { icon: '🎁' })
      setReferralInput('')
      return
    }
    setReferralLoading(true)
    try {
      const { data, error } = await supabase.rpc('apply_referral_code', { p_referral_code: code })
      if (error) throw error
      const result = data as any
      if (!result.success) {
        toast.error(result.error ?? 'Invalid referral code')
      } else {
        toast.success(result.message ?? 'Referral applied!', { icon: '🎁' })
        setReferralInput('')
        void queryClient.invalidateQueries({ queryKey: ['referral-stats', user?.id] })
        void queryClient.invalidateQueries({ queryKey: ['users', user?.id] })
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to apply referral code.')
    } finally {
      setReferralLoading(false)
    }
  }

  // ── Whish topup submit ──────────────────────────────────────────────────────
  const handleManualConfirm = async () => {
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) return toast.error('Please enter a valid amount.')
    if (isDemo) {
      toast.success('Demo recharge preview created. No payment was sent.')
      setRechargeSuccess(true)
      setTimeout(() => {
        setShowTopUp(false)
        setRechargeSuccess(false)
        setTopUpAmount('')
        setSelectedFile(null)
      }, 2000)
      return
    }
    if (!selectedFile) return toast.error('Please upload payment proof (image).')

    setSubmitting(true)
    try {
      const { path } = await uploadPaymentProof(selectedFile, user!.id, 'topups')
      const { data: { publicUrl } } = supabase.storage.from(PAYMENT_PROOFS_BUCKET).getPublicUrl(path)

      // @ts-ignore
      const { error } = await supabase.from('deposit_requests').insert({
        user_id: user?.id,
        amount,
        method: 'WISH',
        status: 'pending',
        proof: publicUrl,
      })
      if (error) throw error

      toast.success('Request Sent! Admin will verify your receipt shortly.')
      setRechargeSuccess(true)
      setTimeout(() => {
        setShowTopUp(false)
        setRechargeSuccess(false)
        setTopUpAmount('')
        setSelectedFile(null)
      }, 2000)
      void queryClient.invalidateQueries({ queryKey: ['topups', user?.id] })
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 5 * 1024 * 1024) return toast.error('File size is too large (max 5MB)')
      setSelectedFile(file)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in pb-24 sm:pb-20">
      {/* Animated balance delta overlay */}
      {balanceDelta !== null && (
        <BalanceDelta delta={balanceDelta} onDone={() => setBalanceDelta(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">My Wallet</h1>
          <p className="text-muted-foreground text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40">
            {user?.email?.split('@')[0] ?? user?.id?.substring(0, 8)}
          </p>
        </div>
        <Link to="/home">
          <Button variant="outline" size="sm" className="rounded-full px-4 border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] font-black text-[10px] shrink-0 transition-all">
            <ArrowLeft className="w-3 h-3 mr-1.5" /> HOME
          </Button>
        </Link>
      </div>

      {/* Top cards */}
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">

        {/* BALANCE CARD ── hero card */}
        <div className="relative overflow-hidden glass rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-white/[0.07] group sm:col-span-2 lg:col-span-1 card-lift"
          style={{ background: 'linear-gradient(145deg, rgba(16,185,129,0.06) 0%, rgba(5,5,5,0) 60%)' }}
        >
          {/* watermark */}
          <div className="absolute top-0 right-0 p-6 opacity-[0.04] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-700 pointer-events-none">
            <Wallet className="w-28 h-28 sm:w-36 sm:h-36" />
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400/70">Live Balance</span>
            </div>
          </div>

          {/* Balance number */}
          {userLoading ? (
            <Skeleton className="h-12 sm:h-14 w-44 sm:w-52 rounded-2xl mb-6" />
          ) : (
            <p className="text-5xl sm:text-6xl font-black tracking-tighter mb-6 balance-display leading-none">
              {formatUsd(balance)}
            </p>
          )}

          {/* ✅ RECHARGE BUTTON — instant, no disabled */}
          <button
            type="button"
            onClick={() => setShowTopUp(true)}
            className="btn-recharge w-full h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 text-sm tracking-wider tap-feedback select-none"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
            RECHARGE NOW
          </button>
        </div>

        {/* STATS CARD */}
        <div className="glass rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 border border-white/[0.06] flex flex-col justify-between card-lift">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-white/35 mb-3">
              <Package className="w-3 h-3" /> Orders
            </div>
            {ordersLoading ? (
              <Skeleton className="h-9 w-20 rounded-xl" />
            ) : (
              <p className="text-4xl sm:text-5xl font-black tracking-tighter text-white">{orders.length}</p>
            )}
            <p className="text-[9px] font-black text-white/25 uppercase tracking-widest mt-1">total placed</p>
          </div>
          <div className="space-y-2 mt-5">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-0.5 flex-1 bg-emerald-500/15 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/60 animate-pulse rounded-full" style={{ animationDelay: `${i * 0.12}s` }} />
                </div>
              ))}
            </div>
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">system nominal</p>
          </div>
          <Link to="/orders" className="mt-5 block">
            <button type="button" className="w-full h-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] font-black text-[10px] text-white/60 hover:text-white flex items-center justify-center gap-2 transition-all tap-feedback">
              <ShoppingBag className="w-3.5 h-3.5" /> VIEW ALL ORDERS
            </button>
          </Link>
        </div>

        {/* STORE HUB CARD */}
        <div className="rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 flex flex-col justify-between shadow-2xl shadow-primary/15 relative overflow-hidden group card-lift"
          style={{ background: 'linear-gradient(135deg, hsl(0,100%,44%) 0%, hsl(0,100%,32%) 100%)' }}
        >
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.08) 0%, transparent 60%)' }}
          />
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-white/60" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60">Cedar Hub</span>
            </div>
            <p className="text-xl sm:text-2xl font-black text-white italic tracking-tight leading-tight">Games & <br/>Social Media</p>
          </div>
          <Link to="/home" className="relative z-10 mt-5 block">
            <button type="button" className="w-full h-12 rounded-2xl font-black bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center gap-2 text-sm transition-all tap-feedback border border-white/20">
              OPEN STORE <ArrowLeft className="w-4 h-4 rotate-180" />
            </button>
          </Link>
        </div>
      </div>

      {/* PROMO CODE + REFERRAL */}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {/* PROMO CODE */}
        <div className="glass rounded-[2rem] border border-white/[0.06] p-5 sm:p-7 space-y-4 card-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="font-black text-sm tracking-tight">Promo Code</p>
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Redeem for wallet credit</p>
            </div>
          </div>
          <PromoCodeInput onRedeemed={(amount) => {
            if (prevBalanceRef.current !== null) {
              prevBalanceRef.current = prevBalanceRef.current + amount
            }
          }} />
        </div>

        {/* REFERRAL */}
        <div className="glass rounded-[2rem] border border-white/[0.06] p-5 sm:p-7 space-y-4 card-lift">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="font-black text-sm tracking-tight">Referral Program</p>
              <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Earn $2 per invite</p>
            </div>
          </div>

          {/* User's own code */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">Your Code</label>
            <div className="flex gap-2">
              <div className="flex-1 h-12 bg-amber-500/[0.06] border border-amber-500/20 rounded-2xl flex items-center px-4">
                <span className="font-black tracking-[0.2em] text-amber-300 text-sm font-mono">
                  {userRow?.referral_code ?? referralStats?.referral_code ?? (isDemo ? 'CEDAR-DEMO' : '···')}
                </span>
              </div>
              <button
                type="button"
                className="h-12 w-12 rounded-2xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all tap-feedback"
                onClick={() => copyReferralCode(userRow?.referral_code ?? referralStats?.referral_code ?? '')}
              >
                {referralCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white/50" />}
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3.5 text-center">
              <p className="text-2xl font-black tracking-tighter text-amber-300">{referralStats?.total_referrals ?? 0}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mt-0.5 flex items-center justify-center gap-1">
                <Users className="w-2 h-2" /> Referrals
              </p>
            </div>
            <div className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3.5 text-center">
              <p className="text-2xl font-black tracking-tighter text-emerald-400">
                {formatUsd(referralStats?.total_earned ?? 0)}
              </p>
              <p className="text-[8px] font-black uppercase tracking-widest text-white/25 mt-0.5">Earned</p>
            </div>
          </div>

          {/* Apply referral code */}
          {!userRow?.referred_by_id && (
            <div className="space-y-2 pt-3 border-t border-white/[0.06]">
              <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30">Have a referral code?</label>
              <div className="flex gap-2">
                <Input
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                  placeholder="CEDAR-XXXXXX"
                  className="h-11 rounded-2xl border-white/[0.09] bg-white/[0.04] font-black text-sm tracking-widest"
                />
                <Button
                  onClick={handleApplyReferral}
                  disabled={referralLoading || !referralInput.trim()}
                  className="h-11 px-5 rounded-2xl font-black text-[10px] tracking-widest btn-primary-premium"
                >
                  {referralLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'APPLY'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* WHISH RECHARGE — PREMIUM BOTTOM SHEET */}
      {showTopUp && (
        <div
          className="fixed inset-0 z-[100] flex flex-col justify-end sm:items-center sm:justify-center animate-in fade-in duration-200"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(20px)' }}
          onClick={() => !submitting && setShowTopUp(false)}
        >
          <div
            className="relative w-full sm:max-w-md bg-[#0a0a0a] border border-white/[0.09] rounded-t-[2rem] sm:rounded-[2rem] shadow-[0_-8px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag pill — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 sm:px-8 pb-8 pt-4 sm:pt-8 space-y-5 max-h-[92dvh] overflow-y-auto scrollbar-hide">

              {/* ── SUCCESS STATE ── */}
              {rechargeSuccess ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 animate-in zoom-in-95 fade-in duration-300">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center">
                    <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-2xl font-black tracking-tighter text-white">Request Sent!</p>
                    <p className="text-[11px] font-black text-white/40 uppercase tracking-widest">Admin will verify your receipt shortly</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/[0.03] rounded-2xl border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0">
                        <img src="/assets/whish-logo.png" alt="Whish" className="w-6 h-6 object-contain" />
                      </div>
                      <div>
                        <p className="font-black text-base tracking-tight">Recharge via Whish</p>
                        <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Transfer · Instant Credit</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTopUp(false)}
                      className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center transition-all tap-feedback"
                    >
                      <X className="w-4 h-4 text-white/50" />
                    </button>
                  </div>

                  {/* Whish number */}
                  <div className="bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500/60 mb-1">Send to this number</p>
                      <span className="text-2xl font-black tracking-widest font-mono text-white">{WHISH_NUMBER}</span>
                    </div>
                    <button
                      type="button"
                      onClick={copyNumber}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black border transition-all tap-feedback shrink-0 ${
                        copied
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                          : 'bg-white/[0.06] border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.1]'
                      }`}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'COPIED' : 'COPY'}
                    </button>
                  </div>

                  {/* Preset amounts */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 ml-1">Quick Select Amount</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[10, 20, 50, 100].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopUpAmount(String(amt))}
                          className={`h-12 rounded-2xl font-black text-sm transition-all tap-feedback border ${
                            topUpAmount === String(amt)
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/15'
                              : 'bg-white/[0.04] border-white/[0.08] text-white/50 hover:bg-white/[0.08] hover:text-white'
                          }`}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom amount input */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 ml-1">Or enter custom amount ($)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-white/30 text-lg">$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        className="h-14 bg-white/[0.04] border-white/[0.09] rounded-2xl pl-9 pr-5 text-lg font-black input-premium focus-visible:ring-emerald-500/30"
                      />
                    </div>
                  </div>

                  {!isDemo && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-[0.25em] text-white/30 ml-1">Upload Proof (Screenshot)</label>
                      <div className="relative group/file">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className={`h-[72px] border border-dashed rounded-2xl flex items-center gap-3 px-5 transition-all group-hover/file:bg-white/[0.06] ${
                          selectedFile
                            ? 'border-emerald-500/40 bg-emerald-500/[0.05]'
                            : 'border-white/[0.1] bg-white/[0.03]'
                        }`}>
                          {selectedFile ? (
                            <>
                              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                              <span className="text-[11px] font-black text-emerald-400 uppercase truncate">{selectedFile.name}</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-white/25 shrink-0" />
                              <span className="text-[11px] font-black text-white/30 uppercase">{t('clickToUpload')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    type="button"
                    onClick={handleManualConfirm}
                    disabled={submitting || !topUpAmount || (!isDemo && !selectedFile)}
                    className="btn-recharge w-full h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 text-sm tracking-wider tap-feedback disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" strokeWidth={2.5} />}
                    {submitting ? 'SENDING...' : isDemo ? 'PREVIEW RECHARGE' : 'CONFIRM TRANSFER'}
                  </button>

                  <a href={WHATSAPP_LINK} target="_blank" rel="noreferrer" className="block text-center">
                    <p className="text-[9px] font-black text-white/25 underline hover:text-white/60 transition-colors">Problems? Message Support via WhatsApp</p>
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECENT PENDING REQUESTS */}
      {topUps.length > 0 && (
        <div className="glass rounded-[2rem] border-white/5 shadow-xl overflow-hidden">
          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Recent Recharge Requests</h3>
          </div>
          <div className="divide-y divide-white/5">
            {topUps.map((tu: any) => (
              <div key={tu.id} className="px-5 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between gap-3 hover:bg-white/[0.01] transition-colors">
                <div className="min-w-0">
                  <p className="font-bold text-sm tracking-tight truncate">{formatUsd(Number(tu.amount))} Whish Transfer</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                    {format(new Date(tu.created_at), 'MMM d, HH:mm')}
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={tu.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSACTION HISTORY */}
      <div className="glass rounded-[2rem] sm:rounded-[2.5rem] border border-white/[0.06] shadow-2xl relative overflow-hidden">
        <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          <h2 className="font-black text-base sm:text-lg flex items-center gap-2.5 tracking-tight text-white/80">
            <Clock className="w-4 h-4 text-primary" /> Transaction History
          </h2>
          <div className="flex bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.07] self-start sm:self-auto">
            {(['all', 'credit', 'debit'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => handleTxFilter(f)}
                className={`px-4 sm:px-5 py-1.5 rounded-lg text-[9px] font-black transition-all ${
                  txFilter === f
                    ? 'bg-primary text-white shadow-lg shadow-primary/25'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {txLoading ? (
          <div className="p-5 sm:p-8 space-y-3 sm:space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (() => {
          if (txFiltered.length === 0) {
            return (
              <div className="py-16 px-8 sm:p-24 text-center text-muted-foreground text-xs font-black uppercase tracking-[0.3em] opacity-20 italic">
                No logs found.
              </div>
            )
          }

          return (
            <>
              <div className="divide-y divide-white/5">
                {txVisible.map((tx: any) => {
                  const txDir = (tx.direction ?? 'debit') as 'credit' | 'debit' | 'neutral'
                  const isCredit = txDir === 'credit'
                  const isNeutral = txDir === 'neutral' || tx.status === 'rejected'

                  return (
                    <div key={tx.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-8 py-3.5 sm:py-4 hover:bg-white/[0.02] transition-colors group">
                      {/* icon */}
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isNeutral ? 'tx-icon-neutral' : isCredit ? 'tx-icon-credit' : 'tx-icon-debit'
                      }`}>
                        {isNeutral ? <Minus className="w-3.5 h-3.5" /> : isCredit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      </div>

                      {/* description + time */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-[12px] sm:text-[13px] tracking-tight truncate text-white/90">
                          {tx.description ?? tx.method}
                        </p>
                        <p className="text-[8px] sm:text-[9px] font-black mt-0.5 uppercase tracking-widest text-white/25">
                          {tx.created_at ? format(new Date(tx.created_at), 'MMM d · HH:mm') : '—'}
                        </p>
                      </div>

                      {/* amount + badge */}
                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm sm:text-base tabular-nums tracking-tighter ${
                          isNeutral ? 'text-white/35' : isCredit ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {isNeutral ? '' : isCredit ? '+' : '−'}{formatUsd(Number(tx.amount))}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              {txFiltered.length > txLimit && (
                <div className="p-6 sm:p-10 text-center">
                  <Button
                    variant="ghost"
                    className="text-[10px] font-black tracking-widest text-muted-foreground hover:text-primary transition-colors touch-target"
                    onClick={() => setTxLimit((l) => l + 15)}
                  >
                    LOAD MORE LOGS
                  </Button>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
