'use client'

import { useRef, useState } from 'react'
import { Download, Loader2, Paperclip, Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { baixarAnexo, enviarAnexo, listarAnexos, removerAnexo, type AnexoProjeto } from '../_lib/anexos'

type Props = { projetoId: string; isAdmin: boolean; disabled: boolean; onBusyChange: (busy: boolean) => void }

export default function AnexosProjeto({ projetoId, isAdmin, disabled, onBusyChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const [anexos, setAnexos] = useState<AnexoProjeto[]>([])
  const [carregando, setCarregando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)

  const carregar = async () => {
    setCarregando(true)
    setErro('')
    try { setAnexos(await listarAnexos(projetoId)) }
    catch { setErro('Não foi possível carregar os anexos. Tente novamente ou verifique a configuração de armazenamento.') }
    finally { setCarregando(false) }
  }

  const executar = async (acao: () => Promise<void>) => {
    if (lock.current || disabled) return
    lock.current = true
    setOcupado(true)
    onBusyChange(true)
    try { await acao() }
    finally { lock.current = false; setOcupado(false); onBusyChange(false) }
  }

  const enviar = async (arquivos: File[]) => executar(async () => {
    let enviados = 0
    for (const arquivo of arquivos) {
      try { await enviarAnexo(projetoId, arquivo); enviados++ }
      catch (error) {
        toast.error(`${arquivo.name}: ${error instanceof Error ? error.message : 'Não foi possível enviar o arquivo.'}`)
      }
    }
    if (enviados) toast.success(`${enviados} anexo(s) enviado(s)!`)
    await carregar()
  })

  const excluir = async (anexo: AnexoProjeto) => {
    if (!window.confirm(`Excluir o anexo "${anexo.nome}"? Esta ação não pode ser desfeita.`)) return
    await executar(async () => {
      try {
        await removerAnexo(anexo.caminho)
        setAnexos(prev => prev.filter(a => a.caminho !== anexo.caminho))
        toast.success('Anexo excluído.')
      } catch { toast.error('Não foi possível excluir o anexo.') }
    })
  }

  return (
    <section className="border-t border-line pt-4 dark:border-slate-800">
      <button type="button" aria-expanded={aberto} aria-controls={`anexos-${projetoId}`} onClick={() => {
        setAberto(!aberto)
        if (!aberto) void carregar()
      }} className="flex items-center gap-2 text-sm font-bold text-teal-600 dark:text-[#38bdf8]">
        <Paperclip size={16} /> {aberto ? 'Ocultar anexos' : 'Anexos do projeto'}
      </button>
      {aberto && <div id={`anexos-${projetoId}`} className="mt-3 space-y-3">
        {isAdmin && <div>
          <button type="button" disabled={ocupado || disabled || carregando || !!erro} onClick={() => input.current?.click()} className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-2 text-sm text-teal-600 disabled:opacity-50 dark:border-slate-600 dark:text-[#38bdf8]">
            {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {ocupado ? 'Processando...' : 'Inserir anexo'}
          </button>
          <p className="mt-1 text-xs text-ink-400">Selecione um ou mais arquivos. Até 20 MB por arquivo. O envio é salvo automaticamente.</p>
          <input ref={input} type="file" multiple className="hidden" aria-label="Selecionar anexos do projeto" onChange={event => {
            const arquivos = Array.from(event.target.files || [])
            event.target.value = ''
            if (arquivos.length) void enviar(arquivos)
          }} />
        </div>}
        {carregando ? <p role="status" className="text-xs text-ink-400">Carregando anexos...</p> : erro ? (
          <div role="alert" className="text-sm text-red-600 dark:text-red-400">{erro} <button type="button" onClick={() => void carregar()} className="underline">Tentar novamente</button></div>
        ) : anexos.length === 0 ? <p className="text-xs text-ink-400">Nenhum anexo neste projeto.</p> : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {anexos.map(anexo => <li key={anexo.caminho} className="flex items-center gap-2 rounded-md bg-navy-50 p-3 dark:bg-slate-800/50">
              <div className="min-w-0 flex-1">
                <p title={anexo.nome} className="truncate text-sm font-medium text-ink-900 dark:text-white">{anexo.nome}</p>
                <p className="text-xs text-ink-400">{anexo.tamanho < 1024 * 1024 ? `${Math.ceil(anexo.tamanho / 1024)} KB` : `${(anexo.tamanho / 1024 / 1024).toFixed(1)} MB`} · {new Date(anexo.criadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
              <button type="button" aria-label={`Baixar ${anexo.nome}`} disabled={ocupado || disabled} onClick={() => void executar(async () => {
                try { await baixarAnexo(anexo) } catch { toast.error('Não foi possível baixar o anexo.') }
              })} className="rounded p-2 text-teal-600 disabled:opacity-50 dark:text-[#38bdf8]"><Download size={16} /></button>
              {isAdmin && <button type="button" aria-label={`Excluir ${anexo.nome}`} disabled={ocupado || disabled} onClick={() => void excluir(anexo)} className="rounded p-2 text-red-600 disabled:opacity-50 dark:text-red-400"><Trash2 size={16} /></button>}
            </li>)}
          </ul>
        )}
      </div>}
    </section>
  )
}
