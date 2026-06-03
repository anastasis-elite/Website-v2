import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate, getClientTimeZone } from '@/lib/timezone'

export const runtime = 'nodejs'

type MealEntry = {
  id: string
  client_id: string
  food_name?: string | null
  name?: string | null
  serving_label?: string | null
  serving_size?: string | null
  serving_amount?: number | null
  unit?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fats_g?: number | null
  logged_at?: string | null
  created_at?: string | null
}

function getTimeBlock(hour: number) {
  if (hour >= 4 && hour < 11) return 'breakfast'
  if (hour >= 11 && hour < 16) return 'lunch'
  if (hour >= 16 && hour < 21) return 'dinner'
  return 'late'
}

function getHourInTimeZone(dateString: string, timeZone: string) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(dateString))
  )
}

function getDaysAgoDate(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function normalizeEntry(entry: MealEntry) {
  const foodName = entry.food_name || entry.name || 'Food'
  const servingLabel =
    entry.serving_label ||
    entry.serving_size ||
    `${entry.serving_amount || ''} ${entry.unit || ''}`.trim() ||
    'Serving'

  return {
    key: `${foodName.toLowerCase()}::${servingLabel.toLowerCase()}`,
    foodName,
    servingLabel,
    servingAmount: entry.serving_amount || null,
    unit: entry.unit || null,
    calories: Number(entry.calories || 0),
    protein: Number(entry.protein_g || 0),
    carbs: Number(entry.carbs_g || 0),
    fats: Number(entry.fat_g || entry.fats_g || 0),
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { error: clientError?.message || 'Client not found' },
        { status: 404 }
      )
    }

    const timeZone = getClientTimeZone(client)

    const currentHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        hour12: false,
      }).format(new Date())
    )

    const currentBlock = getTimeBlock(currentHour)

    const since30 = getDaysAgoDate(30)

    const { data: entries, error: entriesError } = await supabase
      .from('meal_entries')
      .select('*')
      .eq('client_id', client.client_id)
      .gte('created_at', since30)
      .order('created_at', { ascending: false })

    if (entriesError) {
      return NextResponse.json(
        { error: entriesError.message },
        { status: 500 }
      )
    }

    const usableEntries = (entries || []).filter((entry: MealEntry) => {
      const dateString = entry.logged_at || entry.created_at
      if (!dateString) return false

      const hour = getHourInTimeZone(dateString, timeZone)
      return getTimeBlock(hour) === currentBlock
    })

    const since7Time = new Date()
    since7Time.setDate(since7Time.getDate() - 7)

    const counts = new Map<
      string,
      {
        foodName: string
        servingLabel: string
        servingAmount: number | null
        unit: string | null
        calories: number
        protein: number
        carbs: number
        fats: number
        frequency7: number
        frequency30: number
        lastLoggedAt: string
      }
    >()

    for (const entry of usableEntries as MealEntry[]) {
      const dateString = entry.logged_at || entry.created_at
      if (!dateString) continue

      const normalized = normalizeEntry(entry)

      const existing =
        counts.get(normalized.key) ||
        {
          foodName: normalized.foodName,
          servingLabel: normalized.servingLabel,
          servingAmount: normalized.servingAmount,
          unit: normalized.unit,
          calories: normalized.calories,
          protein: normalized.protein,
          carbs: normalized.carbs,
          fats: normalized.fats,
          frequency7: 0,
          frequency30: 0,
          lastLoggedAt: dateString,
        }

      existing.frequency30 += 1

      if (new Date(dateString) >= since7Time) {
        existing.frequency7 += 1
      }

      if (new Date(dateString) > new Date(existing.lastLoggedAt)) {
        existing.lastLoggedAt = dateString
      }

      counts.set(normalized.key, existing)
    }

    const allSuggestions = Array.from(counts.values())

    const sevenDaySuggestions = allSuggestions
      .filter((item) => item.frequency7 >= 4)
      .sort((a, b) => b.frequency7 - a.frequency7)

    const thirtyDaySuggestions = allSuggestions
      .filter((item) => item.frequency30 >= 15)
      .sort((a, b) => b.frequency30 - a.frequency30)

    const suggestions =
      sevenDaySuggestions.length > 0
        ? sevenDaySuggestions.slice(0, 4)
        : thirtyDaySuggestions.slice(0, 4)

    return NextResponse.json({
      success: true,
      date: getClientLocalDate(client),
      timeZone,
      timeBlock: currentBlock,
      suggestions,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Quick-add suggestions failed',
      },
      { status: 500 }
    )
  }
}
