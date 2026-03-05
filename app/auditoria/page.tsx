'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Download } from 'lucide-react'

type Log = {
  id: string
  acao: string
  dados_antigos: any
  data_hora: string
  profiles?: { full_name: string }
}

export default function AuditoriaPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      // Bloqueia quem não for admin logo à entrada
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
      
      if (prof?.role !== 'admin') {
        router.push('/tarefas')
        return
      }

      // Traz os últimos 100 movimentos
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, acao, dados_antigos, data_hora, profiles!auditoria_usuario_id_fkey(full_name)')
        .order('data_hora', { ascending: false })
        .limit(100)

      if (!error && data) setLogs(data as any)
      setLoading(false)
    }

    fetchLogs()
  }, [router])

  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Função que gera e faz download do CSV compatível com o Excel (separador ponto-e-vírgula)
  const exportarParaCSV = () => {
    if (logs.length === 0) return

    const cabecalho = ['Data e Hora', 'Utilizador', 'Ação', 'ID da Tarefa/Registo']
    
    const linhas = logs.map(log => [
      formatDate(log.data_hora),
      log.profiles?.full_name || 'Desconhecido',
      log.acao,
      log.dados_antigos?.atividade_id || log.dados_antigos?.id || log.id || 'N/A'
    ])

    const csvContent = [
      cabecalho.join(';'),
      ...linhas.map(row => row.map(v => `"${v}"`).join(';'))
    ].join('\n')

    // Adiciona o BOM (\uFEFF) para garantir que o Excel lê os acentos (UTF-8) corretamente
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Auditoria_Controladoria_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Trilha de Auditoria (Logs)</h1>
          <p className="text-slate-500 text-sm mt-1">Histórico de exclusões e edições críticas do sistema</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportarParaCSV}
            disabled={logs.length === 0 || loading}
            className="flex items-center gap-2 bg-[#0f88a8] hover:bg-[#0f88a8]/90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
          >
            <Download size={16} />
            Exportar CSV
          </button>

          <div className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold tracking-wide uppercase shadow-sm">
            Acesso Restrito
          </div>
        </div>
      </header>

      <main className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 font-medium">A encriptar e a carregar logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[#818284] uppercase text-xs tracking-wider">
                  <th className="p-5 font-semibold">Data / Hora</th>
                  <th className="p-5 font-semibold">Utilizador</th>
                  <th className="p-5 font-semibold">Ação Executada</th>
                  <th className="p-5 font-semibold">Detalhe (ID da Tarefa)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors text-sm">
                    <td className="p-5 text-slate-600 font-medium whitespace-nowrap">{formatDate(log.data_hora)}</td>
                    <td className="p-5 font-semibold text-slate-800">{log.profiles?.full_name || 'Desconhecido'}</td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-md text-[10px] tracking-wide uppercase font-bold ${log.acao === 'DELETE' ? 'bg-[#b43a3d]/10 text-[#b43a3d]' : 'bg-[#efc486]/30 text-amber-800'}`}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="p-5 text-slate-500 font-mono text-xs">
                      {log.dados_antigos?.atividade_id || log.dados_antigos?.id || 'N/A'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">Nenhuma ação crítica registada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}