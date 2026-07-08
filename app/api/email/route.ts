import { NextResponse } from 'next/server'
import { Resend } from 'resend'
export async function POST(req: Request) {
  try {
    const resendApiKey=process.env.RESEND_API_KEY
    if(!resendApiKey)return NextResponse.json({error:'Email service is not configured.'},{status:503})
    const emailSecret=process.env.EMAIL_API_SECRET||process.env.ADMIN_GIFT_SECRET
    if(!emailSecret)return NextResponse.json({error:'Email endpoint is not configured.'},{status:503})
    if(req.headers.get('x-email-secret')!==emailSecret)return NextResponse.json({error:'Unauthorized'},{status:401})
    const resend=new Resend(resendApiKey)
    const body = await req.json()
    const {
      to,
      subject,
      html,
    } = body
    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    const data = await resend.emails.send({
      from: 'Anastasis <onboarding@anastasiselite.com>',
      to,
      subject,
      html,
    })
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: unknown) {
    console.error('EMAIL ERROR:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error?error.message:'Email could not be sent.',
      },
      { status: 500 }
    )
  }
}
