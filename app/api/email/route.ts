import { NextResponse } from 'next/server'
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
export async function POST(req: Request) {
  try {
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
      from: 'Anastasis <onboarding@YOURDOMAIN.com>',
      to,
      subject,
      html,
    })
    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('EMAIL ERROR:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    )
  }
}
