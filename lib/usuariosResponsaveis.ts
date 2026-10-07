import { supabase } from './supabase'

type PerfilResponsavel = { id: string; full_name: string | null; email: string | null }
type VinculoLegado = { id: string | number; email: string | null }
export type UsuarioResponsavel = { id: string; profile_id: string; nome: string; email: string }

/** profiles é o cadastro único. O id antigo só mantém as FKs já existentes. */
export function mapearUsuariosResponsaveis(perfis: PerfilResponsavel[], vinculos: VinculoLegado[]): UsuarioResponsavel[] {
  return perfis.map(perfil => {
    const email = (perfil.email || '').trim().toLowerCase()
    const encontrados = vinculos.filter(v => (v.email || '').trim().toLowerCase() === email)
    if (!email || encontrados.length !== 1) {
      throw new Error(`O usuário ${perfil.full_name || email || perfil.id} precisa ter seu vínculo de atividades sincronizado na Gestão de Acessos.`)
    }
    return { id: String(encontrados[0].id), profile_id: perfil.id, nome: perfil.full_name?.trim() || email, email }
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function consultarUsuariosResponsaveis() {
  const [perfis, vinculos] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    supabase.from('responsaveis').select('id, email'),
  ])
  if (perfis.error) throw perfis.error
  if (vinculos.error) throw vinculos.error
  return { data: mapearUsuariosResponsaveis(perfis.data || [], vinculos.data || []), error: null }
}
