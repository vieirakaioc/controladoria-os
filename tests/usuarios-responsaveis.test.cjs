const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: () => ({ supabase: {} }) })
  return exports
}
const { mapearUsuariosResponsaveis } = load('lib/usuariosResponsaveis.ts')
const { getResponsaveis } = load('lib/responsaveis.ts')
test('only Access Management users are selectable and their names prevail', () => {
  const result = mapearUsuariosResponsaveis([{ id: 'profile-a', full_name: 'Nome atualizado', email: ' USER@example.com ' }], [{ id: 7, email: 'user@example.com', nome: 'Nome antigo' }, { id: 8, email: 'sem-login@example.com' }])
  assert.equal(result.length, 1)
  assert.equal(result[0].nome, 'Nome atualizado')
  assert.equal(result[0].id, '7')
  assert.equal(result[0].profile_id, 'profile-a')
  assert.equal(result[0].email, 'user@example.com')
})
test('missing or ambiguous links fail explicitly rather than hiding users or assigning a wrong person', () => {
  const profiles = [{ id: 'a', full_name: 'Ana', email: 'ana@example.com' }]
  assert.throws(() => mapearUsuariosResponsaveis(profiles, []), /sincronizado/)
  assert.throws(() => mapearUsuariosResponsaveis(profiles, [{ id: 1, email: 'ana@example.com' }, { id: 2, email: 'ANA@example.com' }]), /sincronizado/)
})
test('historical assignments retain their ids and normalize numeric/string representations', () => {
  assert.equal(getResponsaveis({ responsaveis_lista: [{ id: 7, nome: 'Antigo' }] })[0].id, '7')
  assert.equal(getResponsaveis({ responsaveis: { id: 7, nome: 'Antigo' } })[0].id, '7')
})
