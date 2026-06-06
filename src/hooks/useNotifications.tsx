import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export type AppNotification = {
  id: string
  type: 'order' | 'topup'
  message: string
  status: string
  read: boolean
  timestamp: Date
}

// ─── Subtle Web Audio ping (no external assets required) ─────────────────────
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.connect(gain)
    gain.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)          // A5
    oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15) // A4

    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)

    // Clean up context after sound finishes
    setTimeout(() => ctx.close(), 600)
  } catch {
    // Silently ignore — AudioContext may be blocked by browser policy
  }
}

export function useNotifications() {
  const { user, session } = useAuth()
  const queryClient = useQueryClient()
  const audioUnlockedRef = useRef(false)

  const QUERY_KEY = ['notifications', user?.id]

  // ── Load persisted notifications from DB ──────────────────────────────────
  const { data: notifications = [] } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []).map((n) => ({
        id: n.id,
        type: n.type as 'order' | 'topup',
        message: n.message,
        status: n.status,
        read: n.read,
        timestamp: new Date(n.created_at),
      })) as AppNotification[]
    },
    enabled: !!session && !!user?.id,
    staleTime: 30_000,
  })

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })

  // ── Unlock AudioContext on first user interaction ─────────────────────────
  useEffect(() => {
    const unlock = () => { audioUnlockedRef.current = true }
    window.addEventListener('click', unlock, { once: true })
    window.addEventListener('touchstart', unlock, { once: true })
    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [])

  // ── Realtime: new notification rows → toast + sound + refresh ─────────────
  useEffect(() => {
    if (!session || !user?.id) return

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new.message as string
          const type = payload.new.type as string

          // Choose toast variant by notification type
          if (type === 'topup') {
            toast.success(msg, {
              duration: 5000,
              icon: msg.includes('+') ? '💚' : '💸',
            })
          } else if (type === 'order') {
            const isCompleted = (payload.new.status as string) === 'completed'
            toast[isCompleted ? 'success' : 'info'](msg, {
              duration: 5000,
              icon: isCompleted ? '✅' : '📦',
            })
          } else {
            toast.info(msg, { duration: 4000 })
          }

          // Play sound if audio is unlocked
          if (audioUnlockedRef.current) {
            playNotificationSound()
          }

          // Refresh query so bell count updates immediately
          void queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session, user?.id, queryClient])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    markAllRead: () => void markAllReadMutation.mutateAsync(),
    clearAll: () => void clearAllMutation.mutateAsync(),
  }
}
