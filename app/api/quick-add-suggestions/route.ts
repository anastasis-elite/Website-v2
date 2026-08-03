import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  getClientLocalDate,
  getClientTimeZone,
} from '@/lib/timezone'

export const runtime = 'nodejs'

type RelatedFood = {
  name?: string | null
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
}

type RelatedServingOption = {
  label?: string | null
  unit?: string | null
}

type MealEntry = {
  id: string
  nutrition_log_id: string
  food_id: string

  meal_name?: string | null
  serving_amount?: number | null
  serving_unit?: string | null
  serving_option_id?: string | null
  grams?: number | null
  day_block?: string | null
  created_at?: string | null

  foods?:
    | RelatedFood
    | RelatedFood[]
    | null

  food_serving_options?:
    | RelatedServingOption
    | RelatedServingOption[]
    | null
}

type NormalizedEntry = {
  key: string

  foodId: string
  servingOptionId: string | null
  mealName: string

  foodName: string
  servingLabel: string
  servingAmount: number
  unit: string | null

  calories: number
  protein: number
  carbs: number
  fats: number

  createdAt: string
}

type Suggestion = {
  foodId: string
  servingOptionId: string | null
  mealName: string

  foodName: string
  servingLabel: string
  servingAmount: number
  unit: string | null

  calories: number
  protein: number
  carbs: number
  fats: number

  frequency7: number
  frequency30: number
  lastLoggedAt: string
}

function getTimeBlock(hour: number) {
  if (hour >= 4 && hour < 11) {
    return 'breakfast'
  }

  if (hour >= 11 && hour < 16) {
    return 'lunch'
  }

  if (hour >= 16 && hour < 21) {
    return 'dinner'
  }

  return 'late'
}

function getHourInTimeZone(
  dateString: string,
  timeZone: string,
) {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(dateString)),
  )
}

function getDaysAgoDate(days: number) {
  const date = new Date()

  date.setDate(
    date.getDate() - days,
  )

  return date.toISOString()
}

function getRelatedRow<T>(
  value: T | T[] | null | undefined,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function normalizeEntry(
  entry: MealEntry,
): NormalizedEntry | null {
  if (
    !entry.food_id ||
    !entry.created_at
  ) {
    return null
  }

  const food =
    getRelatedRow(entry.foods)

  const servingOption =
    getRelatedRow(
      entry.food_serving_options,
    )

  const foodName =
    food?.name ||
    entry.meal_name ||
    'Food'

  const servingAmount =
    Number(
      entry.serving_amount || 1,
    )

  const unit =
    servingOption?.unit ||
    entry.serving_unit ||
    null

  const servingLabel =
    servingOption?.label ||
    entry.serving_unit ||
    `${servingAmount}${
      unit ? ` ${unit}` : ''
    }`

  return {
    key: `${entry.food_id}::${
      entry.serving_option_id ||
      servingLabel.toLowerCase()
    }`,

    foodId: entry.food_id,

    servingOptionId:
      entry.serving_option_id ||
      null,

    mealName:
      entry.meal_name ||
      'Meal',

    foodName,
    servingLabel,
    servingAmount,
    unit,

    calories: Number(
      food?.calories || 0,
    ),

    protein: Number(
      food?.protein_g || 0,
    ),

    carbs: Number(
      food?.carbs_g || 0,
    ),

    fats: Number(
      food?.fat_g || 0,
    ),

    createdAt:
      entry.created_at,
  }
}

export async function GET() {
  try {
    const supabase =
      await createClient()

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser()

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      )
    }

    const {
      data: client,
      error: clientError,
    } = await supabase
      .from('clients')
      .select(
        `
          client_id,
          auth_user_id,
          timezone,
          state,
          onboarding_data
        `,
      )
      .eq(
        'auth_user_id',
        user.id,
      )
      .maybeSingle()

    if (
      clientError ||
      !client
    ) {
      return NextResponse.json(
        {
          error:
            clientError?.message ||
            'Client not found',
        },
        {
          status: 404,
        },
      )
    }

    const timeZone =
      getClientTimeZone(client)

    const currentHour =
      Number(
        new Intl.DateTimeFormat(
          'en-US',
          {
            timeZone,
            hour: 'numeric',
            hour12: false,
          },
        ).format(new Date()),
      )

    const currentBlock =
      getTimeBlock(currentHour)

    const since30 =
      getDaysAgoDate(30)

    const since30Date =
      since30.split('T')[0]

    /*
     * meal_entries does not contain client_id.
     * Resolve the client’s nutrition logs first,
     * then query their meal entries by nutrition_log_id.
     */
    const {
      data: nutritionLogs,
      error:
        nutritionLogsError,
    } = await supabase
      .from('nutrition_logs')
      .select('id')
      .eq(
        'client_id',
        client.client_id,
      )
      .eq(
        'auth_user_id',
        user.id,
      )
      .gte(
        'log_date',
        since30Date,
      )

    if (
      nutritionLogsError
    ) {
      return NextResponse.json(
        {
          error:
            nutritionLogsError.message,
        },
        {
          status: 500,
        },
      )
    }

    const nutritionLogIds =
      (nutritionLogs || []).map(
        (log) => log.id,
      )

    if (
      nutritionLogIds.length === 0
    ) {
      return NextResponse.json({
        success: true,
        date:
          getClientLocalDate(
            client,
          ),
        timeZone,
        timeBlock:
          currentBlock,
        suggestions: [],
      })
    }

    const {
      data: entries,
      error: entriesError,
    } = await supabase
      .from('meal_entries')
      .select(
        `
          id,
          nutrition_log_id,
          food_id,
          meal_name,
          serving_amount,
          serving_unit,
          serving_option_id,
          grams,
          day_block,
          created_at,
          foods (
            name,
            calories,
            protein_g,
            carbs_g,
            fat_g
          ),
          food_serving_options (
            label,
            unit
          )
        `,
      )
      .in(
        'nutrition_log_id',
        nutritionLogIds,
      )
      .gte(
        'created_at',
        since30,
      )
      .order(
        'created_at',
        {
          ascending: false,
        },
      )

    if (entriesError) {
      return NextResponse.json(
        {
          error:
            entriesError.message,
        },
        {
          status: 500,
        },
      )
    }

    const normalizedEntries =
      (entries || [])
        .map((entry) =>
          normalizeEntry(
            entry as MealEntry,
          ),
        )
        .filter(
          (
            entry,
          ): entry is NormalizedEntry =>
            Boolean(entry),
        )

    const usableEntries =
      normalizedEntries.filter(
        (entry) => {
          const hour =
            getHourInTimeZone(
              entry.createdAt,
              timeZone,
            )

          return (
            getTimeBlock(hour) ===
            currentBlock
          )
        },
      )

    const since7Time =
      new Date()

    since7Time.setDate(
      since7Time.getDate() - 7,
    )

    const counts =
      new Map<
        string,
        Suggestion
      >()

    for (
      const entry of usableEntries
    ) {
      const existing =
        counts.get(entry.key) || {
          foodId:
            entry.foodId,

          servingOptionId:
            entry.servingOptionId,

          mealName:
            entry.mealName,

          foodName:
            entry.foodName,

          servingLabel:
            entry.servingLabel,

          servingAmount:
            entry.servingAmount,

          unit:
            entry.unit,

          calories:
            entry.calories,

          protein:
            entry.protein,

          carbs:
            entry.carbs,

          fats:
            entry.fats,

          frequency7: 0,
          frequency30: 0,

          lastLoggedAt:
            entry.createdAt,
        }

      existing.frequency30 += 1

      if (
        new Date(
          entry.createdAt,
        ) >= since7Time
      ) {
        existing.frequency7 += 1
      }

      if (
        new Date(
          entry.createdAt,
        ) >
        new Date(
          existing.lastLoggedAt,
        )
      ) {
        existing.lastLoggedAt =
          entry.createdAt
      }

      counts.set(
        entry.key,
        existing,
      )
    }

    const allSuggestions =
      Array.from(
        counts.values(),
      )

    const sevenDaySuggestions =
      allSuggestions
        .filter(
          (item) =>
            item.frequency7 >= 4,
        )
        .sort(
          (first, second) =>
            second.frequency7 -
            first.frequency7,
        )

    const thirtyDaySuggestions =
      allSuggestions
        .filter(
          (item) =>
            item.frequency30 >= 15,
        )
        .sort(
          (first, second) =>
            second.frequency30 -
            first.frequency30,
        )

    const suggestions =
      sevenDaySuggestions.length >
      0
        ? sevenDaySuggestions.slice(
            0,
            4,
          )
        : thirtyDaySuggestions.slice(
            0,
            4,
          )

    return NextResponse.json({
      success: true,

      date:
        getClientLocalDate(
          client,
        ),

      timeZone,

      timeBlock:
        currentBlock,

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
      {
        status: 500,
      },
    )
  }
}
