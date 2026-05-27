import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLowerCase()

  if (!q) {
    return NextResponse.json({ foods: [] })
  }

  const { data, error } = await supabase
    .from('foods')
    .select('id, name')
    .ilike('normalized_name', `%${q}%`)
    .limit(12)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ foods: data || [] })
}
