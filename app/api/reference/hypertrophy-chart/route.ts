import { NextResponse } from 'next/server'
import hypertrophyChart from '@/data/reference/hypertrophyChart.json'

export async function GET() {
  return NextResponse.json(hypertrophyChart)
}
