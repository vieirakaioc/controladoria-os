'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const MESES = [
  { v: 0, n: 'Jan' }, { v: 1, n: 'Fev' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Abr' },
  { v: 4, n: 'Mai' }, { v: 5, n: 'Jun' }, { v: 6, n: 'Jul' }, { v: 7, n: 'Ago' },
  { v: 8, n: 'Set' }, { v: 9, n: 'Out' }, { v: 10, n: 'Nov' }, { v: 11, n: 'Dez' },
]

export default function Home() {
  const [atividades, setAtividades] = useState<any[]>([])
  const [feriados, setFeriados] = useState<string[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [gerandoCiclo, setGerandoCiclo] = useState(false)

  const [mensagemStatus, setMensagemStatus] = useState('')
  const [fazendoUpload, setFazendoUpload] = useState(false)

  const hoje = new Date()
  const [mesAlvo, setMesAlvo] = useState<number>(hoje.getMonth())
  const [anoAlvo, setAnoAlvo] = useState<number>(hoje.getFullYear())

  useEffect(() => {
    fetchDados()
  }, [])

  const logSupabaseError = (titulo: string, err: any) => {
    console.error(titulo, err)
    console.dir(err, { depth: 10 })
  }

  const fetchDados = async () => {
    setCarregandoDados(true)
    try {
      const { data: dbFeriados, error: errFeriados } = await supabase.from('feriados').select('data')
      if (errFeriados) throw errFeriados
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
      setMensagemStatus('')
    } catch (error: any) {
      logSupabaseError('Erro ao buscar dados:', error)
      setMensagemStatus('❌ Erro ao buscar dados (veja console).')
    } finally {
      setCarregandoDados(false)
    }
  }

  // ==========================================
  // MOTOR DE CÁLCULO DE DATAS E FORMATAÇÃO
  // ==========================================
  const calcularDataVencimento = (regra: any, mes: number, ano: number) => {
    if (regra.dia_da_semana) {
      const mapaDias: { [key: string]: number } = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }
      const chave = String(regra.dia_da_semana).toLowerCase().substring(0, 3)
      const diaAlvoSemana = mapaDias[chave]
      if (diaAlvoSemana === undefined) return null

      let data = new Date(ano, mes, 1)
      while (data.getDay() !== diaAlvoSemana) data.setDate(data.getDate() + 1)
      return data.toISOString().split('T')[0]
    }

    if (regra.dia_util) {
      let diasUteisContados = 0
      for (let d = 1; d <= 31; d++) {
        const dataTeste = new Date(ano, mes, d)
        if (dataTeste.getMonth() !== mes) break

        const fds = dataTeste.getDay() === 0 || dataTeste.getDay() === 6
        const fmt = dataTeste.toISOString().split('T')[0]
        const feriado = feriados.includes(fmt)

        if (!fds && !feriado) {
          diasUteisContados++
          if (diasUteisContados === Number(regra.dia_util)) return fmt
        }
      }
    }
    return null
  }

  const mesesParaFrequencia = (freqRaw: string) => {
    const freq = (freqRaw || '').toLowerCase()
    if (freq === 'mensal' || freq === 'diária' || freq === 'semanal') return 'todo_mes'
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
    setGerandoCiclo(true)
    setMensagemStatus(`Gerando ciclo: ${MESES.find(m => m.v === mesAlvo)?.n}/${anoAlvo}...`)

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
            const fmt = dt.toISOString().split('T')[0]
            if (!fds && !feriados.includes(fmt)) {
              cardsParaUpsert.push({ atividade_id: regra.task_id, data_vencimento: fmt, status: 'Pendente' })
            }
          }
        } else {
          const dataVenc = calcularDataVencimento(regra, mesAlvo, anoAlvo)
          if (dataVenc) {
            cardsParaUpsert.push({ atividade_id: regra.task_id, data_vencimento: dataVenc, status: 'Pendente' })
          }
        }
      })

      const { error } = await supabase.from('tarefas_diarias').upsert(cardsParaUpsert, { onConflict: 'atividade_id,data_vencimento' })

      if (error) throw error
      setMensagemStatus(`✅ Sucesso! ${cardsParaUpsert.length} cartões processados.`)
    } catch (err: any) {
      setMensagemStatus('❌ Erro ao gerar: ' + err.message)
    } finally {
      setGerandoCiclo(false)
      setTimeout(() => setMensagemStatus(''), 5000)
    }
  }

  const apagarPorPlanner = async (isAdHoc: boolean) => {
    let query = supabase.from('atividades').select('task_id')
    
    if (isAdHoc) {
      query = query.eq('planner_name', 'Ad Hoc')
    } else {
      query = query.or('planner_name.neq."Ad Hoc",planner_name.is.null')
    }

    const { data: atvData, error: atvError } = await query

    if (atvError) throw atvError
    const taskIds = (atvData || []).map(a => a.task_id)
    if (taskIds.length === 0) return

    const chunkSize = 150
    let dailyIds: string[] = []

    for (let i = 0; i < taskIds.length; i += chunkSize) {
      const chunk = taskIds.slice(i, i + chunkSize)
      const { data: tdData } = await supabase.from('tarefas_diarias').select('id').in('atividade_id', chunk)
      if (tdData) dailyIds = dailyIds.concat(tdData.map(d => d.id))
    }

    for (let i = 0; i < dailyIds.length; i += chunkSize) {
      await supabase.from('tarefa_comentarios').delete().in('tarefa_id', dailyIds.slice(i, i + chunkSize))
    }

    for (let i = 0; i < taskIds.length; i += chunkSize) {
      await supabase.from('tarefas_diarias').delete().in('atividade_id', taskIds.slice(i, i + chunkSize))
    }

    for (let i = 0; i < taskIds.length; i += chunkSize) {
      await supabase.from('atividades').delete().in('task_id', taskIds.slice(i, i + chunkSize))
    }
  }

  const limparPlanilhaSincronizada = async () => {
    const msg = "⚠️ ATENÇÃO: Isso apagará todas as atividades da planilha base.\n\nAs tarefas 'Ad Hoc' serão MANTIDAS.\nDeseja continuar?"
    if (!window.confirm(msg)) return
    if (window.prompt('Digite APAGAR para confirmar:') !== 'APAGAR') {
      alert('Operação cancelada.')
      return
    }

    setFazendoUpload(true)
    setMensagemStatus('Limpando planilha base...')
    try {
      await apagarPorPlanner(false)
      setMensagemStatus('✅ Planilha base limpa com sucesso!')
      fetchDados()
    } catch(e: any) {
      setMensagemStatus('❌ Erro ao limpar base: ' + e.message)
    } finally {
      setFazendoUpload(false)
      setTimeout(() => setMensagemStatus(''), 5000)
    }
  }

  const limparAdHoc = async () => {
    const msg = "⚠️ ATENÇÃO: Isso apagará TODAS as tarefas criadas via botão 'Ad Hoc'.\nAs tarefas da planilha base serão MANTIDAS.\nDeseja continuar?"
    if (!window.confirm(msg)) return

    setFazendoUpload(true)
    setMensagemStatus('Limpando tarefas Ad Hoc...')
    try {
      await apagarPorPlanner(true)
      setMensagemStatus('✅ Tarefas Ad Hoc limpas com sucesso!')
      fetchDados()
    } catch(e: any) {
      setMensagemStatus('❌ Erro ao limpar Ad Hoc: ' + e.message)
    } finally {
      setFazendoUpload(false)
      setTimeout(() => setMensagemStatus(''), 5000)
    }
  }

  const exportarParaExcel = () => {
    const dadosExportacao = atividades.map((t) => ({
      Task_ID: t.task_id,
      'Planner Name': t.planner_name || '',
      Setor: t.setores?.nome || '',
      Atividade: t.nome_atividade || '',
      Responsável: t.responsaveis?.nome || '',
      Prioridade: t.prioridade_nivel || '',
      'Prioridade_Descrição': t.prioridade_descricao || '',
      Frequencia: t.frequencia || '',
      Classificação: t.classificacao || '',
      'Dia Da Semana': t.dia_da_semana || '',
      'Dia Útil': t.dia_util || '',
    }))
    const worksheet = XLSX.utils.json_to_sheet(dadosExportacao)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lista')
    XLSX.writeFile(workbook, `Exportacao_Tarefas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`)
  }

  // ==========================================
  // FUNÇÕES AUXILIARES DE FORMATAÇÃO
  // ==========================================
  const parseNumber = (val: any) => {
    if (val == null || val === '') return null
    const n = Number(val)
    return isNaN(n) ? null : n
  }

  // ✅ Essa é a função mágica que resolve o erro do Excel "Thu Jan 01"
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
      // Se já for YYYY-MM-DD
      if (str.match(/^\d{4}-\d{2}-\d{2}/)) return str.substring(0, 10)
      
      // Se o usuário digitou DD/MM/YYYY
      const brDate = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
      if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`
      
      // Tenta parse JS nativo (para o "Thu Jan 01")
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
    setMensagemStatus('Lendo planilha...')

    const reader = new FileReader()
    reader.onload = async (evento) => {
      try {
        const data = evento.target?.result
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true })

        setMensagemStatus('Sincronizando ListBox...')
        const nomeAbaParametros = workbook.SheetNames.find((n) => n.toLowerCase().includes('listbox'))
        if (!nomeAbaParametros) throw new Error('Não achei a aba ListBox na planilha.')

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

        if (setores.length) {
          const { error } = await supabase.from('setores').upsert(setores, { onConflict: 'nome' })
          if (error) throw new Error(`Setores: ${error.message}`)
        }
        if (responsaveis.length) {
          const { error } = await supabase.from('responsaveis').upsert(responsaveis, { onConflict: 'email' })
          if (error) throw new Error(`Responsáveis: ${error.message}`)
        }
        if (prioridades.length) {
          const { error } = await supabase.from('prioridades').upsert(prioridades, { onConflict: 'nivel' })
          if (error) throw new Error(`Prioridades: ${error.message}`)
        }
        if (frequencias.length) {
          const { error } = await supabase.from('frequencias').upsert(frequencias, { onConflict: 'nome' })
          if (error) throw new Error(`Frequências: ${error.message}`)
        }
        if (classificacoes.length) {
          const { error } = await supabase.from('classificacoes').upsert(classificacoes, { onConflict: 'nome' })
          if (error) throw new Error(`Classificações: ${error.message}`)
        }

        // Feriados (Com a correção de Data!)
        const feriadoCol = rowsParams.length ? Object.keys(rowsParams[0]).find((k) => k.toLowerCase().includes('feriad') && !k.toLowerCase().includes('nome')) : null
        const feriadoNomeCol = rowsParams.length ? Object.keys(rowsParams[0]).find((k) => k.toLowerCase().includes('nome') && k.toLowerCase().includes('feriad')) : null
        
        const feriadosUpsert = rowsParams.map((r) => {
          if (!feriadoCol || !r[feriadoCol]) return null
          const dataStr = formatDateToISO(r[feriadoCol]) // APLICANDO A CORREÇÃO AQUI
          if (!dataStr) return null 
          return { data: dataStr, nome: feriadoNomeCol && r[feriadoNomeCol] ? `${r[feriadoNomeCol]}`.trim() : null }
        }).filter(Boolean)

        if (feriadosUpsert.length) {
          const { error } = await supabase.from('feriados').upsert(feriadosUpsert, { onConflict: 'data' })
          if (error) throw new Error(`Erro ao salvar Feriados: ${error.message}`)
        }

        const { data: dbSetores } = await supabase.from('setores').select('id, nome')
        const { data: dbResponsaveis } = await supabase.from('responsaveis').select('id, nome, email')

        setMensagemStatus('Sincronizando Atividades Principais...')
        const nomeAbaAtividades = workbook.SheetNames.find((n) => n.toLowerCase() === 'lista') || workbook.SheetNames.find((n) => !n.toLowerCase().includes('listbox'))
        if (!nomeAbaAtividades) throw new Error('Não achei a aba Lista/Base.')

        const abaAtividades = workbook.Sheets[nomeAbaAtividades]
        const rowsAtv: any[] = XLSX.utils.sheet_to_json(abaAtividades, { defval: null, raw: false, dateNF: 'yyyy-mm-dd' })

        const atividadesParaSalvar = rowsAtv.map((linha) => {
          const setorNome = linha['Setor'] ? `${linha['Setor']}`.trim() : null
          const respNome = linha['Responsável'] ? `${linha['Responsável']}`.trim() : null

          const s = dbSetores?.find((x: any) => x.nome && x.nome.trim() === setorNome)
          const r = dbResponsaveis?.find((x: any) => x.nome && x.nome.trim() === respNome)

          const diaUtil = linha['Dia Util'] !== undefined ? linha['Dia Util'] : linha['Dia Útil']
          const taskId = linha['Task_ID'] ? `${linha['Task_ID']}`.trim() : crypto.randomUUID()

          return {
            task_id: taskId,
            planner_name: linha['Planner Name'] ? `${linha['Planner Name']}`.trim() : null,
            setor_id: s?.id || null,
            nome_atividade: linha['Atividade'] ? `${linha['Atividade']}`.trim() : 'Sem Nome',
            responsavel_id: r?.id || null,
            prioridade_nivel: parseNumber(linha['Prioridade']),
            prioridade_descricao: linha['Prioridade_Descrição'] ? `${linha['Prioridade_Descrição']}`.trim() : null,
            frequencia: linha['Frequencia'] ? `${linha['Frequencia']}`.trim() : null,
            classificacao: linha['Classificação'] ? `${linha['Classificação']}`.trim() : null,
            dia_da_semana: linha['Dia Da Semana'] ? `${linha['Dia Da Semana']}`.trim() : null,
            dia_util: parseNumber(diaUtil),
            status: linha['Status'] ? `${linha['Status']}`.trim() : null,
            // Formatando possíveis datas residuais caso existam colunas de data na aba Lista
            data_inicial: formatDateToISO(linha['Data Inicial']),
            data_fim: formatDateToISO(linha['Data Fim']),
            data_conclusao: formatDateToISO(linha['Data Conclusão'])
          }
        })

        const { error: upsertError } = await supabase.from('atividades').upsert(atividadesParaSalvar, { onConflict: 'task_id' })
        
        if (upsertError) {
          throw new Error(`Erro do Supabase: ${upsertError.message}`)
        }

        setMensagemStatus('✅ Planilha sincronizada com sucesso!')
        fetchDados()
      } catch (err: any) {
        console.error("Falha no processo de importação:", err)
        setMensagemStatus('❌ Erro: ' + err.message)
      } finally {
        setFazendoUpload(false)
        e.target.value = '' // Libera o input
      }
    }
    reader.readAsBinaryString(file)
  }

  const corPrioridade = (p: string) => {
    const s = p?.toLowerCase() || ''
    if (s.includes('urgente')) return 'bg-red-100 text-red-800'
    if (s.includes('importante')) return 'bg-amber-100 text-amber-800'
    return 'bg-blue-100 text-blue-800'
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Setup de Atividades</h1>
          <p className="text-slate-500 text-sm mt-1">
            Gere o ciclo para {MESES.find(m => m.v === mesAlvo)?.n}/{anoAlvo} ou sincronize atualizações
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {mensagemStatus && <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg animate-pulse">{mensagemStatus}</span>}

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
            value={mesAlvo}
            onChange={(e) => setMesAlvo(Number(e.target.value))}
          >
            {MESES.map((m) => (
              <option key={m.v} value={m.v}>{m.n}</option>
            ))}
          </select>

          <input
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 w-24 outline-none focus:border-indigo-400"
            type="number"
            value={anoAlvo}
            onChange={(e) => setAnoAlvo(Number(e.target.value))}
          />

          <button
            onClick={gerarCicloDoMes}
            disabled={gerandoCiclo || fazendoUpload}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-5 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {gerandoCiclo ? 'Processando...' : '⚡ Gerar Ciclo'}
          </button>

          <label className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-sm font-medium py-2 px-5 rounded-xl cursor-pointer transition-all shadow-sm">
            ↑ Sincronizar XLS
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      {/* Painel Administrativo de Limpeza */}
      <div className="mb-8 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
         <div>
            <h3 className="text-sm font-semibold text-slate-800">Manutenção de Dados</h3>
            <p className="text-xs text-slate-500 mt-1">Limpe o banco em caso de erro na planilha ou acúmulo de Ad Hocs.</p>
         </div>
         <div className="flex gap-3">
            <button 
              onClick={limparAdHoc} 
              disabled={fazendoUpload}
              className="bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-medium py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              Excluir Apenas Ad Hocs
            </button>

            <button 
              onClick={limparPlanilhaSincronizada} 
              disabled={fazendoUpload}
              className="bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium py-2 px-4 rounded-xl transition-colors disabled:opacity-50"
            >
              Excluir Planilha Sincronizada
            </button>
         </div>
      </div>

      <main className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                <th className="p-5 font-medium">Rotina Matriz</th>
                <th className="p-5 font-medium">Setor</th>
                <th className="p-5 font-medium">Responsável</th>
                <th className="p-5 font-medium">Frequência</th>
                <th className="p-5 font-medium">Regra Prazo</th>
                <th className="p-5 font-medium">Prioridade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atividades.map((t, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors text-sm">
                  <td className="p-5 font-medium text-slate-800">{t.nome_atividade}</td>
                  <td className="p-5 text-slate-500">{t.setores?.nome || ''}</td>
                  <td className="p-5 text-slate-600">{t.responsaveis?.nome || ''}</td>
                  <td className="p-5"><span className="bg-slate-100 px-2 py-1 rounded text-xs text-slate-600">{t.frequencia}</span></td>
                  <td className="p-5 text-indigo-600 font-medium">
                    {t.dia_da_semana ? `Toda ${t.dia_da_semana}` : `${t.dia_util}º Dia Útil`}
                  </td>
                  <td className="p-5">
                    <span className={`px-2 py-1 rounded-md text-[10px] tracking-wide uppercase font-medium ${corPrioridade(t.prioridade_descricao)}`}>
                      {t.prioridade_descricao}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {carregandoDados && (
            <div className="p-6 text-center text-slate-500 text-sm">Carregando dados...</div>
          )}
          {!carregandoDados && atividades.length === 0 && (
             <div className="p-8 text-center text-slate-500 text-sm">Nenhuma atividade base cadastrada.</div>
          )}
        </div>
      </main>
    </div>
  )
}