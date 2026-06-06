import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n/LanguageContext'
import { getErrorMessage } from '@/lib/errors'
import { uploadPaymentProof, validateProofFile } from '@/lib/uploadProof'
import { formatUsd } from '@/lib/formatCurrency'
import { Upload, UserRound, Wallet, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'

function sanitizeTargetId(raw: string): string {
  return raw.trim().slice(0, 256).replace(/[\x00-\x1F\x7F]/g, '')
}

type PaymentMethod = 'usdt' | 'wish' | 'wallet'

export interface CreateOrderProps {
  serviceId: string
  packageId: string
  packageName?: string
  packagePrice?: number
  onSuccess?: () => void
}

export default function CreateOrder({
  serviceId,
  packageId,
  packageName,
  packagePrice,
  onSuccess,
}: CreateOrderProps) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [targetUserId, setTargetUserId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('usdt')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Fetch user balance for wallet payment option
  const { data: userRow } = useQuery({
    queryKey: ['users', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const balance = userRow?.balance ?? 0
  const hasEnoughBalance = packagePrice != null && balance >= packagePrice

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const onFileChange = (file: File | null) => {
    setProofFile(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : null
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = sanitizeTargetId(targetUserId)
    if (!trimmed) {
      toast.error(t('enterTargetId'))
      return
    }
    if (!user?.id) {
      toast.error(t('somethingWentWrong'))
      return
    }

    setSubmitting(true)
    try {
      // Wallet payment — use atomic RPC
      if (paymentMethod === 'wallet') {
        if (!hasEnoughBalance) {
          toast.error(t('insufficientBalance'))
          return
        }
        const { data, error } = await supabase.rpc('place_wallet_order', {
          p_service_id: serviceId,
          p_package_id: packageId,
          p_target_user_id: trimmed,
        })
        if (error) throw error
        const result = data as { ok: boolean; reason?: string }
        if (!result.ok) {
          if (result.reason === 'insufficient_balance') throw new Error(t('insufficientBalance'))
          if (result.reason === 'package_not_found') throw new Error('Package not found')
          throw new Error(t('somethingWentWrong'))
        }
        toast.success(t('orderPaidFromWallet'))
        queryClient.invalidateQueries({ queryKey: ['users'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        setTargetUserId('')
        onSuccess?.()
        return
      }

      // USDT / Wish payment — upload proof + create pending order
      let proofImage: string | null = null
      if (proofFile) {
        validateProofFile(proofFile)
        const { path } = await uploadPaymentProof(proofFile, user.id, 'orders')
        proofImage = path
      }

      const { error } = await supabase.from('orders').insert({
        user_id: user.id,
        service_id: serviceId,
        package_id: packageId,
        target_user_id: trimmed,
        status: 'pending',
        payment_method: paymentMethod,
        proof_image: proofImage,
      })
      if (error) throw error

      toast.success(t('orderSuccess'))
      setTargetUserId('')
      onFileChange(null)
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      onSuccess?.()
    } catch (err) {
      toast.error(getErrorMessage(err, t('orderFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  const paymentOptions: { id: PaymentMethod; label: string; desc: string; icon: typeof CreditCard }[] = [
    { id: 'usdt', label: t('usdtTrc20'), desc: t('binanceTrc20'), icon: CreditCard },
    { id: 'wish', label: t('wishMoney'), desc: t('wishMoneyDesc'), icon: CreditCard },
    { id: 'wallet', label: t('walletBalance'), desc: `${t('yourBalance')}: ${formatUsd(balance)}`, icon: Wallet },
  ]

  return (
    <Card className="glass border-border/60 shadow-lg dark:shadow-primary/5 animate-fade-in overflow-hidden">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="font-heading text-lg">{t('placeOrder')}</CardTitle>
        <CardDescription>
          {packageName && (
            <span className="text-foreground/90">
              {packageName}
              {packagePrice != null && (
                <span className="ms-2 font-semibold text-primary">{formatUsd(packagePrice)}</span>
              )}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Target User ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <UserRound className="w-4 h-4 text-muted-foreground" />
              {t('targetUserId')}
            </label>
            <Input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder={t('enterUserId')}
              className="bg-secondary/80 border-border"
              dir="ltr"
              autoComplete="off"
            />
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('selectPaymentMethod')}</p>
            <div className="grid gap-2 grid-cols-3">
              {paymentOptions.map(({ id, label, desc, icon: Icon }) => {
                const isWalletInsufficient = id === 'wallet' && !hasEnoughBalance
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={isWalletInsufficient}
                    onClick={() => setPaymentMethod(id)}
                    className={cn(
                      'glass rounded-lg p-3 text-start text-sm transition-all border',
                      paymentMethod === id ? 'border-primary glow' : 'border-border/50 hover:border-primary/30',
                      isWalletInsufficient && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <p className="font-semibold text-xs leading-tight">{label}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                    {isWalletInsufficient && (
                      <p className="text-[10px] text-destructive mt-1">{t('insufficientBalance')}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Proof upload — only for non-wallet */}
          {paymentMethod !== 'wallet' && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                {t('uploadProofOptional')}
              </label>
              <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  id={`proof-${packageId}`}
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
                <label htmlFor={`proof-${packageId}`} className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  {proofFile ? proofFile.name : t('clickToUpload')}
                </label>
                {previewUrl && (
                  <img src={previewUrl} alt="" className="mt-3 max-h-40 mx-auto rounded-md border border-border object-contain" />
                )}
              </div>
            </div>
          )}

          {/* Wallet payment summary */}
          {paymentMethod === 'wallet' && hasEnoughBalance && packagePrice != null && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('yourBalance')}</span>
                <span className="font-semibold tabular-nums">{formatUsd(balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('price')}</span>
                <span className="font-semibold tabular-nums text-destructive">− {formatUsd(packagePrice)}</span>
              </div>
              <div className="flex justify-between border-t border-primary/20 pt-1 mt-1">
                <span className="text-muted-foreground">After</span>
                <span className="font-semibold tabular-nums">{formatUsd(balance - packagePrice)}</span>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full gradient-primary font-semibold" disabled={submitting}>
            {submitting ? t('submitting') : t('submitOrder')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
