import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tag, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { formatUsd } from '@/lib/formatCurrency'

interface PromoCodeInputProps {
  /** Called with credit amount after successful redemption */
  onRedeemed?: (amount: number) => void
}

type State = 'idle' | 'loading' | 'success' | 'error'

export default function PromoCodeInput({ onRedeemed }: PromoCodeInputProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')
  const [creditAmount, setCreditAmount] = useState(0)

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    setState('loading')
    setMessage('')

    try {
      const { data, error } = await supabase.rpc('redeem_promo_code', { p_code: trimmed })
      if (error) throw error

      const result = data as any
      if (!result.success) {
        setState('error')
        setMessage(result.error ?? 'Invalid promo code')
        return
      }

      setState('success')
      setCreditAmount(Number(result.credit_amount))
      setMessage(result.message ?? `${formatUsd(result.credit_amount)} added to your wallet!`)
      toast.success(result.message ?? `${formatUsd(result.credit_amount)} added!`, {
        icon: '💚',
        duration: 5000,
      })

      // Refresh balance + transactions
      void queryClient.invalidateQueries({ queryKey: ['users', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['transactions', user?.id] })

      onRedeemed?.(Number(result.credit_amount))
      setCode('')

      // Reset to idle after 4 seconds
      setTimeout(() => { setState('idle'); setMessage('') }, 4000)
    } catch (err: any) {
      setState('error')
      setMessage(err.message || 'Something went wrong. Try again.')
      setTimeout(() => { setState('idle'); setMessage('') }, 4000)
    }
  }

  const isLoading = state === 'loading'

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <Tag className="w-3 h-3" />
        Promo Code
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          {state === 'success' && (
            <Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-pulse" />
          )}
          <Input
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); if (state !== 'idle') setState('idle') }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="CEDAR-XXXXXX"
            disabled={isLoading || state === 'success'}
            className={`h-12 rounded-2xl border font-black tracking-widest text-sm transition-all ${
              state === 'success'
                ? 'pl-10 border-emerald-500/40 bg-emerald-500/5 text-emerald-400'
                : state === 'error'
                ? 'border-destructive/40 bg-destructive/5'
                : 'border-white/10 bg-white/5'
            }`}
          />
        </div>

        <Button
          onClick={handleApply}
          disabled={isLoading || !code.trim() || state === 'success'}
          className={`h-12 px-6 rounded-2xl font-black text-[11px] tracking-widest transition-all ${
            state === 'success'
              ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : state === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            'APPLY'
          )}
        </Button>
      </div>

      {/* Feedback message */}
      {message && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[11px] font-black animate-in fade-in slide-in-from-top-1 duration-300 ${
          state === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-destructive/10 border border-destructive/20 text-destructive'
        }`}>
          {state === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>
            {state === 'success' && creditAmount > 0 && (
              <span className="text-emerald-300 font-black mr-1">+{formatUsd(creditAmount)}</span>
            )}
            {message}
          </span>
        </div>
      )}
    </div>
  )
}
