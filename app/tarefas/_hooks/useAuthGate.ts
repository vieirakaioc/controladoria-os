'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Carrega o usuário autenticado e o role. Se não houver sessão, redireciona pra /login.
 * Expõe { userId, userName, userEmail, userRole, authLoaded } pro page.tsx.
 */
export function useAuthGate() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('membro')
  const [authLoaded, setAuthLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.auth.getUser()
      if (cancelled) return
      if (error || !data?.user) {
        router.push('/login')
        return
      }
      const u = data.user
      setUserId(u.id)
      setUserEmail(u.email || '')
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', u.id)
        .maybeSingle()
      if (cancelled) return
      setUserName(prof?.full_name?.trim() || u.email || 'Usuário')
      setUserRole(prof?.role?.toLowerCase().trim() || 'membro')
      setAuthLoaded(true)
    })()
    return () => { cancelled = true }
  }, [router])

  return { userId, userName, userEmail, userRole, authLoaded }
}
