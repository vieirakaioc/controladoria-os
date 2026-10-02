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
      /*
       * A sessão local primeiro; a conferência com o servidor em segundo plano.
       *
       * `getUser()` faz uma ida à rede SEGURANDO a trava da sessão do
       * supabase-js, e toda consulta ao banco precisa dessa trava para pegar o
       * token. Enquanto ele ia e voltava, a tela inteira esperava — era o
       * "Acquiring an exclusive Navigator LockManager lock ... immediately
       * failed" que aparecia no console.
       *
       * A conferência continua acontecendo: se o servidor recusar o login, a
       * pessoa vai para a tela de entrada do mesmo jeito. O que muda é que ela
       * deixa de bloquear o carregamento, e os dados protegidos continuam
       * protegidos pelas políticas do banco, que validam o token a cada
       * consulta.
       */
      const { data: sessao } = await supabase.auth.getSession()
      if (cancelled) return

      const u = sessao?.session?.user
      if (!u) {
        router.push('/login')
        return
      }

      supabase.auth.getUser().then(({ data: conferido, error: falha }) => {
        if (!cancelled && (falha || !conferido?.user)) router.push('/login')
      })
      setUserId(u.id)
      setUserEmail(u.email || '')
      const { data: prof } = await supabase
        .from('profiles')
        // `*`, e não a lista de colunas: pedir uma coluna que ainda não existe
        // no banco faz a consulta inteira falhar, e aí o perfil volta vazio —
        // a pessoa vira "membro" e passa a ver só as próprias tarefas. Um campo
        // novo não pode derrubar o reconhecimento de quem é admin.
        .select('*')
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
