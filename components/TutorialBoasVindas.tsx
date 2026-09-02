'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen, CheckSquare, Users, Trophy, Plane, X, ChevronLeft, ChevronRight,
  Sparkles, BarChart3, Bell,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Slide = {
  icon: React.ReactNode
  titulo: string
  texto: React.ReactNode
}

const SLIDES_BASE: Slide[] = [
  {
    icon: <Sparkles size={32} />,
    titulo: 'Bem-vindo ao Portal da Controladoria! 👋',
    texto: (
      <>
        <p>
          Esse é o sistema de gestão de tarefas recorrentes da equipe. Em poucos minutos você se acostuma —
          deixa eu te mostrar o essencial.
        </p>
        <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
          Sempre que precisar, abre o <strong>Manual</strong> na sidebar pra ver o guia completo.
        </p>
      </>
    ),
  },
  {
    icon: <CheckSquare size={32} />,
    titulo: 'Controle de Tarefas',
    texto: (
      <>
        <p>
          A aba <strong>Controle de Tarefas</strong> é onde você passa o dia. Tem 4 visões:
          <strong> Lista</strong>, <strong>Status</strong> (kanban por workflow),
          <strong> Dias</strong> (urgência por prazo) e <strong>Mês</strong> (calendário).
        </p>
        <p className="mt-2">
          Clique em <strong>Detalhes</strong> num cartão pra abrir tudo: comentar, anexar evidência,
          adicionar subtarefas, marcar como concluído.
        </p>
        <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
          Tem coisa extraordinária? Use <strong>+ Nova Ad Hoc</strong>.
        </p>
      </>
    ),
  },
  {
    icon: <Plane size={32} />,
    titulo: 'Modo Férias',
    texto: (
      <>
        <p>
          Vai sair de férias, licença ou atestado? Vai em <strong>Férias da Equipe</strong> e clica em
          <strong> Solicitar minha ausência</strong>.
        </p>
        <p className="mt-2">
          Suas tarefas dentro do período <strong>não contam no seu score</strong>. Se você designar um
          <strong> substituto</strong>, as tarefas vão pro score dele durante o período.
        </p>
        <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
          O calendário visual mostra quem está fora — útil pra planejar.
        </p>
      </>
    ),
  },
  {
    icon: <Bell size={32} />,
    titulo: 'Notificações',
    texto: (
      <>
        <p>
          O <strong>sininho na sidebar</strong> mostra notificações em tempo real: comentários, menções,
          tarefas atribuídas. Aparece toast no desktop se permitir.
        </p>
        <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
          Você também recebe email quando uma tarefa muda de status ou alguém te menciona.
        </p>
      </>
    ),
  },
]

const SLIDE_ADMIN: Slide = {
  icon: <BarChart3 size={32} />,
  titulo: 'Visão de Admin: Monitor & Score',
  texto: (
    <>
      <p>
        Como admin, você tem acesso a <strong>Monitor da Equipe</strong>: pódio mensal, ranking,
        heatmap de atividade, histórico de 6 meses, score 0-100 configurável.
      </p>
      <p className="mt-2">
        E no <strong>Início (Sincronizar)</strong>, você importa a planilha de atividades e executa a
        sincronização mensal pra gerar os cartões.
      </p>
      <p className="mt-2 text-xs text-ink-500 dark:text-slate-400">
        Detalhes completos no <strong>Manual</strong>.
      </p>
    </>
  ),
}

const CACHE_KEY_PREFIX = 'tutorial_visto_'

export function TutorialBoasVindas() {
  const [aberto, setAberto] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setUserId(user.id)

      // Já viu o tutorial? skipa.
      const cacheKey = `${CACHE_KEY_PREFIX}${user.id}`
      if (typeof localStorage !== 'undefined' && localStorage.getItem(cacheKey)) return

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (cancelled) return
      setIsAdmin(prof?.role === 'admin')
      setAberto(true)
    })()
    return () => { cancelled = true }
  }, [])

  const fechar = () => {
    if (userId && typeof localStorage !== 'undefined') {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, '1')
    }
    setAberto(false)
  }

  if (!aberto) return null

  const slides = isAdmin ? [...SLIDES_BASE, SLIDE_ADMIN] : SLIDES_BASE
  const total = slides.length
  const slide = slides[step]
  const ultimo = step === total - 1

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#031D2D]/70 dark:bg-black/90 backdrop-blur-md" onClick={fechar} />

      <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-xl flex flex-col overflow-hidden border border-line dark:border-slate-800 animate-in zoom-in-95 duration-200">
        {/* Botão fechar */}
        <button
          onClick={fechar}
          className="absolute top-4 right-4 z-10 text-ink-400 hover:text-navy-700 dark:hover:text-white p-1.5 rounded-md hover:bg-navy-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fechar tutorial"
        >
          <X size={18} />
        </button>

        {/* Slide content */}
        <div className="p-8 pt-12">
          <div className="bg-gradient-to-br from-[#0f88a8]/10 to-[#063955]/10 dark:from-[#38bdf8]/15 dark:to-[#063955]/30 w-16 h-16 rounded-lg flex items-center justify-center text-teal-600 dark:text-[#38bdf8] mb-5">
            {slide.icon}
          </div>
          <h2 className="text-2xl font-bold text-navy-700 dark:text-white tracking-tight mb-3">
            {slide.titulo}
          </h2>
          <div className="text-sm text-ink-700 dark:text-slate-200 leading-relaxed space-y-2">
            {slide.texto}
          </div>
        </div>

        {/* Footer: dots + ações */}
        <div className="border-t border-line dark:border-slate-800 p-5 bg-navy-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-teal-600 dark:bg-[#38bdf8]' : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'}`}
                aria-label={`Ir pro slide ${i + 1}`}
              />
            ))}
          </div>

          {/* Botões */}
          <div className="flex items-center gap-2">
            {!ultimo && (
              <button
                onClick={fechar}
                className="text-xs font-semibold text-ink-500 hover:text-ink-700 dark:hover:text-ink-400 px-3 py-2 transition-colors"
              >
                Pular
              </button>
            )}
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex items-center gap-1 text-sm font-semibold text-ink-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-2 rounded-md transition-colors"
              >
                <ChevronLeft size={14} /> Voltar
              </button>
            )}
            {ultimo ? (
              <Link
                href="/ajuda"
                onClick={fechar}
                className="flex items-center gap-1.5 bg-navy-700 hover:bg-[#042436] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
              >
                <BookOpen size={14} /> Ver Manual
              </Link>
            ) : (
              <button
                onClick={() => setStep(s => Math.min(s + 1, total - 1))}
                className="flex items-center gap-1 bg-teal-600 hover:bg-[#0c708b] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
              >
                Próximo <ChevronRight size={14} />
              </button>
            )}
            {ultimo && (
              <button
                onClick={fechar}
                className="bg-teal-600 hover:bg-[#0c708b] text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors shadow-sm"
              >
                Pronto 🚀
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
