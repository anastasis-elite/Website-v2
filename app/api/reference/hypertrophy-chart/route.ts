import { NextResponse } from 'next/server'
import hypertrophyChart from '@/data/reference/hypertrophyChart_normalized.json'

export async function GET() {
  return NextResponse.json(hypertrophyChart)
}
