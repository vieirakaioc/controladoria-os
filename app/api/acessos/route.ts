import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const respond = (body: object, status = 200) => NextResponse.json(body, { status })
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
  if (!token) return respond({ error: 'Entre novamente para continuar.' }, 401)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return respond({ error: 'O cadastro de usuários ainda não foi configurado no servidor.' }, 503)

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) return respond({ error: 'Sessão inválida. Entre novamente.' }, 401)
    const { data: requester, error: permissionError } = await admin.from('profiles').select('role').eq('id', auth.user.id).single()
    if (permissionError) return respond({ error: 'Não foi possível verificar suas permissões.' }, 500)
    if (requester?.role !== 'admin') return respond({ error: 'Somente administradores podem criar usuários.' }, 403)

    const body = await request.json().catch(() => null)
    const name = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body?.role
    const escopo = body?.escopo
    if (!name || name.length > 150 || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)
      || !['membro', 'admin_projeto', 'admin'].includes(role)
      || !['controladoria', 'projeto', 'ambos'].includes(escopo)) {
      return respond({ error: 'Informe nome, e-mail, nível de acesso e escopo válidos.' }, 400)
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL
    if (!process.env.ZOHO_EMAIL || !process.env.ZOHO_PASSWORD || !site) {
      return respond({ error: 'Configure o envio de e-mails e o endereço do portal antes de criar usuários.' }, 503)
    }
    const loginUrl = new URL('/login', site)
    if (!['http:', 'https:'].includes(loginUrl.protocol)) return respond({ error: 'Endereço do portal inválido.' }, 503)
    const transport = nodemailer.createTransport({
      host: 'smtp.zoho.com', port: 465, secure: true,
      auth: { user: process.env.ZOHO_EMAIL, pass: process.env.ZOHO_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    })
    // Detecta problemas de configuração antes de criar a conta.
    await transport.verify()
    const password = `Aa1!${randomBytes(18).toString('base64url')}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: name },
    })
    if (createError || !created.user) {
      const duplicate = ['email_exists', 'user_already_exists'].includes(createError?.code ?? '')
      return respond({ error: duplicate ? 'Este e-mail já possui uma conta.' : 'Não foi possível criar o usuário.' }, duplicate ? 409 : 500)
    }

    const { data: profile, error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id, full_name: name, email, role, escopo,
    }, { onConflict: 'id' }).select('id, full_name, avatar_url, role, escopo').single()
    if (profileError || !profile) {
      const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id)
      return respond({ error: rollbackError
        ? 'A conta foi criada, mas o perfil não foi concluído. Revise o cadastro antes de tentar novamente; nenhum e-mail foi enviado.'
        : 'Não foi possível salvar o perfil. O cadastro foi desfeito; tente novamente.' }, 500)
    }

    try {
      const result = await transport.sendMail({
        from: `"Portal da Controladoria" <${process.env.ZOHO_EMAIL}>`, to: email,
        subject: 'Seu acesso ao Portal da Controladoria',
        text: `Olá, ${name}!\n\nSeu acesso ao Portal da Controladoria foi criado.\n\nAcesse: ${loginUrl.href}\nLogin: ${email}\nSenha: ${password}\n\nApós entrar, altere sua senha na página de perfil.\nNão compartilhe suas credenciais.`,
      })
      if (!result.accepted?.length) throw new Error('Email not accepted')
      return respond({ profile, emailSent: true }, 201)
    } catch {
      // A conta já existe: não apagar nem repetir a criação após falha de SMTP.
      return respond({ profile, emailSent: false, warning: 'Usuário criado, mas o envio do e-mail não foi confirmado. Oriente a pessoa a usar “Esqueci minha senha” na tela de login.' }, 201)
    }
  } catch {
    return respond({ error: 'Não foi possível concluir a operação. Confira a lista de usuários antes de tentar novamente.' }, 500)
  }
}
