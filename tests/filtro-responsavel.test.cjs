const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function compile(path, require) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require })
  return exports
}
const helpers = compile('lib/responsaveis.ts', () => ({}))
const pessoas = [{ id: '7', nome: 'Nome atualizado', email: 'ana@example.com' }, { id: '9', nome: 'Nome atualizado', email: 'outra@example.com' }]
const rows = [
  { id: 'a', status: 'Pendente', atividades: { responsaveis_lista: [{ id: 7, nome: 'Nome antigo', email: 'ANA@example.com' }] } },
  { id: 'b', status: 'Pendente', atividades: { responsaveis_lista: [{ id: 8, nome: 'Sem login', email: 'legado@example.com' }] } },
  { id: 'c', status: 'Pendente', atividades: { responsaveis_lista: [{ nome: 'Nome antigo', email: ' ana@example.com ' }] } },
]
function run(selected = 'Todos', taskRows = rows) {
  let index = 0
  const { useTarefaFilters } = compile('app/tarefas/_hooks/useTarefaFilters.ts', name => {
    if (name === 'react') return { useEffect: () => {}, useMemo: fn => fn(), useState: initial => [index++ === 3 ? selected : initial, () => {}] }
    if (name.includes('responsaveis')) return helpers
    return { getBucket: () => 'Sem data' }
  })
  return useTarefaFilters({ rows: taskRows, responsaveis: pessoas, statuses: ['Pendente'], mesAlvo: 9, anoAlvo: 2026 })
}
test('filter lists Access Management users, including those without tasks, and excludes legacy-only names', () => {
  assert.equal(run().respOptions, pessoas)
  assert.equal(run('Todos', []).respOptions, pessoas)
  assert.equal(run().filtradas.length, 3)
})
test('filter matches historical ids or normalized email despite renamed users', () => {
  assert.deepEqual(Array.from(run('7').filtradas, r => r.id), ['a', 'c'])
})
test('same-name users are not confused', () => {
  assert.equal(run('9').filtradas.length, 0)
})
