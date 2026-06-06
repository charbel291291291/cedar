import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n/LanguageContext';
import { TranslationKey } from '@/i18n/translations';

/** 🟡 pending / review · 🔵 processing · 🟢 completed · 🔴 rejected · + cyan paid */
const statusConfig: Record<string, { labelKey: TranslationKey; className: string }> = {
  pending: {
    labelKey: 'statusPending',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/35',
  },
  pending_payment_review: {
    labelKey: 'statusPendingReview',
    className: 'bg-amber-600/20 text-amber-300 border-amber-500/40',
  },
  paid: {
    labelKey: 'statusPaid',
    className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/35',
  },
  processing: {
    labelKey: 'statusProcessing',
    className: 'bg-blue-600/15 text-blue-400 border-blue-500/40',
  },
  completed: {
    labelKey: 'statusCompleted',
    className: 'bg-emerald-600/15 text-emerald-400 border-emerald-500/40',
  },
  rejected: {
    labelKey: 'statusRejected',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
  failed: {
    labelKey: 'statusFailed',
    className: 'bg-orange-950/40 text-orange-400 border-orange-500/35',
  },
  approved: {
    labelKey: 'statusApproved',
    className: 'bg-emerald-600/15 text-emerald-400 border-emerald-500/40',
  },
};

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config = statusConfig[status] || { labelKey: 'statusPending' as TranslationKey, className: '' };
  return (
    <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 ${config.className}`}>
      {t(config.labelKey)}
    </Badge>
  );
}
