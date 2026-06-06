import { useState, useEffect, useMemo, useTransition, useCallback, memo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Package, Clock, CheckCircle2, Loader2, XCircle, AlertCircle, ShoppingBag, RefreshCw } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { formatUsd } from '@/lib/formatCurrency'

// ─── Status → progress mapping ────────────────────────────────────────────────
const STATUS_PROGRESS: Record<string, number> = {
  pending: 20,
  pending_payment_review: 30,
  paid: 50,
  processing: 75,
  completed: 100,
  rejected: 0,
  failed: 0,
}

const STATUS_COLOR: Record<string, string> = {
  pending:               'bg-zinc-500',
  pending_payment_review:'bg-amber-500',
  paid:                  'bg-cyan-500',
  processing:            'bg-blue-500',
  completed:             'bg-emerald-500',
  rejected:              'bg-red-500',
  failed:                'bg-orange-500',
}

const STATUS_GLOW: Record<string, string> = {
  pending:               '',
  processing:            'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
  completed:             'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
  rejected:              'shadow-[0_0_12px_rgba(239,68,68,0.4)]',
  failed:                'shadow-[0_0_12px_rgba(249,115,22,0.4)]',
}

// ─── Order status icon ────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
  if (status === 'processing' || status === 'paid') return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
  if (status === 'rejected' || status === 'failed') return <XCircle className="w-5 h-5 text-red-400" />
  return <Clock className="w-5 h-5 text-zinc-400" />
}

// ─── Visual progress bar ──────────────────────────────────────────────────────
function OrderProgress({ status }: { status: string }) {
  const isError = status === 'rejected' || status === 'failed'
  const progress = STATUS_PROGRESS[status] ?? 0
  const barColor = isError ? 'bg-red-500' : STATUS_COLOR[status] ?? 'bg-zinc-500'
  const isAnimating = status === 'processing' || status === 'paid'

  const steps = [
    { label: 'Placed', statuses: ['pending', 'pending_payment_review', 'paid', 'processing', 'completed'] },
    { label: 'Paid',   statuses: ['paid', 'processing', 'completed'] },
    { label: 'Active', statuses: ['processing', 'completed'] },
    { label: 'Done',   statuses: ['completed'] },
  ]

  if (isError) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-red-500/60 w-full rounded-full" />
        </div>
        <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">{status}</span>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      {/* bar */}
      <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${isAnimating ? 'animate-pulse' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* step dots */}
      <div className="flex justify-between">
        {steps.map((step) => {
          const active = step.statuses.includes(status)
          return (
            <div key={step.label} className="flex flex-col items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${active ? `${barColor} scale-125` : 'bg-white/10'}`} />
              <span className={`text-[8px] font-black uppercase tracking-wider ${active ? 'text-white/60' : 'text-white/20'}`}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Single order card ────────────────────────────────────────────────────────
function OrderCard({ order }: { order: any }) {
  const serviceName = order.services?.name ?? order.packages?.name ?? `Service #${(order.service_id ?? '').substring(0, 8)}`
  const packageName = order.packages?.name
  const amount = order.packages?.price ?? order.amount ?? 0
  const glow = STATUS_GLOW[order.status] ?? ''

  return (
    <div className={`glass border border-white/5 rounded-[2rem] p-6 hover:border-white/10 transition-all duration-300 group ${glow}`}>
      <div className="flex items-start justify-between gap-4">
        {/* icon + info */}
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <StatusIcon status={order.status} />
          </div>
          <div>
            <p className="font-black text-sm tracking-tight line-clamp-1">{serviceName}</p>
            {packageName && (
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60 mt-0.5">{packageName}</p>
            )}
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40 mt-1 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {order.created_at ? format(new Date(order.created_at), 'MMM d, HH:mm') : '—'}
            </p>
          </div>
        </div>

        {/* right side */}
        <div className="text-right shrink-0">
          <p className="font-black text-base tabular-nums tracking-tighter">
            {amount > 0 ? formatUsd(Number(amount)) : '—'}
          </p>
          <div className="mt-1.5 flex justify-end">
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {/* progress bar */}
      <OrderProgress status={order.status} />

      {/* order id */}
      <p className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest mt-3 font-mono">
        #{order.id?.substring(0, 16)}…
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="glass border border-white/5 rounded-[2rem] p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="w-11 h-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 rounded-xl" />
            <Skeleton className="h-3 w-24 rounded-xl" />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <Skeleton className="h-5 w-16 rounded-xl" />
          <Skeleton className="h-4 w-20 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed'

const FILTER_LABELS: Record<StatusFilter, string> = {
  all:        'ALL',
  pending:    'PENDING',
  processing: 'ACTIVE',
  completed:  'DONE',
  failed:     'FAILED',
}

export default function Orders() {
  const { user, session } = useAuth()
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [, startTransition] = useTransition()

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-full', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, services(name), packages(name, price)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    enabled: !!session && !!user?.id,
    staleTime: 10_000,
  })

  // ── Realtime: live order status updates ──────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`orders-page-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['orders-full', user.id] }) }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['orders-full', user.id] }) }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user?.id, queryClient])

  // Memoize counts — one pass through the array instead of 5 separate .filter() calls
  const counts = useMemo(() => {
    const c = { all: orders.length, pending: 0, processing: 0, completed: 0, failed: 0 }
    for (const o of orders as any[]) {
      const s = o.status
      if (s === 'pending' || s === 'pending_payment_review') c.pending++
      else if (s === 'processing' || s === 'paid') c.processing++
      else if (s === 'completed') c.completed++
      else if (s === 'failed' || s === 'rejected') c.failed++
    }
    return c
  }, [orders])

  const filtered = useMemo(() =>
    (orders as any[]).filter(o => {
      if (filter === 'all') return true
      if (filter === 'processing') return o.status === 'processing' || o.status === 'paid'
      if (filter === 'failed') return o.status === 'failed' || o.status === 'rejected'
      return o.status === filter
    }),
  [orders, filter])

  const handleFilter = useCallback((key: StatusFilter) => {
    startTransition(() => setFilter(key))
  }, [startTransition])

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-primary/10 border border-primary/20 rounded-xl sm:rounded-2xl shrink-0">
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">My Orders</h1>
            <p className="text-muted-foreground text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-60">
              {orders.length} total
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl sm:rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 shrink-0 touch-target"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['orders-full', user?.id] })}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500/70">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live tracking active
      </div>

      {/* Filter tabs */}
      <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar gap-0.5">
        {(Object.entries(FILTER_LABELS) as [StatusFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => handleFilter(key)}
            className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap flex-shrink-0 ${
              filter === key
                ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105'
                : 'text-muted-foreground hover:bg-white/5'
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${filter === key ? 'bg-white/20' : 'bg-white/10'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <OrderSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass border border-white/5 rounded-[2rem] sm:rounded-[2.5rem] py-16 px-8 sm:p-24 text-center">
          <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground text-xs font-black uppercase tracking-[0.3em] opacity-30 italic">
            No orders found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order: any) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
