import { NextRequest, NextResponse } from 'next/server'

import igniteGym from '@/data/templates/igniteGym.json'
import emberGym from '@/data/templates/emberGym.json'

import phoenixStrength from '@/data/templates/phoenixStrength.json'
import phoenixHypertrophy from '@/data/templates/phoenixHypertrophy.json'
import phoenixBodybuilding from '@/data/templates/phoenixBodybuilding.json'
import phoenixRecomposition from '@/data/templates/phoenixRecomposition.json'
import phoenixEndurance from '@/data/templates/phoenixEndurance.json'
import phoenixGluteSculpt from '@/data/templates/phoenixGluteSculpt.json'
import phoenixWaistCincher from '@/data/templates/phoenixWaistCincher.json'
import phoenixFullTransformation from '@/data/templates/phoenixFullTransformation.json'

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
