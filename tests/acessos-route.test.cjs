const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = ts.transpileModule(fs.readFileSync('app/api/acessos/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText

function setup(options = {}) {
  const calls = { created: [], sent: [], deleted: [] }
  const profile = { id: 'new-id', full_name: 'Pessoa', role: 'membro', escopo: 'projeto' }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: options.invalidToken ? null : { id: 'admin-id' } } }),
      admin: {
        createUser: async data => {
          calls.created.push(data)
          return options.duplicate ? { error: { code: 'email_exists' }, data: {} } : { data: { user: { id: 'new-id' } } }
        },
        deleteUser: async id => { calls.deleted.push(id); return { error: options.rollbackFailure } },
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { role: options.role || 'admin' } }) }) }),
      upsert: () => ({ select: () => ({ single: async () => options.profileFailure ? { error: {} } : { data: profile } }) }),
    }),
  }
  const exports = {}
  vm.runInNewContext(source, {
    exports, URL, process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret', ZOHO_EMAIL: 'sender@example.com', ZOHO_PASSWORD: 'secret', NEXT_PUBLIC_SITE_URL: 'https://portal.example.com' } },
    require: name => {
      if (name === 'node:crypto') return require(name)
      if (name === '@supabase/supabase-js') return { createClient: () => client }
      if (name === 'next/server') return { NextResponse: { json: (body, { status }) => ({ body, status }) } }
      if (name === 'nodemailer') return { createTransport: () => ({
        verify: async () => { if (options.smtpFailure) throw Error('SMTP') },
        sendMail: async message => { calls.sent.push(message); if (options.mailFailure) throw Error('SMTP'); return { accepted: [message.to] } },
      }) }
      throw Error(name)
    },
  })
  return { calls, run: (body = {}, token = 'valid') => exports.POST(new Request('https://portal.example.com/api/acessos', {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ full_name: 'Pessoa', email: ' Person@Example.com ', role: 'membro', escopo: 'projeto', ...body }),
  })) }
}

test('rejects missing or invalid authentication and non-admin roles', async () => {
  for (const [options, token, status] of [[{}, '', 401], [{ invalidToken: true }, 'bad', 401], [{ role: 'membro' }, 'valid', 403], [{ role: 'admin_projeto' }, 'valid', 403]]) {
    const app = setup(options)
    assert.equal((await app.run({}, token)).status, status)
    assert.equal(app.calls.created.length, 0)
  }
})
test('validates input before creating an account', async () => {
  for (const body of [{ email: 'invalid' }, { full_name: ' ' }, { role: 'owner' }, { escopo: 'invalid' }]) {
    const app = setup()
    assert.equal((await app.run(body)).status, 400)
    assert.equal(app.calls.created.length, 0)
  }
})
test('sends generated credentials only by email and normalizes login', async () => {
  const app = setup()
  const result = await app.run()
  assert.equal(result.status, 201)
  assert.equal(result.body.emailSent, true)
  const account = app.calls.created[0]
  assert.equal(account.email, 'person@example.com')
  assert.ok(account.password.length >= 24)
  assert.ok(app.calls.sent[0].text.includes(account.password))
  assert.ok(app.calls.sent[0].text.includes('https://portal.example.com/login'))
  assert.ok(!JSON.stringify(result.body).includes(account.password))
})
test('SMTP verification failure creates no account', async () => {
  const app = setup({ smtpFailure: true })
  assert.equal((await app.run()).status, 500)
  assert.equal(app.calls.created.length, 0)
})
test('duplicate email does not send credentials', async () => {
  const app = setup({ duplicate: true })
  assert.equal((await app.run()).status, 409)
  assert.equal(app.calls.sent.length, 0)
})
test('profile failure rolls back only the newly created account', async () => {
  const app = setup({ profileFailure: true })
  assert.equal((await app.run()).status, 500)
  assert.deepEqual(app.calls.deleted, ['new-id'])
  assert.equal(app.calls.sent.length, 0)
})
test('mail failure returns the created profile and recovery guidance', async () => {
  const app = setup({ mailFailure: true })
  const result = await app.run()
  assert.equal(result.status, 201)
  assert.equal(result.body.emailSent, false)
  assert.equal(result.body.profile.id, 'new-id')
  assert.match(result.body.warning, /Esqueci minha senha/)
  assert.equal(app.calls.deleted.length, 0)
})
