import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: symptomTypes, error: symptomError } = await supabase
    .from('symptom_types')
    .select('id, name, category')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (symptomError) {
    return NextResponse.json({ error: symptomError.message }, { status: 500 })
  }

  const { data: bodyRegions, error: regionError } = await supabase
    .from('body_regions')
    .select('id, name')
    .order('sort_order', { ascending: true })

  if (regionError) {
    return NextResponse.json({ error: regionError.message }, { status: 500 })
  }

  return NextResponse.json({
    symptomTypes: symptomTypes || [],
    bodyRegions: bodyRegions || [],
  })
}
