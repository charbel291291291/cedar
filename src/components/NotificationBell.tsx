import { useState } from 'react'
import { Bell, Package, Wallet, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import StatusBadge from '@/components/StatusBadge'
import type { AppNotification } from '@/hooks/useNotifications'
import { useLanguage } from '@/i18n/LanguageContext'

interface Props {
  notifications: AppNotification[]
  unreadCount: number
  onMarkAllRead: () => void
  onClear: () => void
}

export default function NotificationBell({ notifications, unreadCount, onMarkAllRead, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()

  const handleOpen = () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (unreadCount > 0) onMarkAllRead()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all tap-feedback"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full ring-2 ring-[#050505] animate-pulse" />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute end-0 top-full mt-2.5 w-[320px] sm:w-80 rounded-2xl border border-white/[0.09] shadow-[0_24px_64px_rgba(0,0,0,0.6)] z-50 overflow-hidden slide-up"
            style={{ background: 'rgba(10,10,10,0.97)', backdropFilter: 'blur(24px) saturate(160%)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-primary" />
                <p className="text-[11px] font-black uppercase tracking-widest text-white/80">{t('notifications')}</p>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-black bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { onClear(); setOpen(false) }}
                    className="text-white/30 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-white/30 hover:text-white/80 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto scrollbar-hide divide-y divide-white/[0.05]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-white/25">
                  <Bell className="w-7 h-7 opacity-40" />
                  <p className="text-[10px] font-black uppercase tracking-widest">{t('noNotifications')}</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3.5 transition-colors ${!n.read ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]'}`}
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      n.type === 'order' ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
                    }`}>
                      {n.type === 'order' ? (
                        <Package className="w-3.5 h-3.5 text-blue-400" />
                      ) : (
                        <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-white/80 leading-snug">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <StatusBadge status={n.status} />
                        <span className="text-[9px] font-black text-white/25 shrink-0">
                          {formatDistanceToNow(n.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
