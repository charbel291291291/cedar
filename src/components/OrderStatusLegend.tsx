import { useLanguage } from '@/i18n/LanguageContext'
import { ORDER_FLOW_STATUSES } from '@/lib/orderStatusFlow'
import StatusBadge from '@/components/StatusBadge'

const dotClass: Record<string, string> = {
  pending: 'bg-amber-400',
  pending_payment_review: 'bg-amber-500',
  paid: 'bg-cyan-500',
  processing: 'bg-blue-500',
  completed: 'bg-emerald-500',
  rejected: 'bg-red-500',
  failed: 'bg-orange-500',
}

/**
 * Compact reference for admins: standard statuses + colors.
 */
export default function OrderStatusLegend() {
  const { t } = useLanguage()

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('orderFlowLegendTitle')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        {ORDER_FLOW_STATUSES.map((st) => (
          <div key={st} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass[st] ?? 'bg-muted'}`} aria-hidden />
            <StatusBadge status={st} />
          </div>
        ))}
      </div>
    </div>
  )
}
