import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function useAdminAccess() {
  const { user, session } = useAuth()

  return useQuery({
    queryKey: ['users', user?.id, 'admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('role').eq('id', user!.id).single()
      if (error) {
        console.error('useAdminAccess error:', error)
        throw error
      }
      return data?.role === 'admin'
    },
    enabled: !!session && !!user?.id,
    staleTime: 30_000,
  })
}
