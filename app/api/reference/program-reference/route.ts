import { NextRequest, NextResponse } from 'next/server'

import igniteGym from '@/data/template/igniteGym.json'
import emberGym from '@/data/template/emberGym.json'

import phoenixStrength from '@/data/template/phoenixStrength.json'
import phoenixHypertrophy from '@/data/template/phoenixHypertrophy.json'
import phoenixBodybuilding from '@/data/template/phoenixBodybuilding.json'
import phoenixRecomposition from '@/data/template/phoenixRecomposition.json'
import phoenixEndurance from '@/data/template/phoenixEndurance.json'
import phoenixGluteSculpt from '@/data/template/phoenixGluteSculpt.json'
import phoenixWaistCincher from '@/data/template/phoenixWaistCincher.json'
import phoenixFullTransformation from '@/data/template/phoenixFullTransformation.json'

const templates: Record<string, any> = {
  ignite: igniteGym,
  ember: emberGym,

  phoenixStrength,
  phoenixHypertrophy,
  phoenixBodybuilding,
  phoenixRecomposition,
  phoenixEndurance,
  phoenixGluteSculpt,
  phoenixWaistCincher,
  phoenixFullTransformation,
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams

  const program = searchParams.get('program')

  if (!program || !templates[program]) {
    return NextResponse.json(
      { error: 'Template not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(templates[program])
}
