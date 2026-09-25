import { NextResponse } from 'next/server'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'

export async function GET() {
  const admin = await getAOSAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(hypertrophyChart)
}
