'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { normalizarEscopo, type Escopo, type Perfil } from '@/lib/acessoProjeto'

/**
 * Carrega o usuário autenticado, o role e o escopo. Sem sessão, vai pra /login.
 *
 * O escopo diz se a pessoa é da controladoria, do projeto Sankhya ou dos dois,
 * e é o que decide quais telas ela vê. Vem daqui, e não de cada tela, para não
 * existir uma tela que consulta o perfil de um jeito e outra de outro.
 */
export function useAuthGate() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState('membro')
  const [escopo, setEscopo] = useState<Escopo>('controladoria')
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
        .select('full_name, role, escopo')
        .eq('id', u.id)
        .maybeSingle()
      if (cancelled) return
      setUserName(prof?.full_name?.trim() || u.email || 'Usuário')
      setUserRole(prof?.role?.toLowerCase().trim() || 'membro')
      setEscopo(normalizarEscopo(prof?.escopo))
      setAuthLoaded(true)
    })()
    return () => { cancelled = true }
  }, [router])

  // Já montado: as regras de acesso pedem os quatro campos juntos, e remontar
  // esse objeto em cada tela é o caminho para uma delas esquecer um campo.
  //
  // Memoizado porque ele entra em lista de dependência de efeito: um objeto
  // novo a cada render faria a tela de tarefas recarregar sem parar.
  const perfil: Perfil = useMemo(
    () => ({ escopo, role: userRole, email: userEmail, nome: userName }),
    [escopo, userRole, userEmail, userName],
  )

  return { userId, userName, userEmail, userRole, escopo, perfil, authLoaded }
}
