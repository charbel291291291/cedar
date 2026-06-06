import { Navigate } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useLanguage } from '@/i18n/LanguageContext'

function AdminRouteLoading() {
  return (
    <div className="w-full max-w-sm mx-auto space-y-4 py-8 animate-fade-in">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    const checkAdmin = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id

        if (!userId) {
          if (!cancelled) {
            setIsAdmin(false)
            setLoading(false)
          }
          return
        }

        const { data, error } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()

        if (error) {
          console.error('[AdminRoute]', error)
        }

        const granted = data?.role === 'admin'

        if (!cancelled) {
          setIsAdmin(!!granted)
          setLoading(false)
        }
      } catch (e) {
        console.error('[AdminRoute]', e)
        if (!cancelled) {
          setIsAdmin(false)
          setLoading(false)
        }
      }
    }

    checkAdmin()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading || isAdmin) return
    toast.error(t('adminAccessDenied'), { id: 'admin-access-denied', duration: 8_000 })
  }, [loading, isAdmin, t])

  if (loading) return <AdminRouteLoading />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
