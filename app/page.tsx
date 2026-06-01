'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { Toaster, toast } from 'react-hot-toast'
import { RefreshCw, Play, ShieldAlert, Download, Upload, Trash2, UserX } from 'lucide-react'

const MESES = [
  { v: 0, n: 'Janeiro' }, { v: 1, n: 'Fevereiro' }, { v: 2, n: 'Março' }, { v: 3, n: 'Abril' },
  { v: 4, n: 'Maio' }, { v: 5, n: 'Junho' }, { v: 6, n: 'Julho' }, { v: 7, n: 'Agosto' },
  { v: 8, n: 'Setembro' }, { v: 9, n: 'Outubro' }, { v: 10, n: 'Novembro' }, { v: 11, n: 'Dezembro' },
]

// 💡 NOVA FUNÇÃO: Garante que a data não sofre com o Fuso Horário do Brasil
const formataDataLocal = (dt: Date) => {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function Home() {
  const router = useRouter()

  const [atividades, setAtividades] = useState<any[]>([])
  const [feriados, setFeriados] = useState<string[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [gerandoCiclo, setGerandoCiclo] = useState(false)
  const [fazendoUpload, setFazendoUpload] = useState(false)

  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState<number>(hoje.getMonth() === 11 ? 0 : hoje.getMonth() + 1)
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getMonth() === 11 ? hoje.getFullYear() + 1 : hoje.getFullYear())

  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingAcesso, setLoadingAcesso] = useState(true)
  const [stats, setStats] = useState({ rotinasAtivas: 0, geradasNoMes: 0 })

  // ─── Exclusão por responsável (Feature 1) ─────────────────────────────
  type EscopoDel = 'todas' | 'adhoc' | 'base'
  /** -1 = "Todos" (apaga matriz + tudo). 0..11 = mês específico (só tarefas_diarias) */
  type MesDel = number
  const [respsLista, setRespsLista] = useState<{ id: string; nome: string; email?: string }[]>([])
  const [respDelOpen, setRespDelOpen] = useState(false)
  const [respDelId, setRespDelId] = useState<string>('')
  const [respDelEscopo, setRespDelEscopo] = useState<EscopoDel>('todas')
  const [respDelMes, setRespDelMes] = useState<MesDel>(-1)
  const [respDelAno, setRespDelAno] = useState<number>(new Date().getFullYear())
  const [respDelPreview, setRespDelPreview] = useState<{ atividades: number; tarefas: number } | null>(null)
  const [respDelLoading, setRespDelLoading] = useState(false)
  const [respDelSaving, setRespDelSaving] = useState(false)

  // ─── Exclusão da base sincronizada (modal próprio com escolha de mês) ──
  const [baseDelOpen, setBaseDelOpen] = useState(false)
  const [baseDelMes, setBaseDelMes] = useState<MesDel>(-1)
  const [baseDelAno, setBaseDelAno] = useState<number>(new Date().getFullYear())
  const [baseDelPreview, setBaseDelPreview] = useState<{ atividades: number; tarefas: number } | null>(null)
  const [baseDelLoading, setBaseDelLoading] = useState(false)
  const [baseDelSaving, setBaseDelSaving] = useState(false)

  useEffect(() => {
    const inicializar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (prof?.role === 'admin') setIsAdmin(true)
      } else {
        router.push('/login')
      }
      setLoadingAcesso(false)
      fetchDados()
    }
    inicializar()
  }, [router])

  useEffect(() => {
    if (atividades.length > 0) carregarEstatisticas()
  }, [mesAlvo, anoAlvo, atividades])

  const carregarEstatisticas = async () => {
    const rotinasAtivas = atividades.filter(a => a.frequencia !== 'Ad Hoc' && a.status === 'Ativo').length
    const inicioMes = formataDataLocal(new Date(anoAlvo, mesAlvo, 1))
    const fimMes = formataDataLocal(new Date(anoAlvo, mesAlvo + 1, 0))

    const { count: geradasCount } = await supabase
      .from('tarefas_diarias')
      .select('*, atividades!inner(*)', { count: 'exact', head: true })
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', fimMes)
      .neq('atividades.frequencia', 'Ad Hoc')

    setStats({ rotinasAtivas, geradasNoMes: geradasCount || 0 })
  }

  const fetchDados = async () => {
    setCarregandoDados(true)
    try {
      const { data: dbFeriados } = await supabase.from('feriados').select('data')
      setFeriados((dbFeriados || []).map((f: any) => f.data))

      const { data: dbAtividades, error: errAtv } = await supabase
        .from('atividades')
        .select(`
          task_id, planner_name, nome_atividade, prioridade_nivel, prioridade_descricao,
          frequencia, classificacao, dia_da_semana, dia_util, status,
          setores!atividades_setor_id_fkey (nome),
          responsaveis!atividades_responsavel_id_fkey (nome)
        `)
        .order('nome_atividade', { ascending: true })

      if (errAtv) throw errAtv
      setAtividades(dbAtividades || [])

      // Lista de responsáveis pra UI de exclusão por pessoa
      const { data: dbResps } = await supabase
        .from('responsaveis')
        .select('id, nome, email')
        .order('nome', { ascending: true })
      setRespsLista((dbResps || []) as any)
    } catch (error: any) {
      toast.error('Erro ao buscar dados da base.')
    } finally {
      setCarregandoDados(false)
    }
  }

  const calcularDatasVencimento = (regra: any, mes: number, ano: number) => {
    const datas: string[] = []
    const freq = (regra.frequencia || '').toLowerCase()
    const classif = (regra.classificacao || '').toLowerCase()

    // ── DECENDIAL: 3 entregas por mês nos dias 1, 11 e 21 ─────────────────
    // (mantém também o atalho histórico de "semanal + classificacao=fechamento"
    //  que já fazia esse mesmo cálculo, pra não quebrar atividades antigas)
    if (freq === 'decendial' || (freq === 'semanal' && classif === 'fechamento')) {
      const diasAlvo = [1, 11, 21]
      diasAlvo.forEach(d => {
        const dt = new Date(ano, mes, d)
        if (dt.getMonth() === mes) {
          // Pula sábado/domingo/feriado pra próxima data útil
          while (dt.getDay() === 0 || dt.getDay() === 6 || feriados.includes(formataDataLocal(dt))) {
            dt.setDate(dt.getDate() + 1)
          }
          datas.push(formataDataLocal(dt))
        }
      })
      return datas
    }

    if (freq === 'semanal' && regra.dia_da_semana) {
      const mapaDias: { [key: string]: number } = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }
      const chave = String(regra.dia_da_semana).toLowerCase().substring(0, 3)
      const diaAlvoSemana = mapaDias[chave]
      
      if (diaAlvoSemana !== undefined) {
        for (let d = 1; d <= 31; d++) {
          const dt = new Date(ano, mes, d)
          if (dt.getMonth() !== mes) break 
          if (dt.getDay() === diaAlvoSemana) {
            let dtReal = new Date(dt)
            while (dtReal.getDay() === 0 || dtReal.getDay() === 6 || feriados.includes(formataDataLocal(dtReal))) {
              dtReal.setDate(dtReal.getDate() + 1)
            }
            datas.push(formataDataLocal(dtReal))
          }
        }
        return datas
      }
    }

    if (regra.dia_da_semana) {
      const mapaDias: { [key: string]: number } = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }
      const chave = String(regra.dia_da_semana).toLowerCase().substring(0, 3)
      const diaAlvoSemana = mapaDias[chave]
      if (diaAlvoSemana !== undefined) {
        let data = new Date(ano, mes, 1)
        while (data.getDay() !== diaAlvoSemana) data.setDate(data.getDate() + 1)
        
        while (data.getDay() === 0 || data.getDay() === 6 || feriados.includes(formataDataLocal(data))) {
          data.setDate(data.getDate() + 1)
        }
        datas.push(formataDataLocal(data))
        return datas
      }
    }

    if (regra.dia_util) {
      let diasUteisContados = 0
      for (let d = 1; d <= 31; d++) {
        const dataTeste = new Date(ano, mes, d)
        if (dataTeste.getMonth() !== mes) break
        const fds = dataTeste.getDay() === 0 || dataTeste.getDay() === 6
        const fmt = formataDataLocal(dataTeste)
        const feriado = feriados.includes(fmt)

        if (!fds && !feriado) {
          diasUteisContados++
          if (diasUteisContados === Number(regra.dia_util)) {
            datas.push(fmt)
            return datas
          }
        }
      }
    }

    return datas
  }

  const mesesParaFrequencia = (freqRaw: string) => {
    const freq = (freqRaw || '').toLowerCase()
    if (freq === 'mensal' || freq === 'diária' || freq === 'semanal' || freq === 'decendial') return 'todo_mes'
    if (freq === 'anual') return 'janeiro'
    if (freq === 'trimestral') return 'trim'
    if (freq === 'bimestral') return 'bim'
    if (freq === 'semestral') return 'sem'
    return 'todo_mes'
  }

  const deveRodarNoMes = (freqRaw: string, mes: number) => {
    const tipo = mesesParaFrequencia(freqRaw)
    if (tipo === 'todo_mes') return true
    if (tipo === 'janeiro') return mes === 0
    if (tipo === 'trim') return [0, 3, 6, 9].includes(mes)
    if (tipo === 'bim') return [0, 2, 4, 6, 8, 10].includes(mes)
    if (tipo === 'sem') return [0, 6].includes(mes)
    return true
  }

  const gerarCicloDoMes = async () => {
    if (!window.confirm(`Tem a certeza que deseja gerar o lote de tarefas para ${MESES.find(m => m.v === mesAlvo)?.n} de ${anoAlvo}?\n\nℹ️ NOTA: Tarefas com datas de vencimento anteriores ao dia de HOJE não serão criadas para evitar a geração de tarefas em atraso.`)) return
    
    setGerandoCiclo(true)
    const toastId = toast.loading(`A gerar tarefas ativas do ciclo...`)

    // 💡 A LINHA QUE TRAVA O PASSADO
    const hojeISO = formataDataLocal(new Date())

    try {
      const cardsParaUpsert: any[] = []

      atividades.forEach((regra) => {
        if (!deveRodarNoMes(regra.frequencia, mesAlvo)) return
        const freq = (regra.frequencia || '').toLowerCase()

        if (freq === 'diária') {
          for (let d = 1; d <= 31; d++) {
            const dt = new Date(anoAlvo, mesAlvo, d)
            if (dt.getMonth() !== mesAlvo) break

            const fds = dt.getDay() === 0 || dt.getDay() === 6
            const fmt = formataDataLocal(dt)
            
            // 💡 Só empurra para o Kanban se a data for HOJE ou FUTURO
            if (fmt >= hojeISO && !fds && !feriados.includes(fmt)) {
              cardsParaUpsert.push({ atividade_id: regra.task_id, data_vencimento: fmt, status: 'Pendente' })
            }
          }
        } else {
          const datasVencimento = calcularDatasVencimento(regra, mesAlvo, anoAlvo)
          datasVencimento.forEach(dataVenc => {
            // 💡 Só empurra para o Kanban se a data for HOJE ou FUTURO
            if (dataVenc >= hojeISO) {
              cardsParaUpsert.push({ atividade_id: regra.task_id, data_vencimento: dataVenc, status: 'Pendente' })
            }
          })
        }
      })

      if (cardsParaUpsert.length === 0) {
        toast.error('Nenhuma tarefa pendente atende aos critérios para os dias restantes deste mês.', { id: toastId })
        return
      }

      const { error } = await supabase.from('tarefas_diarias').upsert(cardsParaUpsert, { onConflict: 'atividade_id,data_vencimento' })
      if (error) throw error
      
      toast.success(`${cardsParaUpsert.length} tarefas ativas geradas com sucesso!`, { id: toastId })
      carregarEstatisticas()
    } catch (err: any) {
      toast.error('Erro ao gerar ciclo: ' + err.message, { id: toastId })
    } finally {
      setGerandoCiclo(false)
    }
  }

  const apagarPorPlanner = async (isAdHoc: boolean) => {
    let query = supabase.from('atividades').select('task_id')
    if (isAdHoc) query = query.eq('planner_name', 'Ad Hoc')
    else query = query.or('planner_name.neq."Ad Hoc",planner_name.is.null')

    const { data: atvData } = await query
    const taskIds = (atvData || []).map(a => a.task_id)
    if (taskIds.length === 0) return

    await deletarCascataPorTaskIds(taskIds)
  }

  // ─── Helper: range ISO (yyyy-mm-dd) de um mês específico ──────────────
  const mesRange = (mes: number, ano: number): { inicio: string; fim: string } => {
    const ini = new Date(ano, mes, 1)
    const fim = new Date(ano, mes + 1, 1)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return { inicio: iso(ini), fim: iso(fim) }
  }

  // ─── Apaga só tarefas_diarias do mês (+ comentários), mantém matriz ───
  // Usado pra limpar um mês específico sem afetar outros.
  const deletarTarefasDoMes = async (taskIds: string[], mes: number, ano: number) => {
    if (taskIds.length === 0) return
    const chunkSize = 150
    const { inicio, fim } = mesRange(mes, ano)
    let dailyIds: string[] = []
    for (let i = 0; i < taskIds.length; i += chunkSize) {
      const chunk = taskIds.slice(i, i + chunkSize)
      const { data: tdData } = await supabase
        .from('tarefas_diarias').select('id')
        .in('atividade_id', chunk)
        .gte('data_vencimento', inicio).lt('data_vencimento', fim)
      if (tdData) dailyIds = dailyIds.concat(tdData.map((d: any) => d.id))
    }
    for (let i = 0; i < dailyIds.length; i += chunkSize) {
      await supabase.from('tarefa_comentarios').delete().in('tarefa_id', dailyIds.slice(i, i + chunkSize))
    }
    for (let i = 0; i < dailyIds.length; i += chunkSize) {
      await supabase.from('tarefas_diarias').delete().in('id', dailyIds.slice(i, i + chunkSize))
    }
  }

  // ─── Cascade delete reutilizável ──────────────────────────────────────
  // Recebe uma lista de task_ids (atividades) e apaga em ordem:
  //   tarefa_comentarios → tarefas_diarias → atividades
  const deletarCascataPorTaskIds = async (taskIds: string[]) => {
    if (taskIds.length === 0) return
    const chunkSize = 150
    let dailyIds: string[] = []

    for (let i = 0; i < taskIds.length; i += chunkSize) {
      const chunk = taskIds.slice(i, i + chunkSize)
      const { data: tdData } = await supabase.from('tarefas_diarias').select('id').in('atividade_id', chunk)
      if (tdData) dailyIds = dailyIds.concat(tdData.map(d => d.id))
    }

    for (let i = 0; i < dailyIds.length; i += chunkSize) await supabase.from('tarefa_comentarios').delete().in('tarefa_id', dailyIds.slice(i, i + chunkSize))
    for (let i = 0; i < taskIds.length; i += chunkSize) await supabase.from('tarefas_diarias').delete().in('atividade_id', taskIds.slice(i, i + chunkSize))
    for (let i = 0; i < taskIds.length; i += chunkSize) await supabase.from('atividades').delete().in('task_id', taskIds.slice(i, i + chunkSize))
  }

  // ─── Exclusão por responsável: helpers + handlers ─────────────────────
  // Coleta os task_ids das atividades onde o responsável aparece, seja como
  // FK direta (responsavel_id) ou dentro de responsaveis_lista (JSONB).
  // O parâmetro `escopo` filtra adicionalmente por tipo de planner:
  //   - 'todas': qualquer planner (Ad Hoc + base sincronizada)
  //   - 'adhoc': só planner_name = 'Ad Hoc'
  //   - 'base':  todos os outros planners (não-Ad-Hoc)
  const taskIdsDoResponsavel = async (respId: string, escopo: EscopoDel): Promise<string[]> => {
    const aplicaEscopo = (q: any) => {
      if (escopo === 'adhoc') return q.eq('planner_name', 'Ad Hoc')
      if (escopo === 'base') return q.or('planner_name.neq."Ad Hoc",planner_name.is.null')
      return q
    }
    const [{ data: fkData }, { data: listaData }] = await Promise.all([
      aplicaEscopo(supabase.from('atividades').select('task_id')).eq('responsavel_id', respId),
      aplicaEscopo(supabase.from('atividades').select('task_id')).contains('responsaveis_lista', [{ id: respId }]),
    ])
    const all = new Set<string>()
    ;(fkData || []).forEach((a: any) => all.add(a.task_id))
    ;(listaData || []).forEach((a: any) => all.add(a.task_id))
    return Array.from(all)
  }

  const carregarPreviewExclusaoResp = async (respId: string, escopo: EscopoDel, mes: MesDel, ano: number) => {
    if (!respId) { setRespDelPreview(null); return }
    setRespDelLoading(true)
    try {
      const taskIds = await taskIdsDoResponsavel(respId, escopo)
      if (taskIds.length === 0) {
        setRespDelPreview({ atividades: 0, tarefas: 0 })
        return
      }
      const chunkSize = 150
      let tarefas = 0
      const filtraMes = mes >= 0
      const { inicio, fim } = filtraMes ? mesRange(mes, ano) : { inicio: '', fim: '' }
      for (let i = 0; i < taskIds.length; i += chunkSize) {
        const chunk = taskIds.slice(i, i + chunkSize)
        let q = supabase.from('tarefas_diarias').select('id', { count: 'exact', head: true }).in('atividade_id', chunk)
        if (filtraMes) q = q.gte('data_vencimento', inicio).lt('data_vencimento', fim)
        const { count } = await q
        tarefas += count || 0
      }
      // Quando filtrando por mês, NÃO apagamos atividades matrizes → mostra 0
      setRespDelPreview({ atividades: filtraMes ? 0 : taskIds.length, tarefas })
    } catch (e) {
      toast.error('Não consegui calcular o preview da exclusão.')
      setRespDelPreview(null)
    } finally {
      setRespDelLoading(false)
    }
  }

  const apagarPorResponsavel = async () => {
    if (!respDelId) return
    const nome = respsLista.find(r => r.id === respDelId)?.nome || 'esse responsável'
    const labelEscopo =
      respDelEscopo === 'adhoc' ? 'Ad Hocs'
      : respDelEscopo === 'base' ? 'Base Sincronizada'
      : 'todas (Ad Hoc + Base)'
    const filtraMes = respDelMes >= 0
    const labelMes = filtraMes ? `${MESES[respDelMes].n}/${respDelAno}` : 'TODOS os meses'
    const acao = filtraMes
      ? `apagará as tarefas diárias de ${nome} no mês ${labelMes} (escopo: ${labelEscopo}). As rotinas matrizes ficam preservadas.`
      : `apagará ${labelEscopo === 'todas (Ad Hoc + Base)' ? 'TODAS as' : labelEscopo + ' de'} atividades de "${nome}" + todas as tarefas diárias e comentários vinculados.`

    if (!window.confirm(`⚠️ ATENÇÃO: ${acao}\n\nEsta ação NÃO pode ser desfeita. Deseja continuar?`)) return
    if (window.prompt(`Digite o nome "${nome}" para confirmar:`) !== nome) {
      toast.error('Confirmação não bateu. Operação cancelada.')
      return
    }

    setRespDelSaving(true)
    const toastId = toast.loading(`A apagar tarefas de ${nome}...`)
    try {
      const taskIds = await taskIdsDoResponsavel(respDelId, respDelEscopo)
      if (taskIds.length === 0) {
        toast.success('Esse responsável já não tinha atividades nesse escopo.', { id: toastId })
      } else if (filtraMes) {
        // Mês específico: apaga só tarefas_diarias do mês; matrizes preservadas
        await deletarTarefasDoMes(taskIds, respDelMes, respDelAno)
        toast.success(`Tarefas de ${labelMes} apagadas pra ${nome}.`, { id: toastId })
      } else {
        // Sem filtro de mês: cascade completo
        await deletarCascataPorTaskIds(taskIds)
        toast.success(`${taskIds.length} atividade(s) de ${nome} apagada(s)!`, { id: toastId })
      }
      setRespDelOpen(false)
      setRespDelId('')
      setRespDelEscopo('todas')
      setRespDelMes(-1)
      setRespDelPreview(null)
      fetchDados()
    } catch (e: any) {
      toast.error('Erro ao apagar atividades.', { id: toastId })
    } finally {
      setRespDelSaving(false)
    }
  }

  // ─── Apagar Base Sincronizada (com opção de mês) ──────────────────────
  const carregarPreviewBaseDel = async (mes: MesDel, ano: number) => {
    setBaseDelLoading(true)
    try {
      // Pega todos os task_ids da base (não-Ad Hoc)
      const { data: atvData } = await supabase
        .from('atividades').select('task_id')
        .or('planner_name.neq."Ad Hoc",planner_name.is.null')
      const taskIds = (atvData || []).map((a: any) => a.task_id)
      if (taskIds.length === 0) {
        setBaseDelPreview({ atividades: 0, tarefas: 0 })
        return
      }
      const chunkSize = 150
      let tarefas = 0
      const filtraMes = mes >= 0
      const { inicio, fim } = filtraMes ? mesRange(mes, ano) : { inicio: '', fim: '' }
      for (let i = 0; i < taskIds.length; i += chunkSize) {
        const chunk = taskIds.slice(i, i + chunkSize)
        let q = supabase.from('tarefas_diarias').select('id', { count: 'exact', head: true }).in('atividade_id', chunk)
        if (filtraMes) q = q.gte('data_vencimento', inicio).lt('data_vencimento', fim)
        const { count } = await q
        tarefas += count || 0
      }
      setBaseDelPreview({ atividades: filtraMes ? 0 : taskIds.length, tarefas })
    } catch {
      setBaseDelPreview(null)
    } finally {
      setBaseDelLoading(false)
    }
  }

  const apagarBaseComMes = async () => {
    const filtraMes = baseDelMes >= 0
    const labelMes = filtraMes ? `${MESES[baseDelMes].n}/${baseDelAno}` : 'TODOS os meses (matriz inteira)'
    const acao = filtraMes
      ? `Apagará as tarefas diárias da Base Sincronizada no mês ${labelMes}. As rotinas matrizes ficam preservadas.`
      : `Apagará TODAS as rotinas base e seus cartões. Ad Hocs ficam intactas.`

    if (!window.confirm(`⚠️ ATENÇÃO: ${acao}\n\nEsta ação NÃO pode ser desfeita. Deseja continuar?`)) return
    if (window.prompt('Digite APAGAR para confirmar:') !== 'APAGAR') {
      toast.error('Confirmação não bateu. Operação cancelada.')
      return
    }

    setBaseDelSaving(true)
    const toastId = toast.loading('A limpar...')
    try {
      if (filtraMes) {
        // Pega task_ids da base e apaga só tarefas_diarias do mês
        const { data: atvData } = await supabase
          .from('atividades').select('task_id')
          .or('planner_name.neq."Ad Hoc",planner_name.is.null')
        const taskIds = (atvData || []).map((a: any) => a.task_id)
        await deletarTarefasDoMes(taskIds, baseDelMes, baseDelAno)
        toast.success(`Tarefas de ${labelMes} (base) apagadas.`, { id: toastId })
      } else {
        await apagarPorPlanner(false)
        toast.success('Planilha base limpa!', { id: toastId })
      }
      setBaseDelOpen(false)
      setBaseDelMes(-1)
      setBaseDelPreview(null)
      fetchDados()
    } catch (e: any) {
      toast.error('Erro ao limpar.', { id: toastId })
    } finally {
      setBaseDelSaving(false)
    }
  }

  const limparPlanilhaSincronizada = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Apagará todas as rotinas base.\nAs tarefas 'Ad Hoc' serão MANTIDAS.\nDeseja continuar?")) return
    if (window.prompt('Digite APAGAR para confirmar:') !== 'APAGAR') return

    setFazendoUpload(true)
    const toastId = toast.loading('A limpar base de dados...')
    try {
      await apagarPorPlanner(false)
      toast.success('Planilha base limpa com sucesso!', { id: toastId })
      fetchDados()
    } catch(e: any) {
      toast.error('Erro ao limpar.', { id: toastId })
    } finally {
      setFazendoUpload(false)
    }
  }

  const limparAdHoc = async () => {
    if (!window.confirm("⚠️ ATENÇÃO: Apagará TODAS as tarefas 'Ad Hoc'.\nDeseja continuar?")) return
    setFazendoUpload(true)
    const toastId = toast.loading('A limpar Ad Hocs...')
    try {
      await apagarPorPlanner(true)
      toast.success('Ad Hocs limpos!', { id: toastId })
      fetchDados()
    } catch(e: any) {
      toast.error('Erro ao limpar.', { id: toastId })
    } finally {
      setFazendoUpload(false)
    }
  }

  // Exporta planilha completa com DUAS abas (formato que o import espera):
  //   • Lista   → atividades
  //   • ListBox → parâmetros (setores, responsáveis, prioridades, frequências, classificações, feriados)
  const exportarParaExcel = async () => {
    const toastId = toast.loading('A preparar planilha...')
    try {
      const [
        { data: setoresData },
        { data: respsData },
        { data: priosData },
        { data: freqsData },
        { data: classifsData },
        { data: feriadosData },
      ] = await Promise.all([
        supabase.from('setores').select('nome').order('nome'),
        supabase.from('responsaveis').select('nome, email').order('nome'),
        supabase.from('prioridades').select('nivel, descricao').order('nivel'),
        supabase.from('frequencias').select('nome').order('nome'),
        supabase.from('classificacoes').select('nome').order('nome'),
        supabase.from('feriados').select('data, nome').order('data'),
      ])

      // ListBox: cada coluna pode ter um número diferente de linhas,
      // alinhamos pelo maior; células faltantes ficam em branco.
      const maxLen = Math.max(
        setoresData?.length || 0,
        respsData?.length || 0,
        priosData?.length || 0,
        freqsData?.length || 0,
        classifsData?.length || 0,
        feriadosData?.length || 0,
        1,
      )
      const listBoxRows: any[] = []
      for (let i = 0; i < maxLen; i++) {
        listBoxRows.push({
          Setor: setoresData?.[i]?.nome || '',
          'Responsável': respsData?.[i]?.nome || '',
          'e-mail': respsData?.[i]?.email || '',
          Prioridade: priosData?.[i]?.nivel ?? '',
          'Prioridade_Descrição': priosData?.[i]?.descricao || '',
          Frequencia: freqsData?.[i]?.nome || '',
          'Classificação': classifsData?.[i]?.nome || '',
          Feriado: feriadosData?.[i]?.data || '',
          'Nome do Feriado': feriadosData?.[i]?.nome || '',
        })
      }

      // Lista: atividades (mesmo formato que o import lê em handleFileUpload)
      const dadosExportacao = atividades.map((t) => ({
        Task_ID: t.task_id,
        'Planner Name': t.planner_name || '',
        Setor: t.setores?.nome || '',
        Atividade: t.nome_atividade || '',
        'Responsável': t.responsaveis?.nome || '',
        Prioridade: t.prioridade_nivel || '',
        'Prioridade_Descrição': t.prioridade_descricao || '',
        Frequencia: t.frequencia || '',
        'Classificação': t.classificacao || '',
        'Dia Da Semana': t.dia_da_semana || '',
        'Dia Útil': t.dia_util || '',
        Status: t.status || '',
      }))

      const wsLista = XLSX.utils.json_to_sheet(dadosExportacao)
      const wsListBox = XLSX.utils.json_to_sheet(listBoxRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, wsLista, 'Lista')
      XLSX.utils.book_append_sheet(workbook, wsListBox, 'ListBox')
      XLSX.writeFile(workbook, `Exportacao_Tarefas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`)

      toast.success('Planilha exportada! Pode editar e re-importar.', { id: toastId })
    } catch (e: any) {
      toast.error('Erro ao exportar planilha.', { id: toastId })
    }
  }

  const parseNumber = (val: any) => {
    if (val == null || val === '') return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  const formatDateToISO = (val: any) => {
    if (!val) return null
    if (val instanceof Date) {
      const y = val.getFullYear()
      const m = String(val.getMonth() + 1).padStart(2, '0')
      const d = String(val.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    if (typeof val === 'string') {
      const str = val.trim()
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10)
      const brDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`
      const parsed = new Date(str)
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear()
        const m = String(parsed.getMonth() + 1).padStart(2, '0')
        const d = String(parsed.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
    return null
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFazendoUpload(true)
    const toastId = toast.loading('A ler planilha Excel...')

    const reader = new FileReader()
    reader.onload = async (evento) => {
      try {
        const data = evento.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })

        toast.loading('A sincronizar bases auxiliares...', { id: toastId })
        const nomeAbaParametros = workbook.SheetNames.find((n) => n.toLowerCase().includes('listbox'))
        if (!nomeAbaParametros) throw new Error('Aba ListBox não encontrada.')

        const abaParametros = workbook.Sheets[nomeAbaParametros]
        const rowsParams: any[] = XLSX.utils.sheet_to_json(abaParametros, { defval: null })
        const unique = (arr: any[]) => Array.from(new Set(arr.filter((x) => x !== null && `${x}`.trim() !== '').map((x) => `${x}`.trim())))

        const setores = unique(rowsParams.map((r) => r['Setor'])).map(nome => ({ nome }))
        const responsaveis = rowsParams.map((r) => {
          const nome = r['Responsável']; const email = r['e-mail']
          if (!nome || !email) return null
          return { nome: `${nome}`.trim(), email: `${email}`.trim() }
        }).filter(Boolean)
        
        const prioridades = rowsParams.map((r) => {
          const nivel = r['Prioridade']; const desc = r['Prioridade_Descrição']
          if (nivel === null || desc === null) return null
          return { nivel: parseNumber(nivel), descricao: `${desc}`.trim() }
        }).filter(Boolean)
        
        const frequencias = unique(rowsParams.map((r) => r['Frequencia'])).map((nome) => ({ nome }))
        const classificacoes = unique(rowsParams.map((r) => r['Classificação'])).map((nome) => ({ nome }))

        if (setores.length) await supabase.from('setores').upsert(setores, { onConflict: 'nome' })
        if (responsaveis.length) await supabase.from('responsaveis').upsert(responsaveis, { onConflict: 'email' })
        if (prioridades.length) await supabase.from('prioridades').upsert(prioridades, { onConflict: 'nivel' })
        if (frequencias.length) await supabase.from('frequencias').upsert(frequencias, { onConflict: 'nome' })
        if (classificacoes.length) await supabase.from('classificacoes').upsert(classificacoes, { onConflict: 'nome' })

        const feriadoCol = rowsParams.length ? Object.keys(rowsParams[0]).find((k) => k.toLowerCase().includes('feriad') && !k.toLowerCase().includes('nome')) : null
        const feriadoNomeCol = rowsParams.length ? Object.keys(rowsParams[0]).find((k) => k.toLowerCase().includes('nome') && k.toLowerCase().includes('feriad')) : null
        
        const feriadosUpsert = rowsParams.map((r) => {
          if (!feriadoCol || !r[feriadoCol]) return null
          const dataStr = formatDateToISO(r[feriadoCol])
          if (!dataStr) return null 
          return { data: dataStr, nome: feriadoNomeCol && r[feriadoNomeCol] ? `${r[feriadoNomeCol]}`.trim() : null }
        }).filter(Boolean)

        if (feriadosUpsert.length) await supabase.from('feriados').upsert(feriadosUpsert, { onConflict: 'data' })

        const { data: dbSetores } = await supabase.from('setores').select('id, nome')
        const { data: dbResponsaveis } = await supabase.from('responsaveis').select('id, nome, email')

        toast.loading('A atualizar Atividades Principais...', { id: toastId })
        const nomeAbaAtividades = workbook.SheetNames.find((n) => n.toLowerCase() === 'lista') || workbook.SheetNames.find((n) => !n.toLowerCase().includes('listbox'))
        if (!nomeAbaAtividades) throw new Error('Aba Lista não encontrada.')

        const abaAtividades = workbook.Sheets[nomeAbaAtividades]
        const rowsAtv: any[] = XLSX.utils.sheet_to_json(abaAtividades, { defval: null, raw: false, dateNF: 'yyyy-mm-dd' })

        const atividadesParaSalvar = rowsAtv.map((linha) => {
          const s = dbSetores?.find((x: any) => x.nome && x.nome.trim() === (linha['Setor'] ? `${linha['Setor']}`.trim() : null))
          const r = dbResponsaveis?.find((x: any) => x.nome && x.nome.trim() === (linha['Responsável'] ? `${linha['Responsável']}`.trim() : null))

          return {
            task_id: linha['Task_ID'] ? `${linha['Task_ID']}`.trim() : crypto.randomUUID(),
            planner_name: linha['Planner Name'] ? `${linha['Planner Name']}`.trim() : null,
            setor_id: s?.id || null,
            nome_atividade: linha['Atividade'] ? `${linha['Atividade']}`.trim() : 'Sem Nome',
            responsavel_id: r?.id || null,
            prioridade_nivel: parseNumber(linha['Prioridade']),
            prioridade_descricao: linha['Prioridade_Descrição'] ? `${linha['Prioridade_Descrição']}`.trim() : null,
            frequencia: linha['Frequencia'] ? `${linha['Frequencia']}`.trim() : null,
            classificacao: linha['Classificação'] ? `${linha['Classificação']}`.trim() : null,
            dia_da_semana: linha['Dia Da Semana'] ? `${linha['Dia Da Semana']}`.trim() : null,
            dia_util: parseNumber(linha['Dia Util'] !== undefined ? linha['Dia Util'] : linha['Dia Útil']),
            status: linha['Status'] ? `${linha['Status']}`.trim() : null,
          }
        })

        // ─── Detecta atividades NOVAS antes do upsert ─────────────────────
        // (são as task_ids do arquivo que ainda não existem no banco)
        const taskIdsArquivo = atividadesParaSalvar.map(a => a.task_id).filter(Boolean)
        let novasAtividades: typeof atividadesParaSalvar = []
        if (taskIdsArquivo.length > 0) {
          const chunkSize = 200
          const existentes = new Set<string>()
          for (let i = 0; i < taskIdsArquivo.length; i += chunkSize) {
            const chunk = taskIdsArquivo.slice(i, i + chunkSize)
            const { data: ex } = await supabase
              .from('atividades').select('task_id').in('task_id', chunk)
            ;(ex || []).forEach((a: any) => existentes.add(a.task_id))
          }
          novasAtividades = atividadesParaSalvar.filter(a => !existentes.has(a.task_id))
        }

        const { error: upsertError } = await supabase.from('atividades').upsert(atividadesParaSalvar, { onConflict: 'task_id' })
        if (upsertError) throw new Error(upsertError.message)

        // ─── Notificações: 1 email por responsável c/ resumo das novas ────
        if (novasAtividades.length > 0 && dbResponsaveis) {
          // Agrupa as novas por responsável (responsavel_id → lista)
          const porResp = new Map<string, typeof novasAtividades>()
          for (const a of novasAtividades) {
            if (!a.responsavel_id) continue
            const key = String(a.responsavel_id)
            if (!porResp.has(key)) porResp.set(key, [])
            porResp.get(key)!.push(a)
          }

          // Pra cada responsável com email, dispara email em background
          for (const [respId, atvs] of porResp) {
            const resp = dbResponsaveis.find((r: any) => String(r.id) === respId)
            if (!resp?.email) continue

            const linhasHtml = atvs.map(a => {
              const freq = a.frequencia ? `<em style="opacity:.7">${a.frequencia}</em>` : ''
              return `<li><strong>${a.nome_atividade}</strong> ${freq ? '· ' + freq : ''}</li>`
            }).join('')

            // Sem await → não bloqueia o fluxo; falhas são log only
            fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: resp.email,
                subject: `[Portal] ${atvs.length} nova(s) atividade(s) atribuída(s) a você`,
                taskName: 'Sincronização de Atividades',
                action: `criadas e atribuídas a você`,
                userName: resp.nome,
                observacoes: `As seguintes atividades foram cadastradas e você é o responsável:<br/><br/><ul>${linhasHtml}</ul><br/>Os cartões vão aparecer no Kanban quando o admin executar a Sincronização Mensal.`,
              }),
            }).catch(err => console.warn('[import] email falhou pra', resp.email, err))
          }
        }

        // ─── Detecta atividades ÓRFÃS (modo espelho) ───────────────────────
        // São atividades base no banco que NÃO vieram nessa planilha. Pergunta
        // se quer apagar pra deixar a base idêntica ao arquivo. Ad Hocs ficam
        // sempre intactas — elas não vivem na planilha.
        const taskIdsArquivoSet = new Set(atividadesParaSalvar.map(a => a.task_id))
        const { data: todasBase } = await supabase
          .from('atividades').select('task_id, nome_atividade, planner_name, responsaveis (nome)')
          .or('planner_name.neq."Ad Hoc",planner_name.is.null')
        const orfas = (todasBase || []).filter((a: any) => !taskIdsArquivoSet.has(a.task_id))

        const totalNovos = novasAtividades.length
        let msg = totalNovos > 0
          ? `Planilha sincronizada! ${totalNovos} nova(s) atividade(s).`
          : 'Planilha sincronizada com sucesso!'
        toast.success(msg, { id: toastId })

        // Se tem órfãs, pergunta se apaga (fora do toast pra não bloquear UI)
        if (orfas.length > 0) {
          const exemplos = orfas.slice(0, 5)
            .map((a: any) => `  • ${a.nome_atividade}${a.responsaveis?.nome ? ` (${a.responsaveis.nome})` : ''}`)
            .join('\n')
          const sufixo = orfas.length > 5 ? `\n  ...e mais ${orfas.length - 5}` : ''

          const confirmar = window.confirm(
            `🪞 MODO ESPELHO — ATIVIDADES ÓRFÃS\n\n` +
            `${orfas.length} atividade(s) da base existem no banco mas NÃO estão nesta planilha:\n\n` +
            `${exemplos}${sufixo}\n\n` +
            `Quer APAGAR essas atividades (e suas tarefas diárias) pra deixar a base idêntica à planilha?\n\n` +
            `[OK] = apagar  |  [Cancelar] = manter`
          )
          if (confirmar) {
            const tid = toast.loading(`A apagar ${orfas.length} atividade(s) órfã(s)...`)
            try {
              const orfasIds = orfas.map((a: any) => a.task_id)
              await deletarCascataPorTaskIds(orfasIds)
              toast.success(`${orfas.length} atividade(s) órfã(s) removida(s)!`, { id: tid })
            } catch {
              toast.error('Erro ao apagar órfãs (base parcialmente espelhada).', { id: tid })
            }
          }
        }

        fetchDados()
      } catch (err: any) {
        toast.error('Erro na importação.', { id: toastId })
      } finally {
        setFazendoUpload(false)
        e.target.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const corPrioridade = (p: string) => {
    const s = p?.toLowerCase() || ''
    if (s.includes('urgente') || s.includes('alta')) return 'bg-[#b43a3d]/10 text-[#b43a3d] dark:bg-[#b43a3d]/20 dark:text-[#f87171]'
    if (s.includes('importante') || s.includes('média')) return 'bg-[#efc486]/30 text-[#063955] dark:bg-amber-500/20 dark:text-amber-300'
    return 'bg-[#0f88a8]/10 text-[#0f88a8] dark:bg-[#0f88a8]/20 dark:text-[#38bdf8]'
  }

  if (loadingAcesso) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors"><div className="animate-pulse text-[#0f88a8] dark:text-[#38bdf8] font-medium">A carregar painel...</div></div>

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 flex flex-col items-center justify-center text-center transition-colors">
        <ShieldAlert size={64} className="text-[#b43a3d] dark:text-[#f87171] mb-4 opacity-80" />
        <h1 className="text-2xl font-bold text-[#063955] dark:text-white">Acesso Restrito</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">Apenas administradores podem aceder à Central de Sincronização.</p>
        <button onClick={() => router.push('/tarefas')} className="mt-6 bg-[#0f88a8] hover:bg-[#0c708b] dark:hover:bg-[#0284c7] text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors">
          Ir para o Kanban
        </button>
      </div>
    )
  }

  const progresso = stats.rotinasAtivas > 0 ? Math.min(100, Math.round((stats.geradasNoMes / stats.rotinasAtivas) * 100)) : 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans transition-colors duration-300">
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#063955', color: '#fff', borderRadius: '12px' } }} />

      <header className="mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div>
          <h1 className="text-2xl font-bold text-[#063955] dark:text-white tracking-tight flex items-center gap-2">
            <RefreshCw className="text-[#0f88a8] dark:text-[#38bdf8]" /> Central de Sincronização
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Automatize o cronograma e mantenha a base do Excel sincronizada.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={exportarParaExcel} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            <Download size={16} /> Exportar
          </button>
          
          <label className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-[#0f88a8] text-[#0f88a8] dark:text-[#38bdf8] hover:bg-[#0f88a8]/5 dark:hover:bg-white/5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors shadow-sm">
            <Upload size={16} /> {fazendoUpload ? 'A ler XLS...' : 'Importar Excel'}
            <input type="file" className="hidden" onChange={handleFileUpload} disabled={fazendoUpload} accept=".xlsx,.xls" />
          </label>
        </div>
      </header>

      {/* DASHBOARD DO ROBÔ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm flex flex-col h-full transition-colors">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#063955] dark:text-white mb-1">Cálculo de Prazos</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Selecione o mês para projetar os novos dias úteis e feriados.</p>
            
            <div className="flex gap-4">
              <select value={mesAlvo} onChange={(e) => setMesAlvo(Number(e.target.value))} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] transition-colors">
                {MESES.map((m) => <option key={m.v} value={m.v}>{m.n}</option>)}
              </select>
              <input type="number" value={anoAlvo} onChange={(e) => setAnoAlvo(Number(e.target.value))} className="w-32 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-[#0f88a8] transition-colors" />
            </div>
          </div>

          <div className="mt-auto bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors">
            <h3 className="text-sm font-bold text-[#063955] dark:text-white mb-2 flex items-center gap-2">
              <ShieldAlert size={16} className="text-[#efc486] dark:text-amber-400" /> Motor Inteligente
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              O sistema utiliza as suas regras cruzadas com a tabela de feriados do banco para gerar os cartões no Kanban.<br/><br/>
              <strong>Proteção Anti-Atraso Ativa:</strong> As tarefas agendadas para dias anteriores ao dia de hoje não são geradas para não entrarem em atraso imediato.
            </p>
          </div>

          <button onClick={gerarCicloDoMes} disabled={gerandoCiclo || fazendoUpload || atividades.length === 0} className="mt-6 w-full flex items-center justify-center gap-2 bg-[#063955] dark:bg-[#38bdf8] hover:bg-[#042436] dark:hover:bg-[#0284c7] text-white dark:text-slate-950 font-semibold py-4 rounded-xl shadow-md transition-all disabled:opacity-50">
            {gerandoCiclo ? <span className="animate-pulse">A calcular rotinas...</span> : <><Play size={18} className="text-[#efc486] dark:text-slate-950" /> Executar Sincronização Mensal</>}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center transition-colors">
          <div className="w-48 h-48 relative mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-slate-100 dark:text-slate-800" strokeWidth="3" stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className={`transition-all duration-1000 ease-out ${progresso >= 100 ? 'text-[#2d6943] dark:text-[#4ade80]' : 'text-[#0f88a8] dark:text-[#38bdf8]'}`} strokeWidth="3" strokeDasharray={`${progresso}, 100`} stroke="currentColor" fill="none" strokeLinecap="round" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-light text-[#063955] dark:text-white">{progresso}%</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest mt-1">Lançado</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-[#063955] dark:text-white">{progresso >= 100 ? 'Cronograma Fechado!' : 'Aguardando Geração'}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">Para <strong>{MESES[mesAlvo].n} de {anoAlvo}</strong>.</p>
          <div className="flex gap-4 w-full">
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center transition-colors"><span className="block text-2xl font-bold text-[#063955] dark:text-white mb-1">{stats.rotinasAtivas}</span><span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Base</span></div>
            <div className="flex-1 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-center transition-colors"><span className={`block text-2xl font-bold mb-1 ${stats.geradasNoMes >= stats.rotinasAtivas ? 'text-[#2d6943] dark:text-[#4ade80]' : 'text-[#0f88a8] dark:text-[#38bdf8]'}`}>{stats.geradasNoMes}</span><span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Geradas</span></div>
          </div>
        </div>
      </div>

      {/* ZONA DE PERIGO */}
      <div className="mb-8 p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
        <div>
          <h3 className="text-base font-bold text-[#063955] dark:text-white">Manutenção de Dados (Zona de Perigo)</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Limpe o banco em caso de erro na importação da planilha ou acúmulo de Ad Hocs antigos.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={limparAdHoc} disabled={fazendoUpload} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-[#efc486] dark:border-amber-500/50 text-[#063955] dark:text-amber-400 hover:bg-[#efc486]/20 dark:hover:bg-amber-500/10 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50">
            <Trash2 size={16} className="text-[#efc486] dark:text-amber-400" /> Limpar Ad Hocs
          </button>
          <button
            onClick={() => { setRespDelOpen(true); setRespDelId(''); setRespDelEscopo('todas'); setRespDelPreview(null) }}
            disabled={fazendoUpload}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-[#0f88a8] dark:border-[#38bdf8]/50 text-[#0f88a8] dark:text-[#38bdf8] hover:bg-[#0f88a8]/10 dark:hover:bg-[#38bdf8]/10 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <UserX size={16} /> Apagar por Responsável
          </button>
          <button
            onClick={() => { setBaseDelOpen(true); setBaseDelMes(-1); setBaseDelPreview(null); carregarPreviewBaseDel(-1, baseDelAno) }}
            disabled={fazendoUpload}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-[#b43a3d] dark:border-[#f87171]/50 text-[#b43a3d] dark:text-[#f87171] hover:bg-[#b43a3d]/10 dark:hover:bg-[#f87171]/10 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Trash2 size={16} /> Apagar Base Sincronizada
          </button>
        </div>
      </div>

      {/* TABELA DE VISUALIZAÇÃO */}
      <main className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center transition-colors">
          <span className="text-sm font-semibold text-[#063955] dark:text-white">Dicionário de Atividades ({atividades.length})</span>
        </div>
        <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 shadow-sm z-10 transition-colors">
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">
                <th className="p-4 font-semibold">Rotina Matriz</th>
                <th className="p-4 font-semibold">Setor</th>
                <th className="p-4 font-semibold">Responsável</th>
                <th className="p-4 font-semibold">Frequência</th>
                <th className="p-4 font-semibold">Regra de Prazo</th>
                <th className="p-4 font-semibold">Prioridade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {atividades.map((t, i) => (
                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm">
                  <td className="p-4 font-medium text-slate-800 dark:text-white flex flex-col">
                    <span>{t.nome_atividade}</span>
                    {t.classificacao && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase mt-0.5">{t.classificacao}</span>}
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{t.setores?.nome || '—'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{t.responsaveis?.nome || '—'}</td>
                  <td className="p-4"><span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-300">{t.frequencia}</span></td>
                  <td className="p-4 text-[#0f88a8] dark:text-[#38bdf8] font-bold">
                    {t.dia_da_semana ? `Toda ${t.dia_da_semana}` : (t.dia_util ? `${t.dia_util}º Dia Útil` : 'Padrão')}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] tracking-wide uppercase font-bold ${corPrioridade(t.prioridade_descricao)}`}>
                      {t.prioridade_descricao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {carregandoDados && <div className="p-12 text-center text-[#0f88a8] dark:text-[#38bdf8] font-medium animate-pulse">A decodificar regras da base de dados...</div>}
          {!carregandoDados && atividades.length === 0 && <div className="p-12 text-center text-slate-500 dark:text-slate-400">Nenhuma atividade base cadastrada. Sincronize um ficheiro Excel.</div>}
        </div>
      </main>

      {/* MODAL: Apagar por Responsável */}
      {respDelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => !respDelSaving && setRespDelOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <span className="text-xs text-[#b43a3d] dark:text-[#f87171] font-semibold tracking-wide uppercase">Zona de Perigo</span>
                <h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1 flex items-center gap-2">
                  <UserX size={20} /> Apagar atividades por responsável
                </h2>
              </div>
              <button
                onClick={() => !respDelSaving && setRespDelOpen(false)}
                disabled={respDelSaving}
                className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Selecione um responsável. Vou apagar todas as <strong>rotinas matrizes</strong> dele,
                junto com as <strong>tarefas diárias</strong> geradas e seus <strong>comentários</strong>.
                Atividades onde a pessoa aparece junto com outros responsáveis também serão removidas integralmente.
              </p>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Responsável
                </label>
                <select
                  value={respDelId}
                  onChange={(e) => {
                    setRespDelId(e.target.value)
                    if (e.target.value) carregarPreviewExclusaoResp(e.target.value, respDelEscopo, respDelMes, respDelAno)
                    else setRespDelPreview(null)
                  }}
                  disabled={respDelSaving}
                  className="w-full bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-3 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                >
                  <option value="" className="dark:bg-slate-900">— Selecione —</option>
                  {respsLista.map(r => (
                    <option key={r.id} value={r.id} className="dark:bg-slate-900">
                      {r.nome}{r.email ? ` (${r.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Escopo: todas / só Ad Hoc / só Base sincronizada */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-2">
                  Escopo da exclusão
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'todas', label: 'Todas',           desc: 'Ad Hoc + Base' },
                    { v: 'adhoc', label: 'Só Ad Hoc',       desc: 'Tarefas pontuais' },
                    { v: 'base',  label: 'Só Base',         desc: 'Rotinas sincronizadas' },
                  ] as { v: EscopoDel; label: string; desc: string }[]).map(opt => (
                    <button
                      key={opt.v}
                      type="button"
                      disabled={respDelSaving}
                      onClick={() => {
                        setRespDelEscopo(opt.v)
                        if (respDelId) carregarPreviewExclusaoResp(respDelId, opt.v, respDelMes, respDelAno)
                      }}
                      className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                        respDelEscopo === opt.v
                          ? 'border-[#0f88a8] bg-[#0f88a8]/10 dark:bg-[#38bdf8]/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className={`text-sm font-semibold ${respDelEscopo === opt.v ? 'text-[#0f88a8] dark:text-[#38bdf8]' : 'text-slate-700 dark:text-slate-200'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mês / Ano (opcional) */}
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-2">
                  Filtrar por mês <span className="text-slate-400">(opcional — sem filtro apaga matriz inteira)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={respDelMes}
                    onChange={(e) => {
                      const m = Number(e.target.value)
                      setRespDelMes(m)
                      if (respDelId) carregarPreviewExclusaoResp(respDelId, respDelEscopo, m, respDelAno)
                    }}
                    disabled={respDelSaving}
                    className="flex-1 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  >
                    <option value={-1} className="dark:bg-slate-900">Todos os meses (apaga matriz)</option>
                    {MESES.map(m => <option key={m.v} value={m.v} className="dark:bg-slate-900">{m.n}</option>)}
                  </select>
                  <input
                    type="number"
                    value={respDelAno}
                    onChange={(e) => {
                      const a = Number(e.target.value)
                      setRespDelAno(a)
                      if (respDelId && respDelMes >= 0) carregarPreviewExclusaoResp(respDelId, respDelEscopo, respDelMes, a)
                    }}
                    disabled={respDelSaving || respDelMes < 0}
                    className="w-24 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  />
                </div>
                {respDelMes >= 0 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5">
                    🛡️ Modo seguro: apaga só as tarefas de {MESES[respDelMes].n}/{respDelAno}. Rotinas matrizes ficam preservadas pros outros meses.
                  </p>
                )}
              </div>

              {respDelId && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                  {respDelLoading ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">A calcular impacto...</div>
                  ) : respDelPreview ? (
                    respDelPreview.tarefas === 0 && respDelPreview.atividades === 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        Nada a apagar nesse recorte.
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <div className="text-slate-700 dark:text-slate-200">Serão apagadas:</div>
                        {respDelPreview.atividades > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="bg-[#b43a3d] text-white font-bold text-xs px-2 py-0.5 rounded">{respDelPreview.atividades}</span>
                            <span className="text-slate-600 dark:text-slate-300">rotina(s) matriz</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="bg-[#b43a3d] text-white font-bold text-xs px-2 py-0.5 rounded">{respDelPreview.tarefas}</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            tarefa(s) diária(s) + comentários{respDelMes >= 0 ? ` de ${MESES[respDelMes].n}/${respDelAno}` : ''}
                          </span>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setRespDelOpen(false)}
                disabled={respDelSaving}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={apagarPorResponsavel}
                disabled={respDelSaving || !respDelId || !respDelPreview || (respDelPreview.atividades === 0 && respDelPreview.tarefas === 0)}
                className="bg-[#b43a3d] hover:bg-[#9a2f31] text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {respDelSaving ? 'A apagar...' : 'Apagar Atividades'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Apagar Base Sincronizada (com filtro de mês) */}
      {baseDelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-[#031D2D]/60 dark:bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => !baseDelSaving && setBaseDelOpen(false)}
          />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <span className="text-xs text-[#b43a3d] dark:text-[#f87171] font-semibold tracking-wide uppercase">Zona de Perigo</span>
                <h2 className="text-xl text-slate-900 dark:text-white font-semibold mt-1 flex items-center gap-2">
                  <Trash2 size={20} /> Apagar Base Sincronizada
                </h2>
              </div>
              <button onClick={() => !baseDelSaving && setBaseDelOpen(false)} disabled={baseDelSaving} className="text-slate-400 hover:text-[#063955] dark:hover:text-white p-2 disabled:opacity-50">✕</button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Apaga as rotinas matrizes (não-Ad Hoc) ou apenas as tarefas geradas em um mês específico.
                Tarefas Ad Hoc <strong>nunca</strong> são afetadas por essa ação.
              </p>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-2">
                  Filtrar por mês <span className="text-slate-400">(opcional)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={baseDelMes}
                    onChange={(e) => {
                      const m = Number(e.target.value)
                      setBaseDelMes(m)
                      carregarPreviewBaseDel(m, baseDelAno)
                    }}
                    disabled={baseDelSaving}
                    className="flex-1 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  >
                    <option value={-1} className="dark:bg-slate-900">Todos os meses (apaga matriz)</option>
                    {MESES.map(m => <option key={m.v} value={m.v} className="dark:bg-slate-900">{m.n}</option>)}
                  </select>
                  <input
                    type="number"
                    value={baseDelAno}
                    onChange={(e) => {
                      const a = Number(e.target.value)
                      setBaseDelAno(a)
                      if (baseDelMes >= 0) carregarPreviewBaseDel(baseDelMes, a)
                    }}
                    disabled={baseDelSaving || baseDelMes < 0}
                    className="w-24 bg-transparent border border-slate-200 dark:border-slate-800 dark:text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#0f88a8] disabled:opacity-50"
                  />
                </div>
                {baseDelMes >= 0 && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1.5">
                    🛡️ Modo seguro: apaga só os cartões do Kanban de {MESES[baseDelMes].n}/{baseDelAno}. As rotinas ficam preservadas.
                  </p>
                )}
                {baseDelMes < 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1.5">
                    ⚠️ Modo destrutivo: apaga TODAS as rotinas base + cartões. Você precisará reimportar a planilha pra recriar.
                  </p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                {baseDelLoading ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">A calcular impacto...</div>
                ) : baseDelPreview ? (
                  baseDelPreview.tarefas === 0 && baseDelPreview.atividades === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">Nada a apagar nesse recorte.</div>
                  ) : (
                    <div className="space-y-1 text-sm">
                      <div className="text-slate-700 dark:text-slate-200">Serão apagadas:</div>
                      {baseDelPreview.atividades > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="bg-[#b43a3d] text-white font-bold text-xs px-2 py-0.5 rounded">{baseDelPreview.atividades}</span>
                          <span className="text-slate-600 dark:text-slate-300">rotina(s) matriz</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="bg-[#b43a3d] text-white font-bold text-xs px-2 py-0.5 rounded">{baseDelPreview.tarefas}</span>
                        <span className="text-slate-600 dark:text-slate-300">
                          tarefa(s) diária(s) + comentários{baseDelMes >= 0 ? ` de ${MESES[baseDelMes].n}/${baseDelAno}` : ''}
                        </span>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-950">
              <button
                onClick={() => setBaseDelOpen(false)}
                disabled={baseDelSaving}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={apagarBaseComMes}
                disabled={baseDelSaving || !baseDelPreview || (baseDelPreview.atividades === 0 && baseDelPreview.tarefas === 0)}
                className="bg-[#b43a3d] hover:bg-[#9a2f31] text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
              >
                {baseDelSaving ? 'A apagar...' : 'Apagar Base'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}