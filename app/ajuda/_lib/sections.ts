// Estrutura das seções do manual — usada pelo TOC e pelos próprios cards.
// Manter ordem aqui = ordem que aparece no menu lateral E na página.

export type ManualSection = { id: string; title: string }

export const SECTIONS: ManualSection[] = [
  { id: 'visao-geral',     title: 'Visão Geral' },
  { id: 'glossario',       title: 'Glossário' },
  { id: 'importacao',      title: 'Importar Atividades' },
  { id: 'frequencias',     title: 'Frequências & Prazos' },
  { id: 'ciclo-mensal',    title: 'Ciclo Mensal' },
  { id: 'paginas',         title: 'Páginas do Sistema' },
  { id: 'monitor-score',   title: 'Monitor & Score' },
  { id: 'permissoes',      title: 'Permissões' },
  { id: 'faq',             title: 'FAQ' },
]
