const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('app/projetos/_lib/anexos.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText

function setup({ files = [], failure } = {}) {
  const calls = { uploads: [], removals: [], lists: [] }
  const exports = {}
  vm.runInNewContext(source, { exports, crypto: require('node:crypto').webcrypto, require: () => ({
    supabase: { storage: { from: bucket => {
      assert.equal(bucket, 'projetos-anexos')
      return {
        list: async (folder, options) => {
          calls.lists.push({ folder, ...options })
          return { data: files.slice(options.offset, options.offset + options.limit), error: failure === 'list' ? Error('list failed') : null }
        },
        upload: async (...args) => { calls.uploads.push(args); return { error: failure === 'upload' ? Error('upload failed') : null } },
        remove: async paths => { calls.removals.push(Array.from(paths)); return { error: failure === 'remove' ? Error('remove failed') : null } },
      }
    } } },
  }) })
  return { api: exports, calls }
}

test('rejects empty and oversized files before upload', async () => {
  const { api, calls } = setup()
  for (const size of [0, api.LIMITE_ANEXO + 1]) await assert.rejects(api.enviarAnexo('project-a', { name: 'file.pdf', size }))
  assert.equal(calls.uploads.length, 0)
})
test('uploads unique paths within the project and sanitizes filenames', async () => {
  const { api, calls } = setup()
  const file = { name: '../Relatório.pdf', size: 100 }
  await api.enviarAnexo('project-a', file)
  await api.enviarAnexo('project-a', file)
  const [first, second] = calls.uploads
  assert.match(first[0], /^project-a\/[0-9a-f-]{36}--\.\._Relatorio.pdf$/)
  assert.notEqual(first[0], second[0])
  assert.equal(first[2].upsert, false)
})
test('loads every page and removes all project files in bounded batches', async () => {
  const files = Array.from({ length: 205 }, (_, index) => ({ id: String(index), name: `${index}.pdf`, created_at: '2026-10-07', metadata: { size: 42 } }))
  const { api, calls } = setup({ files })
  await api.removerAnexosDoProjeto('project-b')
  assert.deepEqual(calls.lists.map(c => c.offset), [0, 100, 200])
  assert.ok(calls.lists.every(c => c.folder === 'project-b'))
  assert.deepEqual(calls.removals.map(c => c.length), [100, 100, 5])
  assert.ok(calls.removals.flat().every(p => p.startsWith('project-b/')))
})
test('storage failures propagate to prevent false success and project deletion', async () => {
  const list = setup({ failure: 'list' })
  await assert.rejects(list.api.removerAnexosDoProjeto('project-a'), /list failed/)
  assert.equal(list.calls.removals.length, 0)
  const remove = setup({ failure: 'remove' })
  await assert.rejects(remove.api.removerAnexo('project-a/file.pdf'), /remove failed/)
  const upload = setup({ failure: 'upload' })
  await assert.rejects(upload.api.enviarAnexo('project-a', { name: 'file.pdf', size: 1 }), /upload failed/)
})
