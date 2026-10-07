import { supabase } from '@/lib/supabase'

export const BUCKET_PROJETOS = 'projetos-anexos'
export const LIMITE_ANEXO = 20 * 1024 * 1024
export type AnexoProjeto = { caminho: string; nome: string; tamanho: number; criadoEm: string }

export async function listarAnexos(projetoId: string): Promise<AnexoProjeto[]> {
  const arquivos: AnexoProjeto[] = []
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(BUCKET_PROJETOS).list(String(projetoId), {
      limit: 100, offset, sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    for (const item of data || []) {
      if (!item.id) continue
      arquivos.push({
        caminho: `${projetoId}/${item.name}`,
        nome: item.name.replace(/^[0-9a-f-]{36}--/i, ''),
        tamanho: Number(item.metadata?.size || 0), criadoEm: item.created_at,
      })
    }
    if (!data || data.length < 100) break
  }
  return arquivos.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

export async function enviarAnexo(projetoId: string, arquivo: File) {
  if (!arquivo.size) throw new Error('O arquivo está vazio.')
  if (arquivo.size > LIMITE_ANEXO) throw new Error('O limite é de 20 MB por arquivo.')
  const nome = arquivo.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._() -]/g, '_').slice(-180) || 'arquivo'
  const caminho = `${projetoId}/${crypto.randomUUID()}--${nome}`
  const { error } = await supabase.storage.from(BUCKET_PROJETOS).upload(caminho, arquivo, { upsert: false })
  if (error) throw error
}

export async function removerAnexo(caminho: string) {
  const { error } = await supabase.storage.from(BUCKET_PROJETOS).remove([caminho])
  if (error) throw error
}

export async function baixarAnexo(anexo: AnexoProjeto) {
  const { data, error } = await supabase.storage.from(BUCKET_PROJETOS).download(anexo.caminho)
  if (error) throw error
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = anexo.nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export async function removerAnexosDoProjeto(projetoId: string) {
  const anexos = await listarAnexos(projetoId)
  for (let i = 0; i < anexos.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET_PROJETOS).remove(anexos.slice(i, i + 100).map(a => a.caminho))
    if (error) throw error
  }
}
