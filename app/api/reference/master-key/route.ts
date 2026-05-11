import { NextResponse } from 'next/server'
import masterKey from '@/data/reference/masterKey.json'

export async function GET() {
  return NextResponse.json(masterKey)
}
