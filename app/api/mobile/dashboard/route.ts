import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      message: 'Mobile dashboard endpoint is connected.',
      dashboard: {
        rhythm: {
          phaseName: 'Build Capacity',
          message:
            'Your dashboard connection is working. Real dashboard data will be connected next.',
        },
        insight: {
          title: 'Protect the capacity you are building.',
          observation:
            'The mobile app is now connected to the website API.',
          meaning:
            'The website can serve as the source of truth for the mobile dashboard.',
          nextStep:
            'Connect the authenticated client record and current dashboard calculations.',
        },
        flameScore: 74,
        flameState: 'steady',
        cycleDay: 18,
        cycleLength: 30,
        cyclePhase: 'Luteal',
        waterConsumed: 56,
        waterTarget: 100,
        assessmentDueCount: 1,
        macros: [
          {
            name: 'Protein',
            consumed: 118,
            target: 175,
            unit: 'g',
          },
          {
            name: 'Carbs',
            consumed: 164,
            target: 240,
            unit: 'g',
          },
          {
            name: 'Fats',
            consumed: 52,
            target: 80,
            unit: 'g',
          },
          {
            name: 'Calories',
            consumed: 1710,
            target: 2500,
            unit: 'cal',
          },
        ],
      },
    },
    {
      status: 200,
    }
  )
}
