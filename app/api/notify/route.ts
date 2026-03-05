import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: Request) {
  try {
    const { to, subject, taskName, action, userName, observacoes } = await request.json()

    const transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com', 
      port: 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD,
      },
    })

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background-color: #0B1F3A; padding: 24px; text-align: center;">
          <h2 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Portal da Controladoria</h2>
        </div>
        
        <div style="padding: 32px; background-color: #f8fafc;">
          <h3 style="margin-top: 0; color: #1e293b; font-size: 20px;">Olá!</h3>
          <p style="font-size: 16px; line-height: 1.5; color: #475569;">
            A tarefa <strong style="color: #0f172a;">"${taskName}"</strong> foi <strong>${action}</strong> por ${userName}.
          </p>
          
          ${observacoes ? `
            <div style="margin-top: 20px; background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #0B1F3A;">
              <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Observações:</strong><br/>${observacoes}</p>
            </div>
          ` : ''}

          <div style="margin-top: 32px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/tarefas" style="background-color: #0B1F3A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Acessar Painel de Tarefas
            </a>
          </div>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: `"Portal da Controladoria" <${process.env.ZOHO_EMAIL}>`,
      to,
      subject,
      html: htmlTemplate,
    })

    return NextResponse.json({ success: true, message: 'Email enviado com sucesso!' })
  } catch (error: any) {
    console.error('Erro ao enviar email pelo Zoho:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}