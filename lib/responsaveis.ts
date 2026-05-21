// Helper compartilhado entre tarefas, dashboard, projetos e page.tsx.
// Lê o responsável da tarefa preferindo a lista nova (responsaveis_lista)
// e caindo no fk antigo (responsaveis singular) se não houver.

export type ResponsavelLite = { id?: string; nome: string; email?: string }

export const getResponsaveis = (atv: any): ResponsavelLite[] => {
  if (atv?.responsaveis_lista && Array.isArray(atv.responsaveis_lista) && atv.responsaveis_lista.length > 0) {
    return atv.responsaveis_lista
  }
  if (atv?.responsaveis) return [atv.responsaveis]
  return []
}
